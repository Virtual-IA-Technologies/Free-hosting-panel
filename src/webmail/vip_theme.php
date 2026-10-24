<?php
/** Presentation only: Roundcube retains its session, authentication and mailbox permissions. */
class vip_theme extends rcube_plugin
{
    public function init()
    {
        $this->include_stylesheet('vip.css');
        $rcmail = rcmail::get_instance();
        $rcmail->config->set('product_name', 'VIP · Webmail');
        $rcmail->config->set('skin_logo', 'plugins/vip_theme/logo.svg');
    }
}
