<?php
// A separate native signon session keeps administrative and client SQL scopes apart.
$cfg['Servers'][3]=['verbose'=>'Administración · todas las bases','host'=>'localhost','port'=>'3306','auth_type'=>'signon',
 'SignonSession'=>'VipSqlAdminSession','SignonURL'=>'vip-admin-sso.php','LogoutURL'=>'vip-admin-logout.php','AllowNoPassword'=>false];
