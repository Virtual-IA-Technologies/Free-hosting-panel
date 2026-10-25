<?php
// Loaded by native FileGator after its session is available. No independent login.
$vipActor = $_SESSION['user'] ?? '';
$vipRole = $_SESSION['userContext'] ?? '';
$vipRoot = $vipRole === 'admin' && empty($_SESSION['look']);
$vipActive = $vipActor && $vipRole && !empty($_SESSION['token']);
$vipTimeout = (int)($_SESSION['INACTIVE_SESSION_TIMEOUT'] ?? 0) * 60;
$vipActive = $vipActive && $vipTimeout > 0 && (int)($_SESSION['LAST_ACTIVITY'] ?? 0) + $vipTimeout >= time();

if (isset($_GET['vip_folder_size'])) {
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    if (!$vipActive || ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' ||
        !hash_equals((string)$_SESSION['token'], (string)($_POST['token'] ?? ''))) {
        http_response_code(403); echo json_encode(['error'=>'Acceso denegado']); exit;
    }
    $vipEffective = $vipRole === 'admin' && !empty($_SESSION['look']) ? $_SESSION['look'] : $vipActor;
    $vipInput = ['path'=>(string)($_POST['path'] ?? ''), 'root'=>$vipRoot];
    $vipProcess = proc_open(['/usr/bin/sudo','-n','/usr/local/hestia/bin/v-vip-root-files',
        $vipEffective,'size',base64_encode(json_encode($vipInput))],
        [0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']], $vipPipes);
    fclose($vipPipes[0]); $vipResult=stream_get_contents($vipPipes[1]); fclose($vipPipes[1]);
    $vipError=stream_get_contents($vipPipes[2]); fclose($vipPipes[2]);
    if (proc_close($vipProcess)!==0) { http_response_code(422); echo json_encode(['error'=>trim($vipError) ?: 'No se pudo calcular']); }
    else echo $vipResult;
    exit;
}

if ($vipActive && $vipRoot) {
    require_once __DIR__.'/RootAdapter.php';
    $dist_config['services']['Filegator\\Services\\Storage\\Filesystem']['config']['adapter'] = function () use ($vipActor) {
        $last = (int)($_SESSION['LAST_ACTIVITY'] ?? 0);
        $timeout = (int)($_SESSION['INACTIVE_SESSION_TIMEOUT'] ?? 60) * 60;
        if ($last && time()-$last > $timeout) throw new \RuntimeException('Session expired');
        return new \Virtualia\RootAdapter($vipActor);
    };
    // Hestia's archive helper is confined to an account home. Do not use it as root.
    $dist_config['services']['Filegator\\Services\\Auth\\AuthInterface']['config']['permissions'] = ['read','write','upload','download','chmod'];
}
