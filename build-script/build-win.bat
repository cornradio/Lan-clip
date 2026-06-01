pyinstaller --name=lan-clip --add-data "templates;templates" --add-data "static;static" --log-level WARN app.py -y

:: Use PowerShell to compress files
@REM move  dist\start.exe dist\lan-clip
@REM powershell Compress-Archive -Path dist/* -DestinationPath lan-clip_win.zip -Force

echo Build complete in batch script. (No pause, returning to PowerShell) 