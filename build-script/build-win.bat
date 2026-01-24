pyinstaller --name=lan-clip --add-data "templates;templates" --add-data "static;static"  app.py -y

:: 使用 PowerShell 压缩文件
@REM move  dist\start.exe dist\lan-clip
powershell Compress-Archive -Path dist/* -DestinationPath lan-clip_win.zip -Force

echo Build complete!
pause 