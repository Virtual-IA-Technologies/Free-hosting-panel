"""Focused policy/cron/retention tests; no services, customer data or cloud writes."""
import importlib.util
from datetime import datetime,timedelta,timezone
from pathlib import Path
import copy
import unittest
import tempfile
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('backup_admin',Path(__file__).resolve().parents[1]/'modules/backup-admin/backup-admin.py')
backup=importlib.util.module_from_spec(spec);spec.loader.exec_module(backup)

class Backups(unittest.TestCase):
    def policy(self):return {'id':'','name':'Daily','accounts':['customer'],'kind':'databases','destination':'local','folder':'','schedules':['0 2 * * *'],'timezone':'UTC','enabled':False,'retention':{'local':2,'daily':2,'weekly':4,'monthly':1,'hours':0}}
    def test_hosting_users_exclude_all_administrators(self):
        with patch.object(backup,'native',return_value={'control':{'ROLE':'admin'},'second':{'ROLE':'admin'},'customer':{'ROLE':'user'}}):
            self.assertEqual(list(backup.hosting_users()),['customer'])
    def test_strict_policy_scope_and_paths(self):
        with patch.object(backup,'remotes',return_value=[]):
            self.assertEqual(backup.validate(self.policy(),{'customer'})['accounts'],['customer'])
            for key,value in [('accounts',['root']),('kind','shell'),('destination','drive:../escape'),('folder','../escape'),('folder','/root'),('enabled','true'),('schedules',['* * * * *; rm -rf /'])]:
                p=self.policy();p[key]=value
                with self.assertRaises((ValueError,KeyError)):backup.validate(p,{'customer'})
    def test_confirmation_prevents_mutation(self):
        with patch.object(backup,'role'),patch.object(backup,'write') as write:
            for action in ['save','delete','run']:
                with self.assertRaises(ValueError):backup.handle({'actor':'admin','action':action})
            write.assert_not_called()
    def test_legacy_sql_frequency(self):
        for hour,minute,expected in [(8,0,True),(8,15,True),(19,45,True),(20,0,False),(7,45,False)]:
            now=datetime(2026,10,24,hour,minute,tzinfo=timezone.utc)
            self.assertEqual(backup.due('*/15 8-19 * * *',now),expected)
        self.assertTrue(backup.due('0 20 * * *',datetime(2026,10,24,20,0,tzinfo=timezone.utc)))
    def test_cron_calendar_and_input(self):
        now=datetime(2026,10,25,2,0,tzinfo=timezone.utc)
        self.assertTrue(backup.due('0 2 * * 7',now))
        self.assertTrue(backup.due('0 2 1 * 0',now))
        self.assertEqual(backup.fields('5/10 * * * *')[0],{5,15,25,35,45,55})
        for value in ['60 * * * *','* 24 * * *','* * * * * /bin/sh','$(id) * * * *','*/0 * * * *']:
            with self.assertRaises(ValueError):backup.fields(value)
    def test_gfs_and_hour_retention(self):
        now=datetime(2026,10,24,tzinfo=timezone.utc);items=[{'id':str(i),'created':int((now-timedelta(hours=i)).timestamp())} for i in range(96)]
        p=self.policy();p['destination']='drive';p['retention']={'local':0,'daily':0,'weekly':0,'monthly':0,'hours':48}
        keep=backup.retention_ids(items,p,now.timestamp());self.assertEqual(len(keep),49);self.assertNotIn('80',keep)
        p['retention']={'local':2,'daily':2,'weekly':1,'monthly':1,'hours':0}
        keep=backup.retention_ids(items,p,now.timestamp());self.assertIn('0',keep);self.assertTrue(len(keep)<=4)
    def test_invalid_artifact_id(self):
        for value in ['../settings.json','/etc/passwd','a'*31]:
            with self.assertRaises(ValueError):backup.file_record(value)
    @unittest.skipIf(backup.fcntl is None,'Linux scheduler lock')
    def test_busy_worker_keeps_all_due_policies(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(backup,'STATE',Path(folder)),patch.object(backup,'policies',return_value={v:{'enabled':True,'timezone':'UTC','schedules':['* * * * *']} for v in ['a','b']}),patch.object(backup,'start',side_effect=ValueError('busy')):
            backup.tick();self.assertEqual(backup.load(Path(folder)/'scheduler.json',{})['_pending'],['a','b'])
            with patch.object(backup,'start',return_value={'state':'queued'}):backup.tick()
            self.assertEqual(backup.load(Path(folder)/'scheduler.json',{})['_pending'],['b'])

if __name__=='__main__':unittest.main()
