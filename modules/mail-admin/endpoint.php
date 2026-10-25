<?php
require_once $_SERVER['DOCUMENT_ROOT'].'/inc/main.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
function vip_mail_reply($status,$value){http_response_code($status);echo json_encode($value,JSON_INVALID_UTF8_SUBSTITUTE|JSON_UNESCAPED_UNICODE);exit;}
if(($_SESSION['userContext']??'')!=='admin'||($_SESSION['role']??'')!=='admin'||!empty($_SESSION['look'])||empty($_SESSION['user']))vip_mail_reply(403,['ok'=>false,'error'=>'Se requiere la sesión principal del administrador.']);
if(($_SERVER['REQUEST_METHOD']??'')!=='POST')vip_mail_reply(405,['ok'=>false,'error'=>'Usa POST.']);
if((int)($_SERVER['CONTENT_LENGTH']??0)>8192||!empty($_FILES))vip_mail_reply(413,['ok'=>false,'error'=>'Solicitud demasiado grande.']);
if(!isset($_POST['token'])||!is_string($_POST['token'])||!verify_csrf($_POST,true))vip_mail_reply(403,['ok'=>false,'error'=>'Token no válido.']);
$allowed=['token','action','id','query','owner','domain','account','confirm'];
if(array_diff(array_keys($_POST),$allowed))vip_mail_reply(400,['ok'=>false,'error'=>'Parámetros no admitidos.']);
foreach($_POST as $value)if(!is_string($value))vip_mail_reply(400,['ok'=>false,'error'=>'Parámetro no válido.']);
$request=array_intersect_key($_POST,array_flip(['action','id','query','owner','domain','account','confirm']));
$request['actor']=(string)$_SESSION['user'];$request['ip']=(string)($_SERVER['REMOTE_ADDR']??'');
session_write_close();
$process=proc_open(['/usr/bin/sudo','-n','/usr/local/hestia/bin/v-vip-mail-admin'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
if(!is_resource($process))vip_mail_reply(503,['ok'=>false,'error'=>'Módulo no disponible.']);
fwrite($pipes[0],json_encode($request));fclose($pipes[0]);$response=stream_get_contents($pipes[1],2097152);fclose($pipes[1]);$error=stream_get_contents($pipes[2],4096);fclose($pipes[2]);$status=proc_close($process);
$data=json_decode($response,true);if(!is_array($data))vip_mail_reply(503,['ok'=>false,'error'=>'Respuesta no válida del módulo.']);
vip_mail_reply($status===0?200:400,$data);
