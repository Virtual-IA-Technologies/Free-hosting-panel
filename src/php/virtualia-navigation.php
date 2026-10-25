<?php
// Extension loaded by Hestia's authenticated template; direct requests disclose nothing.
$viaSettings = json_decode(@file_get_contents(dirname(__DIR__) . '/virtualia/config.json') ?: '{}', true);
$viaSettings = is_array($viaSettings) ? $viaSettings : [];
$viaOptions = ['defaultTheme' => $viaSettings['defaultTheme'] ?? 'night', 'appName' => $viaSettings['appName'] ?? 'VIP - Virtual IA Panel', 'integratedFiles' => $viaSettings['integratedFiles'] ?? true, 'assetVersion' => $viaSettings['assetVersion'] ?? '1.2.2'];
$viaOptions['loginTheme'] = $viaSettings['loginTheme'] ?? 'graphite';
$viaOptions['phpmyadminPort'] = (int) ($viaSettings['phpmyadminPort'] ?? 0);
$viaOptions['accountPort'] = (int) ($viaSettings['accountPort'] ?? 0);
$viaOptions['webmailPort'] = (int) ($viaSettings['webmailPort'] ?? 0);
$viaVersion = rawurlencode((string) ($viaSettings['assetVersion'] ?? '1.2.2'));
if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['token'])) {
    $viaAsset = !empty($_SESSION['userContext']) && !empty($_SESSION['user']) ? 'panel' : 'login';
    echo '<link rel="stylesheet" href="/css/virtualia/' . $viaAsset . '.min.css?v=' . $viaVersion . '">';
}
if (empty($_SESSION['userContext']) || empty($_SESSION['user'])) {
    if (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['token'])) {
        echo '<script type="application/json" id="via-context">' . json_encode($viaOptions, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE) . '</script>';
        echo '<script defer src="/js/virtualia/login.min.js?v=' . $viaVersion . '"></script>';
    }
    return;
}
$viaAdmin = $_SESSION['userContext'] === 'admin' && empty($_SESSION['look']);
// A failed asset must leave the native panel accessible instead of an endless loader.
echo '<script>window.vipBootTimer=setTimeout(function(){document.body.classList.add("vip-native-fallback")},8000);</script>';
$viaEffectiveUser = $_SESSION['userContext'] === 'admin' && !empty($_SESSION['look']) ? $_SESSION['look'] : $_SESSION['user'];
$viaContext = ['admin' => $viaAdmin, 'user' => (string) $viaEffectiveUser, 'csrfToken' => (string) ($_SESSION['token'] ?? '')] + $viaOptions;
$viaContext['serverTime']=['epoch'=>time(),'timezone'=>trim(@file_get_contents('/etc/timezone')?:'UTC')];
$viaContext['rootFiles'] = $viaAdmin && is_file('/usr/local/lib/virtualia-root-files/enabled');
$viaContext['folderSizes'] = is_file('/usr/local/lib/virtualia-root-files/enabled');
if ($viaAdmin) {
    $viaPreviews = json_decode(@file_get_contents('/usr/local/lib/virtualia-preview/routes.json') ?: '{}', true);
    $viaContext['previewRoutes'] = is_array($viaPreviews) ? $viaPreviews : [];
    $viaQuickMem=[];
    foreach (@file('/proc/meminfo',FILE_IGNORE_NEW_LINES) ?: [] as $line) if(preg_match('/^(MemTotal|MemAvailable|MemFree|Cached|Buffers|SwapTotal|SwapFree):\s+(\d+)/',$line,$match))$viaQuickMem[$match[1]]=(int)$match[2];
    $viaContext['serverQuick']=['load'=>sys_getloadavg()?:[],'memoryTotal'=>$viaQuickMem['MemTotal']??0,
        'memoryAvailable'=>$viaQuickMem['MemAvailable']??0,'diskTotal'=>@disk_total_space('/')?:0,'diskFree'=>@disk_free_space('/')?:0];
    $viaContext['mailAdmin']=is_file('/usr/local/lib/virtualia-mail-admin/enabled');
    $viaContext['sqlAdmin']=is_file('/usr/local/lib/virtualia-mail-admin/sql-enabled');
}
$viaContext['phpmyadminAlias'] = (string) ($_SESSION['DB_PMA_ALIAS'] ?? 'phpmyadmin');
$viaPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
if ($viaAdmin && defined('HESTIA_CMD') && in_array(rtrim((string) $viaPath, '/'), ['/list/user', '/list/web', '/list/mail', '/list/db', '/list/cron', '/list/key', '/list/stats'], true)) {
    $viaFileUsersOutput = [];
    exec(HESTIA_CMD . 'v-list-users json', $viaFileUsersOutput, $viaFileUsersStatus);
    $viaFileUsers = $viaFileUsersStatus === 0 ? json_decode(implode("\n", $viaFileUsersOutput), true) : null;
    if (is_array($viaFileUsers)) {
        // Hosting inventories exclude system administrators; authentication is unchanged.
        $viaFileUsers = array_filter($viaFileUsers, static fn($info) => ($info['ROLE'] ?? '') !== 'admin');
        $viaContext['fileAdminUser'] = (string) $_SESSION['user'];
        $viaContext['fileAccounts'] = [];
        foreach ($viaFileUsers as $viaFileUser => $viaFileInfo) {
            if (preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/D', (string) $viaFileUser)) {
                $viaContext['fileAccounts'][] = ['user' => (string) $viaFileUser, 'name' => (string) ($viaFileInfo['NAME'] ?? $viaFileUser)];
            }
        }
    }
}
// Safe administration shell: no dependency on an administrator's own cron/key files.
$viaOperationView=rtrim((string)$viaPath,'/')==='/list/user'&&in_array($_GET['vip_view']??'',['cron','keys','bandwidth'],true)?$_GET['vip_view']:null;
if ($viaAdmin && defined('HESTIA_CMD') && ($viaOperationView||in_array(rtrim((string)$viaPath,'/'),['/list/cron','/list/key','/list/stats'],true)) && ($_GET['vip_scope']??'')!=='account') {
    $viaKind=$viaOperationView??['/list/cron'=>'cron','/list/key'=>'keys','/list/stats'=>'bandwidth'][rtrim((string)$viaPath,'/')];
    $viaOps=['kind'=>$viaKind,'rows'=>[],'available'=>is_array($viaFileUsers??null),'failedAccounts'=>0];
    foreach (($viaFileUsers??[]) as $viaOwner=>$viaInfo) {
        if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/D',(string)$viaOwner)) continue;
        if ($viaKind==='bandwidth') {
            $viaOps['rows'][]=['owner'=>(string)$viaOwner,'used'=>(string)($viaInfo['U_BANDWIDTH']??'0'),'limit'=>(string)($viaInfo['BANDWIDTH']??'unlimited'),'suspended'=>($viaInfo['SUSPENDED']??'')==='yes'];
            continue;
        }
        $output=[];$status=1;
        if ($viaKind==='keys'&&!empty($viaContext['mailAdmin'])) {
            exec(HESTIA_CMD.'v-vip-mail-admin list-keys '.escapeshellarg((string)$_SESSION['user']).' '.escapeshellarg((string)$viaOwner),$output,$status);
            $value=json_decode(implode("\n",$output),true);$output=[json_encode($value['data']??null)];if(empty($value['ok']))$status=1;
        } else exec(HESTIA_CMD.($viaKind==='cron'?'v-list-cron-jobs':'v-list-user-ssh-key').' '.escapeshellarg((string)$viaOwner).' json',$output,$status);
        $raw=implode("\n",$output);$records=trim($raw)===''&&$status===0?[]:json_decode($raw,true);
        if ($status!==0||!is_array($records)) {$viaOps['failedAccounts']++;continue;}
        foreach ($records as $id=>$record) {
            if ($viaKind==='keys' && ($record['ID']??'')==='filemanager.ssh.key') continue;
            $row=['owner'=>(string)$viaOwner,'id'=>(string)($viaKind==='cron'?($record['JOB']??$id):$id)];
            if ($viaKind==='cron') $row+=['schedule'=>implode(' ',array_map(static fn($name)=>(string)($record[$name]??'*'),['MIN','HOUR','DAY','MONTH','WDAY'])),'command'=>(string)($record['CMD']??''),'suspended'=>($record['SUSPENDED']??'')==='yes'];
            else $row+=['name'=>(string)($record['ID']??$id),'fingerprint'=>(string)($record['KEY']??'')];
            $viaOps['rows'][]=$row;
        }
    }
    $viaContext['operationsInventory']=$viaOps;
}
if ($viaAdmin && !$viaOperationView && rtrim((string)$viaPath, '/') === '/list/user' && is_array($viaFileUsers ?? null)) {
    $viaContext['accountsInventory']=[];
    foreach ($viaFileUsers as $viaOwner=>$viaOwnerInfo) {
        if (($viaOwnerInfo['ROLE'] ?? '') === 'admin') continue;
        if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/D',(string)$viaOwner)) continue;
        $output=[];$status=1;exec(HESTIA_CMD.'v-list-web-domains '.escapeshellarg((string)$viaOwner).' json',$output,$status);
        $web=$status===0?json_decode(implode("\n",$output),true):[];$domains=[];$ips=[];
        foreach ((is_array($web)?$web:[]) as $domain=>$info) { $domains[]=(string)$domain;if(!empty($info['IP']))$ips[]=(string)$info['IP']; }
        usort($domains,static function($a,$b){return substr_count($a,'.')<=>substr_count($b,'.') ?: strcmp($a,$b);});
        $viaContext['accountsInventory'][]=['user'=>(string)$viaOwner,'contact'=>(string)($viaOwnerInfo['CONTACT']??''),
            'created'=>(string)($viaOwnerInfo['DATE']??''),'quota'=>(string)($viaOwnerInfo['DISK_QUOTA']??''),
            'disk'=>(string)($viaOwnerInfo['U_DISK']??'0'),'traffic'=>(string)($viaOwnerInfo['U_BANDWIDTH']??'0'),
            'plan'=>(string)($viaOwnerInfo['PACKAGE']??''),'suspended'=>($viaOwnerInfo['SUSPENDED']??'')==='yes',
            'domains'=>$domains,'ips'=>array_values(array_unique($ips))];
    }
}
// Inventory is read only, administrator-only and queried only on the web list.
if ($viaAdmin && rtrim((string) $viaPath, '/') === '/list/web' && defined('HESTIA_CMD') && ($_GET['vip_scope'] ?? '') !== 'account') {
    $viaInventory = ['rows' => [], 'failedAccounts' => 0, 'available' => false];
    $viaUsers = $viaFileUsers ?? null;
    if (is_array($viaUsers)) {
        $viaInventory['available'] = true;
        foreach ($viaUsers as $viaOwner => $viaOwnerInfo) {
            if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/D', (string) $viaOwner)) {
                $viaInventory['failedAccounts']++;
                continue;
            }
            $viaWebOutput = [];
            exec(HESTIA_CMD . 'v-list-web-domains ' . escapeshellarg((string) $viaOwner) . ' json', $viaWebOutput, $viaWebStatus);
            $viaDomains = $viaWebStatus === 0 ? json_decode(implode("\n", $viaWebOutput), true) : null;
            if (!is_array($viaDomains)) {
                $viaInventory['failedAccounts']++;
                continue;
            }
            foreach ($viaDomains as $viaDomain => $viaDomainInfo) {
                $viaInventory['rows'][] = [
                    'domain' => (string) $viaDomain, 'owner' => (string) $viaOwner,
                    'ownerName' => (string) ($viaOwnerInfo['NAME'] ?? $viaOwner),
                    'aliases' => (string) ($viaDomainInfo['ALIAS'] ?? ''),
                    'ip' => (string) ($viaDomainInfo['IP'] ?? ''),
                    'ssl' => ($viaDomainInfo['SSL'] ?? '') === 'yes',
                    'suspended' => ($viaDomainInfo['SUSPENDED'] ?? '') === 'yes',
                    'disk' => (string) ($viaDomainInfo['U_DISK'] ?? '0'),
                ];
            }
        }
    }
    $viaContext['domainsInventory'] = $viaInventory;
}
// Query only the service being viewed. Never send passwords, hashes or SSO keys.
if ($viaAdmin && defined('HESTIA_CMD') && in_array(rtrim((string)$viaPath, '/'), ['/list/mail','/list/db'], true)
    && ($_GET['vip_scope'] ?? '') !== 'account' && empty($_GET['domain'])) {
    $viaService = rtrim((string)$viaPath, '/') === '/list/mail' ? 'mail' : 'db';
    $viaServiceInventory = ['rows'=>[], 'available'=>is_array($viaFileUsers ?? null), 'failedAccounts'=>0];
    $viaReadService = static function ($command, $arguments) {
        $output=[]; $status=1;
        exec(HESTIA_CMD.$command.' '.implode(' ',array_map('escapeshellarg',$arguments)).' json', $output, $status);
        $result=$status===0 ? json_decode(implode("\n",$output),true) : null;
        return is_array($result) ? $result : null;
    };
    foreach (($viaFileUsers ?? []) as $viaOwner=>$viaOwnerInfo) {
        if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/D', (string)$viaOwner)) continue;
        $viaRecords=$viaReadService($viaService==='mail'?'v-list-mail-domains':'v-list-databases',[(string)$viaOwner]);
        if ($viaRecords===null) { $viaServiceInventory['failedAccounts']++; continue; }
        foreach ($viaRecords as $viaName=>$viaInfo) {
            $viaCommon=['owner'=>(string)$viaOwner,'ownerName'=>(string)($viaOwnerInfo['NAME']??$viaOwner),
                'suspended'=>($viaInfo['SUSPENDED']??'')==='yes'];
            if ($viaService==='db') {
                $viaServiceInventory['rows'][]=$viaCommon+['name'=>(string)$viaName,'dbuser'=>(string)($viaInfo['DBUSER']??''),
                    'type'=>(string)($viaInfo['TYPE']??''),'host'=>(string)($viaInfo['HOST']??''),'disk'=>(string)($viaInfo['U_DISK']??'0')];
            } else {
                $viaMailboxes=$viaReadService('v-list-mail-accounts',[(string)$viaOwner,(string)$viaName]);
                if ($viaMailboxes===null) { $viaServiceInventory['failedAccounts']++; continue; }
                if (!$viaMailboxes) $viaMailboxes=[''=>[]];
                foreach ($viaMailboxes as $viaMailbox=>$viaMailboxInfo) {
                    $viaServiceInventory['rows'][]=$viaCommon+['domain'=>(string)$viaName,'account'=>(string)$viaMailbox,
                        'accountSuspended'=>($viaMailboxInfo['SUSPENDED']??'')==='yes',
                        'forward'=>(string)($viaMailboxInfo['FWD']??''),'disk'=>(string)($viaMailboxInfo['U_DISK']??'0'),
                        'quota'=>(string)($viaMailboxInfo['QUOTA']??'')];
                }
            }
        }
    }
    $viaContext[$viaService==='mail'?'mailInventory':'databasesInventory']=$viaServiceInventory;
}
if ($viaAdmin && in_array(rtrim((string) $viaPath, '/'), ['/list/user', '/list/server'], true)) {
    // Reuse this request's toolbar snapshot: no duplicate proc reads or disk probes.
    $viaMemory = $viaQuickMem;
    $viaTotal = $viaContext['serverQuick']['diskTotal'];
    $viaFree = $viaContext['serverQuick']['diskFree'];
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
        'load' => $viaContext['serverQuick']['load'] ?: null,
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
<script type="application/json" id="via-context"><?= json_encode($viaContext, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE) ?></script>
<script defer src="/js/virtualia/panel.min.js?v=<?= $viaVersion ?>"></script>
