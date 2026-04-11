
# LAN Clipboard
> 局域网共享工具/剪切板监听工具

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

## 快捷键模式
你会发现右上角有一个小鼠标，这是一个快捷键模式，可以点击按钮、或者在空白处按下方向下键开启。
开启后会选中一个卡片，可以用方向键移动，c复制，enter打开链接/图片、d下载，Del删除。
批量删除非常好用。不用鼠标瞄准去点按钮了。
<img width="1713" height="1514" alt="image" src="https://github.com/user-attachments/assets/b624235e-e4c9-499d-84fb-e7e8d1c1f89e" />


## 剪切板监听模式
默认模式仅提供web功能，剪切板监听模式可以使用 --tray 参数启动。
开启后会有一个绿色小蜥蜴出现在托盘上，右键开启监听即可自动把剪切板内容放到lan-clip中。
- windows用户可以使用release中的traymode.vbs直接启动。
- mac用户可以问问ai怎么写隐藏启动命令。自己写一个放到.zshrc文件中。例如:`alias lanclip="cd /Users/kasusa/Documents/GitHub/Lan-clip; nohup python3 app.py --tray > /dev/null 2>&1 &"`
- linux用户可能需要修改 tray_manager.py 并使用python源代码运行。因为我只有win和mac版本的测试过。

<img width="210" height="214" alt="image" src="https://github.com/user-attachments/assets/5a0cb5d6-3ec6-4b1e-bad2-ca3cbf819159" />



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

3. 源码运行
```
python app.py
python app.py --tray #剪切板监听模式
```

## 更新log
2026-02-28
- 增加一个权限管理功能，置顶、编辑、删除帖子需要密码。（可在pwd.txt中修改）
2026-02-28 10:24:46
- 图册预览给每个图增加下载按钮、删除按钮
- “设置 → 简洁模式”开关之间切换，对比体验：普通模式保留动效和大图展示，简洁模式更平、滚动更快、操作按钮更突出。
- 上传进度条， UPLOAD_PROGRESS_MIN_SIZE 以上则显示进度提示
- pwd.txt 增加密码设置
- 删除动画
- 双击卡片就开始进入高亮卡片模式，上下左右控制选择，del/backspace 可以删除，（删除后自动选择下一个卡） d下载，e编辑，c复制（仅仅在高亮卡片时候有效果）
- 2026-01-17
- 允许 pin 卡片
- 刷新的时候不卡背景
- 增加 docker -v 挂载持久化
