<?php
header('Cache-Control: no-store');session_name('VipSqlAdminSession');session_start();$_SESSION=[];session_destroy();setcookie('VipSqlAdminSession','',['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true]);header('Location: index.php');exit;
