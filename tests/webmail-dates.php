<?php
class rcube_plugin {
    public array $hooks = [];
    public function include_stylesheet($name) {}
    public function add_hook($name, $callback) { $this->hooks[$name] = $callback; }
}
class TestConfig {
    public array $values = [];
    public function set($key, $value) { $this->values[$key] = $value; }
}
class rcmail {
    public TestConfig $config;
    private static $instance;
    public function __construct() { $this->config = new TestConfig(); }
    public static function get_instance() { return self::$instance ??= new self(); }
}
require __DIR__.'/../src/webmail/vip_theme.php';
$plugin = new vip_theme(); $plugin->init();
$config = rcmail::get_instance()->config;
$config->set('date_format', 'Y-m-d'); $config->set('time_format', 'h:i a');
($plugin->hooks['startup'])([]);
if ($config->values['date_format'] !== 'd/m/Y' || $config->values['time_format'] !== 'H:i'
    || !in_array($config->values['timezone'], DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
    throw new RuntimeException('Webmail dates or server timezone differ');
}
echo "PASS webmail date display after user preferences load\n";
