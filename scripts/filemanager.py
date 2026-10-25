"""Create a guarded bridge to the installed FileGator without changing its files."""
import re


def build_assets(root):
    folder = root/'web/fm/dist/js'
    app = (folder/'app.js').read_text()
    replacements = {
        'mode:"hash"': 'mode:"abstract"',
        '.$mount("#app")': '.$mount("#vip-file-mount")',
        'window.location.origin+window.location.pathname+"?r="': 'window.location.origin+"/fm/?r="',
    }
    for before, after in replacements.items():
        if app.count(before) != 1:
            raise ValueError('Versión de FileGator no compatible con el montaje integrado: '+before)
        app = app.replace(before, after)
    app = app.replace('document.body', 'document.getElementById("vip-files")')
    app = app.replace('"../images/logo.svg"', '"/images/logo.svg"')
    app = re.sub(r'\b(?:this|[A-Za-z_$][\w$]*)\.\$store\.state\.config\.logo',lambda match:'new URL('+match.group(0)+',window.location.origin+"/fm/").href',app)
    # Only the derived bundle changes: epoch timestamps use the panel's server
    # timezone and four-digit, 24-hour display, independent of browser settings.
    date_method = r'formatDate\(([A-Za-z_$][\w$]*)\)\{return [^{};]+\.unix\(\1\)\.format\([^{};]+\)\}'
    app, dates = re.subn(date_method, lambda m: 'formatDate('+m[1]+'){return window.vipDate('+m[1]+')}', app)
    if dates != 1:
        raise ValueError('Version de FileGator no compatible con fechas integradas.')
    vendor = (folder/'chunk-vendors.js').read_text().replace('document.body', 'document.getElementById("vip-files")')
    notice = '/*! Derived from the installed FileGator. Native license: /fm/LICENSE; source unchanged. */\n'
    return {
        'web/js/virtualia/filegator-app.js': (notice+app).encode(),
        'web/js/virtualia/filegator-vendor.js': (notice+vendor).encode(),
    }
