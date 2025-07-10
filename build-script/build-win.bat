@echo off
echo Starting build process...

:: 开始构建
echo Building application...
:: 添加 --noconsole 参数
pyinstaller --name=LAN_clipboard_app --add-data "templates;templates" --add-data "static;static"  app.py -y
pyinstaller --name=start --onefile --noconsole apploader.py -y

:: 使用 PowerShell 压缩文件
echo Creating ZIP archive...
move  dist\start.exe dist\LAN_clipboard_app
powershell Compress-Archive -Path dist/* -DestinationPath Lan_clipboard_app_win.zip -Force

:: ask for clean?
set /p clean=Do you want to clean the build files? (y/n): 
if "%clean%"=="y" (
    echo Cleaning build files...
    git clean -fdX
)

echo Build complete!
pause 