
# LAN Clipboard - 局域网共享工具

<img width="2326" height="1642" alt="图片" src="https://github.com/user-attachments/assets/c0f2e568-2389-4b16-a6bc-8ee7aa888938" />

快速在局域网内共享文本、图片和文件！
功能亮点
- 支持文本 / 图片 / 文件存储
- 自动识别并转换 URL 为超链接
- 内网高速传输
- Windows 托盘模式
- 多设备同步刷新
- 全部删除密码：1230

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
python app.py
```

## 更新log
- 图册预览给每个图增加下载按钮、删除按钮
- “设置 → 简洁模式”开关之间切换，对比体验：普通模式保留动效和大图展示，简洁模式更平、滚动更快、操作按钮更突出。
- 上传进度条， UPLOAD_PROGRESS_MIN_SIZE 以上则显示进度提示
- pwd.txt 增加密码设置
- 删除动画
- 双击卡片就开始进入高亮卡片模式，上下左右控制选择，del/backspace 可以删除，（删除后自动选择下一个卡） d下载，e编辑，c复制（仅仅在高亮卡片时候有效果）