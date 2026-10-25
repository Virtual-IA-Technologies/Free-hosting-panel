<?php
require_once $_SERVER['DOCUMENT_ROOT'].'/inc/main.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function vip_activity_reply($status,$value){http_response_code($status);echo json_encode($value,JSON_INVALID_UTF8_SUBSTITUTE|JSON_UNESCAPED_UNICODE);exit;}
if(($_SESSION['userContext']??'')!=='admin'||($_SESSION['role']??'')!=='admin'||!empty($_SESSION['look'])||empty($_SESSION['user']))vip_activity_reply(403,['ok'=>false,'error'=>'Se requiere la sesión principal del administrador.']);
if(($_SERVER['REQUEST_METHOD']??'')!=='POST')vip_activity_reply(405,['ok'=>false,'error'=>'Usa POST.']);
if((int)($_SERVER['CONTENT_LENGTH']??0)>8192||!empty($_FILES))vip_activity_reply(413,['ok'=>false,'error'=>'Solicitud demasiado grande.']);
if(!isset($_POST['token'])||!is_string($_POST['token'])||!verify_csrf($_POST,true))vip_activity_reply(403,['ok'=>false,'error'=>'Token no válido.']);
if(array_diff(array_keys($_POST),['token','action','ticket','confirm','policy']))vip_activity_reply(400,['ok'=>false,'error'=>'Parámetros no permitidos.']);
foreach($_POST as $value)if(!is_string($value))vip_activity_reply(400,['ok'=>false,'error'=>'Parámetro no válido.']);
$request=array_intersect_key($_POST,array_flip(['action','ticket','confirm','policy']));
$request['ip']=(string)($_SERVER['REMOTE_ADDR']??'');
$request['actor']=(string)$_SESSION['user'];session_write_close();
$process=proc_open(['/usr/bin/sudo','-n','/usr/local/hestia/bin/v-vip-activity-admin'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
if(!is_resource($process))vip_activity_reply(503,['ok'=>false,'error'=>'Módulo no disponible.']);
fwrite($pipes[0],json_encode($request));fclose($pipes[0]);$raw=stream_get_contents($pipes[1],2097152);fclose($pipes[1]);stream_get_contents($pipes[2],4096);fclose($pipes[2]);$status=proc_close($process);
$value=json_decode($raw,true);if(!is_array($value))vip_activity_reply(503,['ok'=>false,'error'=>'Respuesta no válida del módulo.']);
vip_activity_reply($status===0?200:400,$value);
