![image](https://github.com/user-attachments/assets/8e8a1e4e-6acf-4d37-9859-b0ec8c5bd2d0)

# LAN Clipboard - A Shared Tool for Your Local Network

Quickly share text, images, and files within your local network!

## Features
- Supports text, image, and file storage
- Automatically recognizes and converts URLs into hyperlinks
- High-speed transfer over the local network
- Windows tray mode
- Synchronized updates across multiple devices

# Installation and Startup

## 1. Windows Desktop Version
> Download the .exe file from the Releases page.

## 2. Docker Deployment (Server)

### Docker Hub Image
```bash
docker run -d -p 5000:5000 kasusa/lan-clipboard-app:latest
```

### Aliyun Image (for users in mainland China)
```bash
docker run -d -p 5000:5000 registry.cn-hangzhou.aliyuncs.com/aaas-images/lan-clipboard-app:latest
```

## 3. Running from Source (Development/Debugging)
```bash
flask run --host=0.0.0.0 --port 5002
```