"""Exercise compatibility and dry-run without a Hestia server or privileged changes."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('filemanager', ROOT/'scripts/filemanager.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
sys.path.insert(0,str(ROOT/'scripts'))
from install import prepare_assets
import json


class InstallerTest(unittest.TestCase):
    def test_bridge_and_dry_run(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            js = root/'web/fm/dist/js'
            js.mkdir(parents=True)
            app = 'mode:"hash";x.$mount("#app");window.location.origin+window.location.pathname+"?r=";document.body;src:e.$store.state.config.logo;'
            (js/'app.js').write_text(app)
            (js/'chunk-vendors.js').write_text('document.body;')
            loader = root/'web/templates/includes/js.php'
            loader.parent.mkdir(parents=True)
            loader.write_text('custom_scripts')
            native=root/'web/js/dist/main.min.js';native.parent.mkdir(parents=True);native.write_text('(()=>{})();')
            assets = bridge.build_assets(root)
            self.assertEqual(len(assets), 2)
            self.assertIn(b'mode:"abstract"', assets['web/js/virtualia/filegator-app.js'])
            self.assertIn(b'/fm/?r=', assets['web/js/virtualia/filegator-app.js'])
            self.assertIn(b'new URL(e.$store.state.config.logo,window.location.origin+"/fm/").href',assets['web/js/virtualia/filegator-app.js'])
            self.assertEqual((js/'app.js').read_text(), app)
            before = sorted(p.relative_to(root) for p in root.rglob('*'))
            result = subprocess.run([sys.executable, str(ROOT/'scripts/install.py'), '--hestia-root', str(root), '--dry-run'], capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(before, sorted(p.relative_to(root) for p in root.rglob('*')))
            configured,settings=prepare_assets(root,'Example Panel','medium',True)
            self.assertEqual(json.loads(configured['web/js/virtualia/config.json']),settings)
            self.assertEqual(settings['defaultTheme'],'medium')
            self.assertEqual(settings['assetVersion'],prepare_assets(root,'Example Panel','medium',True)[1]['assetVersion'])
            self.assertNotEqual(settings['assetVersion'],prepare_assets(root,'Example Panel','light',True)[1]['assetVersion'])
            (js/'app.js').write_text('unsupported upstream build')
            with self.assertRaises(ValueError):
                bridge.build_assets(root)

    def test_native_manager_without_filegator(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            loader=root/'web/templates/includes/js.php';loader.parent.mkdir(parents=True);loader.write_text('custom_scripts')
            native=root/'web/js/dist/main.min.js';native.parent.mkdir(parents=True);native.write_text('(()=>{})();')
            assets,settings=prepare_assets(root,'Example Panel','light',False)
            self.assertFalse(settings['integratedFiles'])
            self.assertNotIn('web/js/virtualia/filegator-app.js',assets)
            result=subprocess.run([sys.executable,str(ROOT/'scripts/install.py'),'--hestia-root',str(root),'--dry-run','--without-file-manager','--default-theme','medium','--app-name','Example Panel'],capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr)
            rejected=subprocess.run([sys.executable,str(ROOT/'scripts/install.py'),'--app-name',"invalid'name"],capture_output=True)
            self.assertNotEqual(rejected.returncode,0)


if __name__ == '__main__':
    unittest.main()
