<?php
header('Cache-Control: no-store');header('Referrer-Policy: no-referrer');header('X-Content-Type-Options: nosniff');
if(($_SERVER['REQUEST_METHOD']??'')==='GET') {
    session_name('VipSqlAdminSession');session_start();$existing=!empty($_SESSION['PMA_single_signon_user'])&&!empty($_SESSION['PMA_single_signon_password']);session_write_close();
    if($existing){header('Location: index.php?server=3');exit;}
    $settings=json_decode(file_get_contents('/usr/local/lib/virtualia-mail-admin/bridge.json'),true);$port=(int)($settings['port']??8083);
    $host=parse_url('https://'.($_SERVER['HTTP_HOST']??''),PHP_URL_HOST);
    if(!is_string($host)||!preg_match('/\A(?:[a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])\z/',$host)||$port<1||$port>65535){http_response_code(400);exit('Abre phpMyAdmin desde Bases de datos en el panel.');}
    header('Location: https://'.$host.':'.$port.'/list/db/?vip_sql_reopen=1');exit;
}
$token=$_POST['ticket']??'';
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token)){http_response_code(403);exit('Acceso no válido. Abre phpMyAdmin desde el panel administrador.');}
require_once '/usr/local/lib/virtualia-mail-admin/ticket-client.php';$value=vip_consume_ticket($token,(string)($_SERVER['REMOTE_ADDR']??''));
if(empty($value['ok'])||($value['data']['kind']??'')!=='sql'){http_response_code(403);exit('Acceso vencido. Vuelve a abrir phpMyAdmin desde el panel.');}
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);session_name('VipSqlAdminSession');session_start();session_regenerate_id(true);
$_SESSION=['PMA_single_signon_user'=>$value['data']['username'],'PMA_single_signon_password'=>$value['data']['password'],'PMA_single_signon_host'=>'localhost','vip_actor'=>$value['data']['actor']];
session_write_close();$route=$_POST['route']??'';$target='index.php?server=3';if(is_string($route)&&in_array($route,['/server/privileges','/server/databases'],true))$target.='&route='.rawurlencode($route);header('Location: '.$target);exit;
