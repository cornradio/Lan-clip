
# LAN Clipboard - 局域网共享工具

<img width="2326" height="1642" alt="图片" src="https://github.com/user-attachments/assets/c0f2e568-2389-4b16-a6bc-8ee7aa888938" />

快速在局域网内共享文本、图片和文件！
功能亮点
- 支持文本 / 图片 / 文件存储
- 自动识别并转换 URL 为超链接
- 内网高速传输
- Windows 托盘模式
- 多设备同步刷新
- 全部删除密码：1230 （可在pwd.txt中修改）
- 权限管理功能，置顶、编辑、删除帖子需要密码。（可在pwd.txt中修改）

# 安装与启动
1. Windows 桌面版

> 从 Release 页面下载 exe 文件

2. Docker 部署（服务器）
bash
## Docker Hub镜像
```bash
# 基本启动
docker run -d -p 5000:5000 kasusa/lan-clip:latest

# 持久化启动 (推荐)
# 注意：在执行前，请手动创建文件，否则 Docker 会将它们误认为目录导致报错
sudo mkdir -p LAN-clip/cards LAN-clip/uploads LAN-clip/images
sudo touch LAN-clip/pwd.txt
echo "[]" | sudo tee LAN-clip/pinned.json
sudo chmod 777 LAN-clip

docker run -d -p 5000:5000 \
  -v $(pwd)/LAN-clip/cards:/app/cards \
  -v $(pwd)/LAN-clip/uploads:/app/uploads \
  -v $(pwd)/LAN-clip/images:/app/images \
  -v $(pwd)/LAN-clip/pinned.json:/app/pinned.json \
  -v $(pwd)/LAN-clip/pwd.txt:/app/pwd.txt \
  kasusa/lan-clip:latest
```

2. 源码运行（开发 / 调试）
```
python app.py
```

## tray模式
现在不仅仅可以手工添加，它还可以自动的监听剪贴板内容，并且把它们都存储起来，以供后续使用。
只需要在启动的时候使用命令。

```
python app.py --tray
```

## 更新日志
详见 [releasenote.md](releasenote.md)