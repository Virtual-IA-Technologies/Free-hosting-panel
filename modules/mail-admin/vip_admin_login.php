<?php
/** One-use, IP-bound Hestia administrator signon; client passwords stay unchanged. */
class vip_admin_login extends rcube_plugin
{
    public $task='';
    private $rc;
    public function init()
    {
        $this->rc=rcmail::get_instance();
        if(!empty($_SESSION['vip_mail_admin'])) {
            $value=$_SESSION['vip_mail_admin'];
            if(($value['expires']??0)<time()||($value['ip']??'')!==($_SERVER['REMOTE_ADDR']??'')) {
                unset($_SESSION['vip_mail_admin']);$this->rc->kill_session();return;
            }
            $this->configure($value['masterUser'],$this->rc->decrypt($value['secret']));
        }
        $this->add_hook('startup',[$this,'startup']);
    }
    private function configure($user,$password)
    {
        $this->rc->config->set('imap_auth_type','PLAIN');$this->rc->config->set('imap_auth_cid',$user);$this->rc->config->set('imap_auth_pw',$password);
        $this->rc->config->set('smtp_host','localhost:25');$this->rc->config->set('smtp_user','');$this->rc->config->set('smtp_pass','');
    }
    public function startup($args)
    {
        if(empty($_POST['vip_admin_ticket']))return $args;
        header('Cache-Control: no-store');header('Referrer-Policy: no-referrer');
        $token=$_POST['vip_admin_ticket'];if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token))return $args;
        require_once '/usr/local/lib/virtualia-mail-admin/ticket-client.php';$value=vip_consume_ticket($token,(string)($_SERVER['REMOTE_ADDR']??''));
        if(empty($value['ok'])||empty($value['data']['email'])||empty($value['data']['masterPassword'])){http_response_code(403);exit('Acceso vencido o buzón suspendido. Abre la bandeja desde el panel.');}
        $data=$value['data'];$this->rc->kill_session();$this->configure($data['masterUser'],$data['masterPassword']);
        if(!$this->rc->login($data['email'],'vip-admin-proxy','localhost:143',false)){http_response_code(403);exit('No se pudo abrir la bandeja. Revisa el estado del dominio y Dovecot.');}
        // Complete the same session lifecycle as Roundcube's native login controller.
        $this->rc->session->remove('temp');$this->rc->session->regenerate_id(false);$this->rc->session->set_auth_cookie();$this->rc->log_login();
        $_SESSION['vip_mail_admin']=['actor'=>$data['actor'],'masterUser'=>$data['masterUser'],'secret'=>$this->rc->encrypt($data['masterPassword']),
            'expires'=>$data['expires'],'ip'=>(string)($_SERVER['REMOTE_ADDR']??'')];
        $this->rc->output->redirect(['_task'=>'mail']);exit;
    }
}
