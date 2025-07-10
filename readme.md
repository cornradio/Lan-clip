<img width="2544" height="1868" alt="image" src="https://github.com/user-attachments/assets/7d52560f-b7fb-4543-a2ce-194d55aa5e70" />


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
