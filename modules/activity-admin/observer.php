<?php
// Included inside an isolated closure by a root-owned, per-account FPM prepend.
// No cookies, query strings, POST data or session values are collected.
try {
    if (PHP_SAPI !== 'fpm-fcgi' || !isset($activityDirectory) || !is_dir($activityDirectory)) return;
    $pid = getmypid();
    $path = $activityDirectory . '/' . $pid . '.json';
    $nonce = bin2hex(random_bytes(8));
    $value = ['pid'=>$pid,'nonce'=>$nonce,'started'=>(float)($_SERVER['REQUEST_TIME_FLOAT']??microtime(true)),
        'ip'=>(string)($_SERVER['REMOTE_ADDR']??''),'method'=>(string)($_SERVER['REQUEST_METHOD']??''),
        'path'=>(string)(parse_url((string)($_SERVER['REQUEST_URI']??''),PHP_URL_PATH)?:'/'),
        'script'=>(string)($_SERVER['SCRIPT_FILENAME']??'')];
    // Never follow a file prepared by the account. Atomic replacement creates our own file.
    $temp = $activityDirectory . '/.' . $pid . '-' . $nonce;
    if (@file_put_contents($temp,json_encode($value,JSON_INVALID_UTF8_SUBSTITUTE),LOCK_EX) === false) return;
    @chmod($temp,0600);
    if (!@rename($temp,$path)) { @unlink($temp); return; }
    register_shutdown_function(static function() use ($path,$nonce) {
        $current = @lstat($path);
        if (!$current || ($current['mode'] & 0170000) !== 0100000) return;
        $value = json_decode((string)@file_get_contents($path),true);
        if (is_array($value) && hash_equals($nonce,(string)($value['nonce']??''))) @unlink($path);
    });
} catch (Throwable $ignored) {
    // Observation failure must never change an application's response.
}
