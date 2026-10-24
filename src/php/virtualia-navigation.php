<?php
// Extension loaded by Hestia's authenticated template; direct requests disclose nothing.
if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['token'])) {
    echo '<link rel="stylesheet" href="/css/virtualia/appearance.css?v=0.3.3">';
    echo '<script defer src="/js/virtualia/appearance.js?v=0.3.3"></script>';
}
if (empty($_SESSION['userContext']) || empty($_SESSION['user'])) {
    if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['token'])) {
        echo '<script defer src="/js/virtualia/login.js?v=0.3.3"></script>';
    }
    return;
}
$viaAdmin = $_SESSION['userContext'] === 'admin' && empty($_SESSION['look']);
$viaContext = ['admin' => $viaAdmin, 'user' => (string) $_SESSION['user'], 'csrfToken' => (string) ($_SESSION['token'] ?? '')];
if ($viaAdmin) {
    $viaMemory = [];
    foreach (file('/proc/meminfo', FILE_IGNORE_NEW_LINES) ?: [] as $viaLine) {
        if (preg_match('/^(MemTotal|MemAvailable|MemFree|Cached|Buffers|SwapTotal|SwapFree):\s+(\d+)/', $viaLine, $viaMatch)) {
            $viaMemory[$viaMatch[1]] = (int) $viaMatch[2];
        }
    }
    $viaTotal = @disk_total_space('/');
    $viaFree = @disk_free_space('/');
    $viaNetwork = [];
    foreach (@file('/proc/net/dev', FILE_IGNORE_NEW_LINES) ?: [] as $viaLine) {
        if (preg_match('/^\s*([^:]+):\s*(.+)$/', $viaLine, $viaMatch) && trim($viaMatch[1]) !== 'lo') {
            $viaValues = preg_split('/\s+/', trim($viaMatch[2]));
            if (count($viaValues) >= 16) {
                $viaNetwork[] = ['name' => trim($viaMatch[1]), 'received' => (int) $viaValues[0], 'sent' => (int) $viaValues[8], 'rxPackets' => (int) $viaValues[1], 'txPackets' => (int) $viaValues[9], 'errors' => (int) $viaValues[2] + (int) $viaValues[10]];
            }
        }
    }
    $viaContext['server'] = [
        'host' => gethostname(),
        'load' => sys_getloadavg() ?: null,
        'memoryTotal' => $viaMemory['MemTotal'] ?? null,
        'memoryAvailable' => $viaMemory['MemAvailable'] ?? null,
        'swapTotal' => $viaMemory['SwapTotal'] ?? null,
        'swapFree' => $viaMemory['SwapFree'] ?? null,
        'memoryFree' => $viaMemory['MemFree'] ?? null,
        'memoryCached' => $viaMemory['Cached'] ?? null,
        'memoryBuffers' => $viaMemory['Buffers'] ?? null,
        'network' => $viaNetwork,
        'cpuCount' => preg_match_all('/^cpu[0-9]+\s/m', @file_get_contents('/proc/stat') ?: '') ?: 1,
        'diskTotal' => $viaTotal ?: null,
        'diskFree' => $viaFree === false ? null : $viaFree,
        'uptime' => (float) (@file_get_contents('/proc/uptime') ?: 0),
    ];
}
?>
<link rel="stylesheet" href="/css/virtualia/navigation.css?v=0.3.3">
<script type="application/json" id="via-context"><?= json_encode($viaContext, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE) ?></script>
<script defer src="/js/virtualia/navigation.js?v=0.3.3"></script>
<script defer src="/js/virtualia/resources.js?v=0.3.3"></script>
