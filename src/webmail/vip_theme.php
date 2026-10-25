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
        $this->add_hook('startup', [$this, 'display_dates']);
        $this->display_dates([]);
    }

    public function display_dates($args)
    {
        $zone = trim(@file_get_contents('/etc/timezone') ?: date_default_timezone_get());
        if (!in_array($zone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
            $zone = 'UTC';
        }
        $config = rcmail::get_instance()->config;
        $config->set('timezone', $zone);
        $config->set('date_format', 'd/m/Y');
        $config->set('time_format', 'H:i');
        return $args;
    }
}
