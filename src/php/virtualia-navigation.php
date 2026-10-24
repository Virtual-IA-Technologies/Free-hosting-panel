<?php
// Extension loaded by Hestia's authenticated template; direct requests disclose nothing.
if (empty($_SESSION['userContext']) || empty($_SESSION['user'])) {
    if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['token'])) {
        echo '<script defer src="/js/virtualia/login.js?v=20261024-3"></script>';
    }
    return;
}
$viaAdmin = $_SESSION['userContext'] === 'admin' && empty($_SESSION['look']);
$viaContext = ['admin' => $viaAdmin, 'user' => (string) $_SESSION['user']];
if ($viaAdmin) {
    $viaMemory = [];
    foreach (file('/proc/meminfo', FILE_IGNORE_NEW_LINES) ?: [] as $viaLine) {
        if (preg_match('/^(MemTotal|MemAvailable):\s+(\d+)/', $viaLine, $viaMatch)) {
            $viaMemory[$viaMatch[1]] = (int) $viaMatch[2];
        }
    }
    $viaTotal = @disk_total_space('/');
    $viaFree = @disk_free_space('/');
    $viaContext['server'] = [
        'host' => gethostname(),
        'load' => sys_getloadavg() ?: null,
        'memoryTotal' => $viaMemory['MemTotal'] ?? null,
        'memoryAvailable' => $viaMemory['MemAvailable'] ?? null,
        'diskTotal' => $viaTotal ?: null,
        'diskFree' => $viaFree === false ? null : $viaFree,
        'uptime' => (float) (@file_get_contents('/proc/uptime') ?: 0),
    ];
}
?>
<link rel="stylesheet" href="/css/virtualia/navigation.css?v=20261024-3">
<script type="application/json" id="via-context"><?= json_encode($viaContext, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE) ?></script>
<script defer src="/js/virtualia/navigation.js?v=20261024-3"></script>
