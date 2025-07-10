import argparse
import subprocess
import webbrowser
import sys
import os
from PIL import Image, ImageDraw
import pystray
from pystray import MenuItem, Icon

# 获取程序运行目录
if getattr(sys, 'frozen', False):
    # 如果是打包后的 exe 运行
    application_path = os.path.dirname(sys.executable)
else:
    # 如果是 python 脚本运行
    application_path = os.path.dirname(os.path.abspath(__file__))

# 构建 clipboard_app.exe 的完整路径
clipboard_app_path = os.path.join(application_path,'LAN_clipboard_app.exe')

# 启动 clipboard_app.exe 并挂在后台,隐藏命令行窗口
startupinfo = subprocess.STARTUPINFO()
startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
startupinfo.wShowWindow = subprocess.SW_HIDE

# 解析命令行参数
parser = argparse.ArgumentParser(description='Run the LAN clipboard app with custom port.')
parser.add_argument('--port', type=int, default=5000, help='Port number to run the app on.')
args = parser.parse_args()

# 使用解析后的端口号
port = args.port

# 构建 clipboard_app.exe 的完整命令
clipboard_app_command = [clipboard_app_path, f"--port={port}"]

# 启动 clipboard_app.exe
clipboard_process = subprocess.Popen(clipboard_app_command, startupinfo=startupinfo)

def create_image(width, height):
    """创建一个简单的托盘图标"""
    image = Image.new('RGB', (width, height), color=(255, 255, 255))
    dc = ImageDraw.Draw(image)
    dc.rectangle(
        (width // 4, height // 4, width * 3 // 4, height * 3 // 4),
        fill=(0, 0, 0)
    )
    return image


def open_website(url):
    """打开指定网站"""
    webbrowser.open(url)

def exit_action(icon, item):
    """退出程序并关闭 clipboard_app.exe"""
    clipboard_process.terminate()  # 终止 clipboard_app.exe
    icon.stop()  # 停止托盘图标

# 获取IP地址
def get_ip():
    cmd = "ipconfig | findstr 192"
    result = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, text=True, encoding='gbk', startupinfo=startupinfo)
    # 只获取第一个IP地址
    ip_list = result.stdout.strip().split('\n')
    if ip_list:
        # 提取第一个IP地址中的数字部分
        first_ip = ip_list[0]
        import re
        ip_match = re.search(r'192\.\d+\.\d+\.\d+', first_ip)
        if ip_match:
            return ip_match.group()
    return "Unknown IP"

def open_file_location(path):
    """打开文件所在位置"""
    os.startfile(path)

# 创建托盘图标
icon = Icon("Clipboard Loader")
icon.icon = create_image(64, 64)  # 创建图标
icon.title = "Clipboard Loader"

icon.menu = pystray.Menu(
    MenuItem(f"Open 127.0.0.1:{port}", lambda icon, item: open_website(f"http://127.0.0.1:{port}/")),
    MenuItem(f"Open {get_ip()}:{port}", lambda icon, item: open_website(f"http://{get_ip()}:{port}/")),
    # MenuItem 打开文件位置
    MenuItem("Open File Location", lambda icon, item: open_file_location(application_path+"\\uploads")),
    MenuItem("Exit", exit_action)
)

# 运行托盘图标
icon.run()

# make exe
# pyinstaller --onefile --noconsole --clean apploader.py -y