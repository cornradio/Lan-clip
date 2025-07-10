
![image](https://github.com/user-attachments/assets/8e8a1e4e-6acf-4d37-9859-b0ec8c5bd2d0)


# LAN Clipboard - 局域网共享工具

快速在局域网内共享文本、图片和文件！
功能亮点
- 支持文本 / 图片 / 文件存储
- 自动识别并转换 URL 为超链接
- 内网高速传输
- Windows 托盘模式
- 多设备同步刷新

# 安装与启动
1. Windows 桌面版

> 从 Release 页面下载 exe 文件

2. Docker 部署（服务器）
bash
## Docker Hub镜像
```
docker run -d -p 5000:5000 kasusa/lan-clipboard-app:latest
```

## 阿里云镜像（国内加速）
```
docker run -d -p 5000:5000 registry.cn-hangzhou.aliyuncs.com/aaas-images/lan-clipboard-app:latest
```

3. 源码运行（开发 / 调试）
```
flask run --host=0.0.0.0 --port 5002
```