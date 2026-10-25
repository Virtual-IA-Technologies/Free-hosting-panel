"""Focused tests of the optional privileged mail helper; no real mail or SQL writes."""
import importlib.util
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('vip_mail',Path(__file__).resolve().parents[1]/'modules/mail-admin/mail-admin.py')
mail=importlib.util.module_from_spec(spec);spec.loader.exec_module(mail)


class MailAdminTests(unittest.TestCase):
    def test_rejects_non_admin_and_unknown_actions(self):
        with self.assertRaises(ValueError):mail.role('../root')
        with patch.object(Path,'read_text',return_value="ROLE='user'\n"):
            with self.assertRaises(ValueError):mail.role('customer')
        with patch.object(mail,'role'),self.assertRaises(ValueError):mail.handle({'actor':'admin','action':'shell'})

    def test_confirmation_and_id_before_exim(self):
        with patch.object(mail,'role'),patch.object(mail,'command') as command:
            for action in ['retry','freeze','thaw','remove']:
                for identifier,confirm in [('123abc-123456789012-xy','false'),('--help','true'),('../input/secret','true')]:
                    with self.assertRaises(ValueError):mail.handle({'actor':'admin','action':action,'id':identifier,'confirm':confirm})
            command.assert_not_called()

    def test_queue_parser_and_bounded_tracking(self):
        with patch.object(mail,'role'),patch.object(mail,'command',return_value=' 2h  1.2K 123abc-123456789012-xy <sender@example.invalid> *** frozen ***\n          target@example.invalid\n'):
            item=mail.handle({'actor':'admin','action':'queue'})['items'][0]
            self.assertTrue(item['frozen']);self.assertEqual(item['recipients'],['target@example.invalid'])
        logs=['date ** target: rejected','date => delivered','date == deferred','date <= received A=dovecot_login:user@example.invalid']
        with patch.object(mail,'role'),patch.object(mail,'recent_logs',return_value=logs):
            result=mail.handle({'actor':'admin','action':'trace','query':''})
            self.assertEqual(result['summary']['Rebotado'],1)
            self.assertEqual(mail.handle({'actor':'admin','action':'relayers','query':''})['items'][0]['messages'],1)

    def test_tickets_expire_bind_ip_and_cannot_replay(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(mail,'STATE',Path(folder)),patch.object(mail,'role'),patch.object(mail,'mailbox',return_value='box@example.invalid'):
            (Path(folder)/'master.json').write_text(json.dumps({'user':'master','password':'unit-test-only'}))
            request={'actor':'admin','action':'webmail','owner':'customer','domain':'example.invalid','account':'box','ip':'127.0.0.1'}
            token=mail.handle(request)['ticket']
            with self.assertRaises(ValueError):mail.consume(token,'127.0.0.2')
            value=mail.consume(token,'127.0.0.1');self.assertEqual(value['email'],'box@example.invalid')
            with self.assertRaises(FileNotFoundError):mail.consume(token,'127.0.0.1')
            token=mail.handle(request)['ticket'];ticket=next((Path(folder)/'tickets').glob('*.json'))
            value=json.loads(ticket.read_text());value['expires']=time.time()-1;ticket.write_text(json.dumps(value))
            with self.assertRaises(ValueError):mail.consume(token,'127.0.0.1')

    def test_mailbox_paths_are_messages_only(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder).resolve();(root/'cur').mkdir();(root/'cur/msg').write_text('Subject: fixture\n\nmessage')
            self.assertEqual(mail.mailbox_path(root,'cur/msg'),root/'cur/msg')
            for relative in ['../outside',str(root/'cur/msg'),'../../etc/passwd']:
                with self.assertRaises(ValueError):mail.mailbox_path(root,relative)
            (root/'config').write_text('private')
            with self.assertRaises(ValueError):mail.mailbox_path(root,'config')


if __name__=='__main__':unittest.main()
