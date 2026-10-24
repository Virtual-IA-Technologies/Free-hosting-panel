"""Exercise endpoint gates with a minimal native-auth fixture; no production session."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]

class EndpointTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.php=shutil.which('php')
        if not cls.php:raise unittest.SkipTest('PHP CLI is required')
    def test_native_session_role_token_and_input_gates(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'inc').mkdir()
            endpoint=root/'endpoint.php'
            source=(ROOT/'src/admin/software-endpoint.php').read_text(encoding='utf-8')
            # Isolate the fixture from any real broker installed on the test host.
            endpoint.write_text(source.replace('unix:///run/vip-software/control.sock','unix://'+(root/'absent.sock').as_posix()),encoding='utf-8')
            (root/'inc/main.php').write_text('''<?php
ini_set('session.save_path', __DIR__.'/..');
session_start();
$fixture=json_decode(file_get_contents($argv[1]),true);
$_SESSION=$fixture['session'];
if(empty($_SESSION['user'])) {http_response_code(302);exit;}
// In production main.php fetches the live role, validates IP and expires sessions.
$_SESSION['role']=$fixture['liveRole'];
function verify_csrf($method,$return=false) {return !empty($_SESSION['token']) && isset($method['token']) && hash_equals($_SESSION['token'],$method['token']);}
''')
            runner=root/'runner.php'
            runner.write_text('''<?php
register_shutdown_function(function(){fwrite(STDERR, "STATUS=".(http_response_code()?:200));});
$fixture=json_decode(file_get_contents($argv[1]),true);
$_SERVER['DOCUMENT_ROOT']=__DIR__;
$_SERVER['REQUEST_METHOD']=$fixture['method']??'POST';
$_SERVER['CONTENT_LENGTH']=$fixture['length']??100;
$_POST=$fixture['post'];
require $argv[2];
''')
            base={'session':{'user':'admin','userContext':'admin','token':'test-token'},'liveRole':'admin','post':{'token':'test-token','action':'inventory'}}
            cases=[('without session',{'session':{}},302),('ordinary user',{'liveRole':'user'},403),
                   ('revoked admin role',{'liveRole':'user'},403),
                   ('impersonation',{'session':{**base['session'],'look':'customer'}},403),
                   ('without token',{'post':{'action':'inventory'}},403),
                   ('wrong token',{'post':{'action':'inventory','token':'bad'}},403),
                   ('token array',{'post':{'action':'inventory','token':[]}},403),
                   ('method',{'method':'GET'},405),('size',{'length':65537},413),
                   ('actor injection',{'post':{**base['post'],'actor':'root'}},400),
                   ('unknown action',{'post':{**base['post'],'action':'shell'}},400),
                   ('operation array',{'post':{'token':'test-token','action':'plan','operation':[]}},400),
                   ('no confirmation',{'post':{'token':'test-token','action':'apply','plan':'a'*32,'confirm':'false'}},400),
                   ('admin reaches broker',{},503)]
            for name,overrides,status in cases:
                with self.subTest(name=name):
                    data=root/'input.json';data.write_text(json.dumps({**base,**overrides}))
                    result=subprocess.run([self.php,'-n',str(runner),str(data),str(endpoint)],capture_output=True,text=True)
                    self.assertEqual(result.returncode,0,result.stderr);self.assertIn('STATUS='+str(status),result.stderr)
                    if result.stdout:
                        self.assertTrue(result.stdout.lstrip().startswith('{'),repr(result.stdout))
                        self.assertFalse(json.loads(result.stdout)['ok'])

if __name__=='__main__':unittest.main()
