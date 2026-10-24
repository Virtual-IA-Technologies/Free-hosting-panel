<?php
// Installed only by the optional administrative installer. Native session, IP,
// expiration, live role and origin checks run before contacting the Unix broker.
require_once $_SERVER['DOCUMENT_ROOT'] . '/inc/main.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function vip_software_reply($status, $body) {
    http_response_code($status);
    echo json_encode($body, JSON_INVALID_UTF8_SUBSTITUTE | JSON_UNESCAPED_UNICODE);
    exit;
}
if (($_SESSION['userContext'] ?? '') !== 'admin' || ($_SESSION['role'] ?? '') !== 'admin' || !empty($_SESSION['look']) || empty($_SESSION['user'])) {
    vip_software_reply(403, ['ok' => false, 'error' => 'Se requiere un administrador sin suplantación.']);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    vip_software_reply(405, ['ok' => false, 'error' => 'Usa POST.']);
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 65536 || !empty($_FILES)) {
    vip_software_reply(413, ['ok' => false, 'error' => 'Solicitud demasiado grande.']);
}
if (!isset($_POST['token']) || !is_string($_POST['token']) || !verify_csrf($_POST, true)) {
    vip_software_reply(403, ['ok' => false, 'error' => 'Token de sesión no válido.']);
}
$allowed = ['inventory' => ['token', 'action'], 'plan' => ['token', 'action', 'operation'], 'apply' => ['token', 'action', 'plan', 'confirm'], 'job' => ['token', 'action', 'job']];
$action = $_POST['action'] ?? null;
if (!is_string($action) || !isset($allowed[$action]) || count(array_diff(array_keys($_POST), $allowed[$action])) || count(array_diff($allowed[$action], array_keys($_POST)))) {
    vip_software_reply(400, ['ok' => false, 'error' => 'Acción o parámetros no permitidos.']);
}
foreach ($_POST as $value) {
    if (!is_string($value)) vip_software_reply(400, ['ok' => false, 'error' => 'Parámetro no válido.']);
}
$request = ['action' => $action, 'actor' => (string) $_SESSION['user']];
if ($action === 'plan') {
    $request['operation'] = json_decode($_POST['operation'], true, 8);
    if (!is_array($request['operation']) || json_last_error() !== JSON_ERROR_NONE) vip_software_reply(400, ['ok' => false, 'error' => 'Operación no válida.']);
}
if ($action === 'apply') {
    if ($_POST['confirm'] !== 'true') vip_software_reply(400, ['ok' => false, 'error' => 'Confirma expresamente el plan.']);
    $request += ['plan' => $_POST['plan'], 'confirm' => true];
}
if ($action === 'job') $request['job'] = $_POST['job'];
// Release the native session while package planning is running.
session_write_close();
$socket = @stream_socket_client('unix:///run/vip-software/control.sock', $errno, $errstr, 1);
if (!$socket) vip_software_reply(503, ['ok' => false, 'error' => 'Gestor opcional no instalado o servicio no disponible. Usa las opciones nativas del servidor.']);
stream_set_timeout($socket, 110);
$payload = json_encode($request, JSON_UNESCAPED_UNICODE) . "\n";
$written = 0;
while ($written < strlen($payload)) {
    $count = @fwrite($socket, substr($payload, $written));
    if (!$count) { fclose($socket); vip_software_reply(503, ['ok' => false, 'error' => 'No se pudo contactar al gestor.']); }
    $written += $count;
}
$line = @fgets($socket, 1048577);
fclose($socket);
if (!$line || strlen($line) >= 1048576 || substr($line, -1) !== "\n") vip_software_reply(503, ['ok' => false, 'error' => 'Respuesta incompleta. Consulta el historial antes de reintentar.']);
$response = json_decode($line, true);
if (!is_array($response) || !is_bool($response['ok'] ?? null)) vip_software_reply(503, ['ok' => false, 'error' => 'Respuesta del gestor no válida.']);
vip_software_reply($response['ok'] ? 200 : 400, $response);
