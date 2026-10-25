<?php
require_once $_SERVER['DOCUMENT_ROOT'].'/inc/main.php';
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
function vip_backup_reply($status,$value){http_response_code($status);header('Content-Type: application/json; charset=utf-8');echo json_encode($value,JSON_INVALID_UTF8_SUBSTITUTE);exit;}
if(($_SESSION['userContext']??'')!=='admin'||($_SESSION['role']??'')!=='admin'||!empty($_SESSION['look']))vip_backup_reply(403,['ok'=>false,'error'=>'Se requiere administrador sin suplantación.']);
$download=($_SERVER['REQUEST_METHOD']??'')==='GET'&&isset($_GET['download']);$input=$download?$_GET:$_POST;
if(!$download&&($_SERVER['REQUEST_METHOD']??'')!=='POST')vip_backup_reply(405,['ok'=>false,'error'=>'Usa POST.']);
if((int)($_SERVER['CONTENT_LENGTH']??0)>32768||!empty($_FILES))vip_backup_reply(413,['ok'=>false,'error'=>'Solicitud demasiado grande.']);
if(!isset($input['token'])||!is_string($input['token'])||!verify_csrf($input,true))vip_backup_reply(403,['ok'=>false,'error'=>'Token no válido.']);
if(array_diff(array_keys($input),['token','action','policy','id','confirm','destination','download']))vip_backup_reply(400,['ok'=>false,'error'=>'Parámetros no permitidos.']);
foreach($input as $value)if(!is_string($value))vip_backup_reply(400,['ok'=>false,'error'=>'Parámetro no válido.']);
$actor=(string)$_SESSION['user'];session_write_close();
$request=array_intersect_key($input,array_flip(['action','policy','id','confirm','destination']));$request['actor']=$actor;if($download){$request['action']='file';$request['id']=$input['download'];}
$process=proc_open(['/usr/bin/sudo','-n','/usr/local/hestia/bin/v-vip-backup-admin'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
if(!is_resource($process))vip_backup_reply(503,['ok'=>false,'error'=>'Módulo no disponible.']);
fwrite($pipes[0],json_encode($request));fclose($pipes[0]);$raw=stream_get_contents($pipes[1],8388608);fclose($pipes[1]);stream_get_contents($pipes[2],4096);fclose($pipes[2]);$status=proc_close($process);$value=json_decode($raw,true);
if(!$download||$status!==0||empty($value['ok']))vip_backup_reply($status===0?200:400,$value?:['ok'=>false,'error'=>'Respuesta no válida.']);
$name=basename($value['data']['name']);header('Content-Type: application/octet-stream');header('Content-Disposition: attachment; filename="'.preg_replace('/[^a-zA-Z0-9._-]/','_',$name).'"');header('Content-Length: '.(int)$value['data']['bytes']);
$process=proc_open(['/usr/bin/sudo','-n','/usr/local/hestia/bin/v-vip-backup-admin','stream',$actor,$request['id']],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
if(!is_resource($process))exit;fclose($pipes[0]);while(!feof($pipes[1])){echo fread($pipes[1],1048576);flush();}fclose($pipes[1]);stream_get_contents($pipes[2],4096);fclose($pipes[2]);proc_close($process);exit;
