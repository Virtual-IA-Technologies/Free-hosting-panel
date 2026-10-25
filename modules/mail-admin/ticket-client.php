<?php
function vip_consume_ticket($token,$ip) {
    $settings=json_decode(file_get_contents('/usr/local/lib/virtualia-mail-admin/bridge.json'),true);
    $port=(int)($settings['port']??8083);if($port<1||$port>65535)return null;
    // Fixed loopback destination only: retain shared-PHP process restrictions.
    // No redirects, browser cookies, arbitrary URL or external network destination.
    $context=stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/x-www-form-urlencoded\r\nConnection: close\r\n",'content'=>http_build_query(['ticket'=>$token,'ip'=>$ip]),'timeout'=>10,'follow_location'=>0,'ignore_errors'=>true],
        'ssl'=>['verify_peer'=>false,'verify_peer_name'=>false]]);
    $raw=@file_get_contents('https://127.0.0.1:'.$port.'/vip/mail-ticket/',false,$context,0,8192);
    $value=is_string($raw)?json_decode($raw,true):null;
    return is_array($value)&&!empty($value['ok'])?$value:null;
}
