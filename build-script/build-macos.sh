#!/bin/bash

echo "Starting build process..."

# Check and install dependencies
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

# Start building
echo "Building application..."
# Build the main app with the --noconsole argument
pyinstaller --name=LAN_clipboard_app --add-data "templates:templates" --add-data "static:static" app.py -y

# Create a ZIP archive
echo "Creating ZIP archive..."
zip -r Lan_clipboard_app_macos_m1.zip dist/LAN_clipboard_app/*

# Ask whether to clean up the build files
read -p "Do you want to clean the build files? (y/n): " clean
if [ "$clean" = "y" ]; then
    echo "Cleaning build files..."
    git clean -fdX
fi

echo "Build complete!"
