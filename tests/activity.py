"""Security boundaries for the optional activity helper; run on Linux."""
import importlib.util
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('activity',ROOT/'modules/activity-admin/activity-admin.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ActivityTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.state=self.root/'state';self.state.mkdir();(self.state/'signing.key').write_bytes(b'x'*32)
        self.proc=self.root/'proc';(self.proc/'sys/kernel/random').mkdir(parents=True);(self.proc/'sys/kernel/random/boot_id').write_text('fixture-boot')
        self.users=self.root/'users';(self.users/'fixtureadmin').mkdir(parents=True);(self.users/'fixtureadmin/user.conf').write_text("ROLE='admin'\nSUSPENDED='no'\n")
        for name,value in [('STATE',self.state),('PROC',self.proc),('USERS',self.users)]:
            p=patch.object(m,name,value);p.start();self.addCleanup(p.stop)
        self.process={'pid':12345,'uid':1001,'start':77,'pool':'fixture.invalid','executable':'/usr/sbin/php-fpm8.4','eligible':True,'owner':'fixture'}
    def ticket(self,**extra):
        return m.sign({'actor':'fixtureadmin','expires':int(time.time())+60,'boot':'fixture-boot','pid':12345,'process':m.fingerprint(self.process),**extra})
    def test_actor_and_parameters(self):
        for actor in ['../root','root;id',None]:
            with self.assertRaises(ValueError):m.role(actor)
        with self.assertRaises(ValueError):m.handle({'actor':'fixtureadmin','action':'snapshot','pid':1})
        with self.assertRaises(ValueError):m.handle({'actor':'fixtureadmin','action':'shell'})
        with self.assertRaises(ValueError):m.terminate('fixtureadmin',self.ticket(),'false')
    def test_signature_actor_expiry_and_boot(self):
        self.assertEqual(m.verify(self.ticket(),'fixtureadmin')['pid'],12345)
        for ticket,actor in [(self.ticket()+'a','fixtureadmin'),(self.ticket(),'other'),(self.ticket(expires=1),'fixtureadmin'),(self.ticket(boot='other'),'fixtureadmin')]:
            with self.assertRaises(ValueError):m.verify(ticket,actor)
    def test_identity_reuse_and_protection(self):
        for changed in [{'start':78},{'uid':0},{'eligible':False},{'executable':'/usr/sbin/mariadbd'},{'pool':'other.invalid'}]:
            with patch.object(m.os,'pidfd_open',return_value=99,create=True),patch.object(m.os,'close'),patch.object(m,'accounts',return_value={1001:'fixture'}),patch.object(m,'read_process',return_value={**self.process,**changed}),patch.object(m.signal,'pidfd_send_signal',create=True) as send:
                with self.assertRaises(ValueError):m.terminate('fixtureadmin',self.ticket(),'FINALIZAR')
                send.assert_not_called()
    def test_single_signed_sigterm_and_audit(self):
        with patch.object(m.os,'pidfd_open',return_value=99,create=True),patch.object(m.os,'close') as close,patch.object(m,'accounts',return_value={1001:'fixture'}),patch.object(m,'read_process',return_value=self.process),patch.object(m.signal,'pidfd_send_signal',create=True) as send:
            m.terminate('fixtureadmin',self.ticket(),'FINALIZAR')
            send.assert_called_once_with(99,m.signal.SIGTERM);close.assert_called_once_with(99)
            events=[json.loads(l) for l in (self.state/'audit.jsonl').read_text().splitlines()]
            self.assertEqual([e['action'] for e in events],['terminate_intent','terminate_sent'])
    def test_sql_snapshot_never_selects_query_text(self):
        with patch.object(m,'command',return_value='') as cmd:
            self.assertTrue(m.sql_activity()['available'])
            query=cmd.call_args.args[0][-1]
            self.assertNotIn('INFO',query.replace('information_schema',''));self.assertNotIn('KILL',query)

    def test_observer_missing_metadata_does_not_invent_request(self):
        self.assertIsNone(m.active_request({**self.process,'eligible':False}))
        self.assertIsNone(m.active_request(self.process))

    def test_guard_configuration_bounds_and_current_ip_exclusion(self):
        spec=importlib.util.spec_from_file_location('guard',ROOT/'modules/activity-admin/traffic_guard.py')
        guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
        value=guard.validate(dict(guard.DEFAULT),'198.51.100.7')
        self.assertIn('198.51.100.7',value['exclude']);self.assertFalse(value['enabled'])
        normalized=guard.validate({**guard.DEFAULT,'exclude':['198.51.100.7/32','198.51.100.7']},'198.51.100.7')
        self.assertEqual(normalized['exclude'],['198.51.100.7'])
        for change in [{'count':0},{'window':'60'},{'ban':1},{'exclude':[';id']},{'enabled':1}]:
            with self.assertRaises(ValueError):guard.validate({**guard.DEFAULT,**change},'198.51.100.7')

class FirewallTest(unittest.TestCase):
    def setUp(self):
        spec=importlib.util.spec_from_file_location('guard',ROOT/'modules/activity-admin/traffic_guard.py')
        self.g=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.g)
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        for name,value in [('STATE',Path(self.temp.name)),('NATIVE',Path(self.temp.name)/'native')]:
            p=patch.object(self.g,name,value);p.start();self.addCleanup(p.stop)
        self.g.NATIVE.mkdir()
    def test_manual_rejects_self_white_range_and_commands(self):
        g=self.g
        for target in ['198.51.100.7','127.0.0.1','198.51.100.0/24',';id','::1']:
            with patch.object(g,'native') as native:
                with self.assertRaises(ValueError):g.mutate(json.dumps({'operation':'black_add','target':target,'reason':'test'}),'198.51.100.7','fixture')
                native.assert_not_called()
    def test_invalid_action_and_large_whitelist(self):
        g=self.g
        for raw in [{'operation':'shell','target':'198.51.100.1'},{'operation':'black_add','target':'198.51.100.1','reason':''},{'operation':'unban','target':'198.51.100.1','chain':'ALL'}]:
            with self.assertRaises(ValueError):g.mutate(json.dumps(raw),'198.51.100.7','fixture')
        for change in [{'connections':19},{'connectionsEnabled':1},{'exclude':['0.0.0.0/0']},{'exclude':['198.51.100.1']*65}]:
            with self.assertRaises(ValueError):g.validate({**g.DEFAULT,**change},'198.51.100.7')
    def test_native_ban_date_and_reason(self):
        g=self.g
        (g.NATIVE/'banlist.conf').write_text("IP='198.51.100.22' CHAIN='SSH' TIME='10:02:03' DATE='2026-01-01'\n")
        row=g.bans()[0]
        self.assertEqual(row['date'],'2026-01-01 10:02:03');self.assertIn('SSH',row['reason'])
    def test_connection_scan_web_only_and_exclusions(self):
        g=self.g;fixture='0 0 192.0.2.1:443 198.51.100.22:3000\n'*21
        fixture+='0 0 192.0.2.1:22 198.51.100.33:3000\n'*30
        fixture+='0 0 192.0.2.1:443 198.51.100.7:3000\n'*30
        with patch.object(g,'settings',return_value={**g.DEFAULT,'connectionsEnabled':True,'connections':20,'exclude':['198.51.100.7']}),patch.object(g,'command',return_value=fixture),patch.object(g,'protected',return_value=['198.51.100.7']):g.scan()
        log=(g.STATE/'connection-events.log').read_text()
        self.assertIn('198.51.100.22',log);self.assertNotIn('198.51.100.33',log);self.assertNotIn('198.51.100.7',log)

if __name__=='__main__':unittest.main()
