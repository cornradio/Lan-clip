#!/bin/bash

echo "Starting build process..."

# 检查并安装依赖
echo "Installing dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo "Warning: requirements.txt not found!"
    read -p "Do you want to continue without installing dependencies? (y/n): " continue
    if [ "$continue" != "y" ]; then
        echo "Build cancelled."
        exit 1
    fi
fi

# 开始构建
echo "Building application..."
# 添加 --noconsole 参数构建主应用
pyinstaller --name=LAN_clipboard_app --add-data "templates:templates" --add-data "static:static" app.py -y

# 创建 ZIP 压缩包
echo "Creating ZIP archive..."
zip -r Lan_clipboard_app_linux.zip dist/LAN_clipboard_app/*

# 询问是否清理构建文件
read -p "Do you want to clean the build files? (y/n): " clean
if [ "$clean" = "y" ]; then
    echo "Cleaning build files..."
    git clean -fdX
fi

echo "Build complete!"
