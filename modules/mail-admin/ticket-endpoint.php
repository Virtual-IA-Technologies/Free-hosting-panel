<?php
// Local bridge for shared applications whose PHP correctly disables process execution.
header('Content-Type: application/json');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
if(!in_array($_SERVER['REMOTE_ADDR']??'',['127.0.0.1','::1'],true)||($_SERVER['REQUEST_METHOD']??'')!=='POST') {http_response_code(403);exit('{"ok":false}');}
$token=$_POST['ticket']??'';$ip=$_POST['ip']??'';
if((int)($_SERVER['CONTENT_LENGTH']??0)>1024||!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token)||!is_string($ip)||!filter_var($ip,FILTER_VALIDATE_IP)) {http_response_code(400);exit('{"ok":false}');}
$process=proc_open(['/usr/bin/sudo','-n','/usr/local/hestia/bin/v-vip-mail-admin','consume',$token,$ip],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
if(!is_resource($process)){http_response_code(503);exit('{"ok":false}');}
fclose($pipes[0]);$raw=stream_get_contents($pipes[1],8192);fclose($pipes[1]);stream_get_contents($pipes[2],4096);fclose($pipes[2]);$status=proc_close($process);
$value=json_decode($raw,true);if($status!==0||!is_array($value)||empty($value['ok'])){http_response_code(403);exit('{"ok":false}');}
echo json_encode($value,JSON_INVALID_UTF8_SUBSTITUTE);
