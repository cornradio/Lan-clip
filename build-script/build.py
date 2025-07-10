import PyInstaller.__main__

PyInstaller.__main__.run([
    'app.py',
    '--name=clipboard_app',
    '--add-data=templates;templates',
    '--add-data=static;static',
    '--icon=icon.ico',
    '--hidden-import=werkzeug',
    '--hidden-import=flask',
    '--hidden-import=jinja2',
    '--windowed',
    '--noconfirm',
    '--clean'
])