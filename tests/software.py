"""Broker safety checks with fake packages, private temp state and no system writes."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('software_agent',ROOT/'scripts/software_agent.py')
agent=importlib.util.module_from_spec(spec);spec.loader.exec_module(agent)

class BrokerTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.base=Path(self.temp.name)
        for key,value in {'STATE':self.base/'state','ROOT':self.base/'hestia','PHP_ETC':self.base/'php','POLICY_PATH':ROOT/'src/admin/software-policy.json'}.items():
            item=patch.object(agent,key,value);item.start();self.addCleanup(item.stop)
        agent.ROOT.mkdir();agent.STATE.mkdir();agent.PHP_ETC.mkdir()
        item=patch.object(agent,'active_services',return_value=[]);item.start();self.addCleanup(item.stop)
        self.broker=agent.Broker()
    def mock(self,name,**kwargs):
        item=patch.object(agent,name,**kwargs);result=item.start();self.addCleanup(item.stop);return result
    def baseline(self):
        self.mock('installed_packages',return_value={'php8.4-fpm':'8.4.26','nginx':'1.26.0'})
        self.mock('usage',return_value=({},'8.4',set()))
        self.mock('php_alternative',return_value={'value':'/usr/bin/php8.4','status':'manual'})
    def plan(self):
        result={'operation':{'kind':'refresh'},'title':'Indices','changes':[],'modules':[],'arguments':[],'databaseBackup':False,'fingerprint':'initial'}
        self.mock('make_plan',return_value=result)
        return self.broker.request({'action':'plan','actor':'admin','operation':{'kind':'refresh'}})
    def test_bad_operations_and_extra_fields(self):
        invalid=[None,[],{'kind':[]},{'kind':'shell','command':'id'},{'kind':'refresh','command':'id'},
                 {'kind':'upgrade','component':[]},{'kind':'upgrade','component':'../../root'},
                 {'kind':'php_install','version':[]},{'kind':'php_install','version':'8.4;id'},
                 {'kind':'php_extensions','version':'8.4','enabled':{'curl':'false'}},
                 {'kind':'php_extensions','version':'8.4','enabled':{'../../tmp':True}}]
        for op in invalid:
            with self.subTest(op=op),self.assertRaises(ValueError):agent.validate_operation(op)
        for value in [{'action':'inventory','actor':'../../root'},{'action':[],'actor':'admin'},{'action':'inventory','actor':'admin','command':'id'}]:
            with self.assertRaises(ValueError):self.broker.request(value)
    def test_simulation_rejects_removal_sql_branch_and_unparsed_lines(self):
        for text in ['Remv nginx [1.26.0]','Purg nginx [1.26.0]','Inst mystery ???',
                     'Inst mariadb-server [1:10.11.8] (1:11.4.2 stable [amd64])',
                     'Inst mysql-server (8.0.1 stable [amd64])']:
            with self.subTest(text=text),self.assertRaises(ValueError):agent.parse_simulation(text)
        self.mock('newer',return_value=False)
        self.assertEqual(agent.parse_simulation('Inst nginx [1.26.0] (1.26.1 repo [amd64])')[0]['to'],'1.26.1')
    def test_simulation_rejects_downgrade(self):
        self.mock('newer',return_value=True)
        with self.assertRaisesRegex(ValueError,'degradaria'):agent.parse_simulation('Inst nginx [1.26.1] (1.26.0 repo [amd64])')
    def test_pins_simulated_dependencies(self):
        self.baseline();changes=[{'package':'nginx','from':'1.26.0','to':'1.26.1'}]
        simulate=self.mock('simulate',return_value=changes);self.mock('fingerprint',return_value='initial')
        plan=agent.make_plan({'kind':'upgrade','component':'nginx'})
        self.assertEqual(plan['arguments'],['install','nginx=1.26.1']);self.assertEqual(simulate.call_count,2)
    def test_rejects_branch_change(self):
        self.baseline();self.mock('simulate',return_value=[{'package':'nginx','from':'1.26.0','to':'1.28.0'}])
        with self.assertRaisesRegex(ValueError,'rama'):agent.make_plan({'kind':'upgrade','component':'nginx'})
    def test_protects_shared_extensions_without_detected_pool(self):
        self.baseline()
        with self.assertRaisesRegex(ValueError,'protegida'):agent.make_plan({'kind':'php_extensions','version':'8.4','enabled':{'mysql':False}})
    def test_confirmation_expiry_actor_and_inventory(self):
        plan=self.plan();path=agent.STATE/'plans'/(plan['id']+'.json')
        request={'action':'apply','actor':'admin','plan':plan['id'],'confirm':True}
        for changes,message in [({'confirm':False},'Confirma'),({'actor':'other'},'administrador')]:
            with self.assertRaisesRegex(ValueError,message):self.broker.request({**request,**changes})
        saved=copy.deepcopy(plan);saved['expires']=time.time()-1;agent.atomic(path,saved)
        with self.assertRaisesRegex(ValueError,'vencido'):self.broker.request(request)
        agent.atomic(path,plan);agent.make_plan.return_value={**plan,'fingerprint':'changed'}
        with self.assertRaisesRegex(ValueError,'inventario'):self.broker.request(request)
        self.assertFalse(self.broker.lock.locked())
    def test_single_use_and_exclusive_worker(self):
        plan=self.plan();started=threading.Event();release=threading.Event()
        def execute(job):
            started.set();release.wait(3);self.broker.active=None;self.broker.lock.release()
        self.broker.execute=execute
        request={'action':'apply','actor':'admin','plan':plan['id'],'confirm':True}
        try:
            result=self.broker.request(request);self.assertTrue(started.wait(1));self.assertIn('job',result)
            with self.assertRaisesRegex(ValueError,'ejecucion'):self.broker.request(request)
            with self.assertRaisesRegex(ValueError,'ejecucion'):self.broker.request({'action':'plan','actor':'admin','operation':{'kind':'refresh'}})
        finally:release.set()
        for _ in range(100):
            if not self.broker.lock.locked():break
            time.sleep(.01)
        with self.assertRaises(FileNotFoundError):self.broker.request(request)
    def test_plan_edit_and_job_ownership(self):
        with self.assertRaises(ValueError):self.broker.request({'action':'apply','actor':'admin','plan':'../bad','confirm':True})
        key='a'*32;agent.atomic(agent.STATE/'jobs'/(key+'.json'),{'actor':'other','plan':{'secret':'private'}})
        with self.assertRaisesRegex(ValueError,'pertenece'):self.broker.request({'action':'job','actor':'admin','job':key})
    def test_stopping_rejects_mutations(self):
        self.broker.stopping=True
        with self.assertRaisesRegex(ValueError,'deteniendo'):self.broker.request({'action':'plan','actor':'admin','operation':{'kind':'refresh'}})
        self.assertTrue(self.broker.request({'action':'status','actor':'admin'})['stopping'])
    def test_interrupted_job_blocks_new_plans(self):
        agent.atomic(agent.STATE/'jobs'/('a'*32+'.json'),{'id':'a'*32,'state':'interrupted'})
        broker=agent.Broker()
        self.assertTrue(broker.request({'action':'status','actor':'admin'})['recoveryRequired'])
        with self.assertRaisesRegex(ValueError,'interrumpida'):broker.request({'action':'plan','actor':'admin','operation':{'kind':'refresh'}})
    def test_php_install_plan_records_current_alternative(self):
        self.baseline();self.mock('native_php_script',return_value='reviewed native configuration')
        (agent.ROOT/'install/upgrade').mkdir(parents=True);(agent.ROOT/'install/upgrade/upgrade.conf').write_text("multiphp_v='8.4 8.5'")
        (agent.ROOT/'conf').mkdir();(agent.ROOT/'conf/hestia.conf').write_text("DB_SYSTEM='mysql'\n")
        self.mock('simulate',return_value=[{'package':'php8.5-fpm','from':None,'to':'8.5.12'}]);self.mock('fingerprint',return_value='initial')
        agent.php_alternative.return_value={'value':'/usr/bin/php8.4','status':'auto'}
        plan=agent.make_plan({'kind':'php_install','version':'8.5'})
        self.assertEqual(plan['phpAlternative']['value'],'/usr/bin/php8.4')
        self.assertTrue(any('modo manual' in w for w in plan['warnings']))
    def test_php_install_locks_existing_default_before_apt(self):
        self.mock('fingerprint',return_value='initial');self.mock('backup_paths',return_value=[])
        changes=[{'package':'php8.5-fpm','from':None,'to':'8.5.12'}]
        self.mock('simulate',return_value=changes);self.mock('installed_packages',return_value={'php8.5-fpm':'8.5.12'})
        self.mock('native_php_script',return_value='# reviewed configuration')
        alternative={'value':'/usr/bin/php8.4','status':'auto'};self.mock('php_alternative',return_value=alternative)
        calls=[]
        def process(args,**kwargs):
            from io import StringIO
            calls.append(args);p=unittest.mock.Mock();p.stdout=StringIO('');p.wait.return_value=0;return p
        job={'id':'a'*32,'actor':'admin','title':'test','state':'queued','started':agent.now(),'log':[],
             'plan':{'operation':{'kind':'php_install','version':'8.5'},'fingerprint':'initial','arguments':['install','php8.5-fpm=8.5.12'],
                     'changes':changes,'modules':[],'databaseBackup':False,'phpAlternative':alternative}}
        with patch.object(agent.subprocess,'Popen',side_effect=process):
            self.broker.lock.acquire();self.broker.execute(job)
        self.assertEqual(job['state'],'succeeded',job.get('error'))
        self.assertEqual(calls[0],['update-alternatives','--set','php','/usr/bin/php8.4'])
        self.assertEqual(calls[1][0],'apt-get');self.assertIn('--no-remove',calls[1])
    def test_module_verification_uses_real_output(self):
        self.mock('run',return_value=subprocess.CompletedProcess([],0,stdout='[PHP Modules]\n',stderr=''))
        with self.assertRaisesRegex(ValueError,'efectivo'):agent.verify_modules('8.4',[{'name':'gd','modules':['gd'],'enabled':True}])
    def test_restores_module_links_after_failed_fpm_validation(self):
        version='8.4'
        for sapi in ['cli','fpm']:
            path=agent.PHP_ETC/version/sapi/'conf.d';path.mkdir(parents=True);(path/'20-before.ini').write_text('previous')
        self.mock('fingerprint',return_value='initial');self.mock('installed_packages',return_value={});self.mock('backup_paths',return_value=[agent.PHP_ETC])
        calls=[]
        def popen(args,**kwargs):
            calls.append(args)
            if args[0]=='phpenmod':
                for sapi in ['cli','fpm']:(agent.PHP_ETC/version/sapi/'conf.d/20-before.ini').write_text('changed')
            if args==['php-fpm8.4','-t'] and calls.count(args)==1:raise ValueError('FPM invalid')
            from io import StringIO
            obj=unittest.mock.Mock();obj.stdout=StringIO('');obj.wait.return_value=0;return obj
        self.mock('run',return_value=subprocess.CompletedProcess([],0,stdout='',stderr=''))
        with patch.object(agent.subprocess,'Popen',side_effect=popen):
            job={'id':'a'*32,'actor':'admin','title':'test','state':'queued','started':agent.now(),'log':[],
                 'plan':{'operation':{'kind':'php_extensions','version':version},'fingerprint':'initial','arguments':[],'changes':[],
                         'modules':[{'name':'gd','modules':['gd'],'enabled':True}],'databaseBackup':False}}
            self.broker.lock.acquire();self.broker.active=job['id'];self.broker.execute(job)
        self.assertEqual(job['state'],'failed');self.assertTrue(job['configurationRestored'])
        for sapi in ['cli','fpm']:self.assertEqual((agent.PHP_ETC/version/sapi/'conf.d/20-before.ini').read_text(),'previous')
        self.assertTrue((agent.STATE/'audit.jsonl').is_file());self.assertIsNone(self.broker.active);self.assertFalse(self.broker.lock.locked())
        if os.name=='posix':self.assertEqual((agent.STATE/'jobs'/(job['id']+'.json')).stat().st_mode&0o777,0o600)
    def test_failed_database_dump_prevents_package_installation(self):
        self.mock('fingerprint',return_value='initial');self.mock('installed_packages',return_value={});self.mock('simulate',return_value=[]);self.mock('backup_paths',return_value=[])
        with patch.object(agent.shutil,'which',return_value=None),patch.object(agent.subprocess,'Popen') as process:
            job={'id':'a'*32,'actor':'admin','title':'test','state':'queued','started':agent.now(),'log':[],
                 'plan':{'operation':{'kind':'upgrade','component':'database'},'fingerprint':'initial','arguments':[],'changes':[],'modules':[],'databaseBackup':True}}
            self.broker.lock.acquire();self.broker.execute(job);self.assertEqual(job['state'],'failed');process.assert_not_called()
    def test_native_installer_adapter_fails_closed(self):
        target=agent.ROOT/'bin/v-add-web-php';target.parent.mkdir();target.write_text('apt-get remove nginx')
        with self.assertRaises(ValueError):agent.native_php_script()
    def test_fingerprint_detects_package_changes(self):
        self.baseline();a=agent.fingerprint();agent.installed_packages.return_value['nginx']='1.26.1';self.assertNotEqual(a,agent.fingerprint())

if __name__=='__main__':unittest.main()
