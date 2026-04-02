# alias lc="nohup python3 /Users/shrimppipi/Documents/Github/Lan-clip-master/app.py --tray  > /dev/null 2>&1 &"

import os
import sys
import webbrowser
import threading
import json
from PIL import Image, ImageDraw
import AppKit # 引入 macOS 原生库

# 告诉 macOS：我是一个后台应用，不要在我的 Dock 栏显示图标！
AppKit.NSApplication.sharedApplication().setActivationPolicy_(1)

# 确保导入 pystray
try:
    import pystray
    from pystray import MenuItem as item, Menu
except ImportError:
    print("错误: 缺少 pystray 库。请运行: pip3 install pystray pyobjc")
    sys.exit(1)

from clipboard_service import ClipboardMonitor

CONFIG_FILE = 'tray_config.json'

class TrayManager:
    def __init__(self, port, icon_path):
        self.port = port
        self.icon_path = icon_path
        self.monitor = ClipboardMonitor(port)
        
        # 加载配置
        self.config = self._load_config()
        self._listener_enabled = self.config.get('listener_enabled', False)
        self._threshold_mb = self.config.get('threshold_mb', 10)
        self._compress_enabled = self.config.get('compress_enabled', False)
        
        # 初始化监听器
        self.monitor.set_max_size(self._threshold_mb)
        self.monitor.set_compression(self._compress_enabled, 80)
        if self._listener_enabled:
            self.monitor.start()

        # 图标处理
        self.base_image = self._load_base_image()
        self.active_image = self._create_active_image(self.base_image)

    def _load_config(self):
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return {}

    def _save_config(self):
        config = {
            'listener_enabled': self._listener_enabled,
            'threshold_mb': self._threshold_mb,
            'compress_enabled': self._compress_enabled
        }
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(config, f)
        except Exception as e:
            print(f"保存配置失败: {e}")

    def _load_base_image(self):
        try:
            # macOS 菜单栏图标最好是单色（黑色）带透明通道，系统会自动反色
            img = Image.open(self.icon_path).convert('RGBA')
            # 调整大小适合菜单栏
            return img.resize((64, 64))
        except Exception as e:
            print(f"加载图标失败: {e}")
            # 返回一个默认的蓝色方块
            return Image.new('RGBA', (64, 64), (100, 100, 255, 200))

    def _create_active_image(self, base_img):
        # 在图标右上角画一个绿点，表示正在监听
        active_img = base_img.copy()
        draw = ImageDraw.Draw(active_img)
        margin = 4
        dot_size = 18
        # 画绿色圆点
        draw.ellipse([64 - dot_size - margin, margin, 64 - margin, margin + dot_size], 
                     fill=(0, 255, 0, 255), outline=(255, 255, 255, 255), width=2)
        return active_img

    def _get_current_icon(self):
        return self.active_image if self._listener_enabled else self.base_image

    # --- macOS 核心修改：使用 subprocess 打开文件夹 ---
    def _open_folder(self, folder_name):
        def action(icon, item):
            path = os.path.join(os.path.abspath("."), folder_name)
            if not os.path.exists(path):
                try:
                    os.makedirs(path)
                except:
                    pass
            
            if os.path.exists(path):
                # macOS 使用 'open' 命令
                os.system(f'open "{path}"')
        return action

    def _open_browser(self, icon, item):
        webbrowser.open(f'http://127.0.0.1:{self.port}')

    def _toggle_listener(self, icon, item):
        self._listener_enabled = not self._listener_enabled
        if self._listener_enabled:
            self.monitor.start()
        else:
            self.monitor.stop()
        # 更新图标状态
        icon.icon = self._get_current_icon()
        self._save_config()

    def _toggle_compression(self, icon, item):
        self._compress_enabled = not self._compress_enabled
        self.monitor.set_compression(self._compress_enabled, 80)
        self._save_config()

    def _set_threshold(self, mb):
        def action(icon, item):
            self._threshold_mb = mb
            self.monitor.set_max_size(mb)
            self._save_config()
        return action

    def _exit(self, icon, item):
        self.monitor.stop()
        icon.stop()
        os._exit(0)

    def run(self):
        # 1. 文件夹子菜单
        folder_menu = Menu(
            item('Images 文件夹', self._open_folder('images')),
            item('Uploads 文件夹', self._open_folder('uploads')),
            item('项目根文件夹', self._open_folder('.'))
        )

        # 2. 阈值子菜单
        threshold_menu = Menu(
            item('5 MB', self._set_threshold(5), checked=lambda _: self._threshold_mb == 5),
            item('10 MB', self._set_threshold(10), checked=lambda _: self._threshold_mb == 10),
            item('20 MB', self._set_threshold(20), checked=lambda _: self._threshold_mb == 20),
            item('50 MB', self._set_threshold(50), checked=lambda _: self._threshold_mb == 50),
        )

        # 3. 主菜单
        menu = Menu(
            item('打开浏览器', self._open_browser),
            item('浏览本地文件', folder_menu),
            pystray.Menu.SEPARATOR,
            item('监听模式 (开启/关闭)', self._toggle_listener, checked=lambda _: self._listener_enabled),
            item('开启图片压缩', self._toggle_compression, checked=lambda _: self._compress_enabled),
            item('同步阈值', threshold_menu),
            pystray.Menu.SEPARATOR,
            item('退出', self._exit)
        )

        # 4. 创建并运行图标
        # title 参数在 macOS 上会显示在菜单栏文字（可选）
        self.icon = pystray.Icon(
            "Lan-clip", 
            self._get_current_icon(), 
            "Lan-clip 剪贴板同步",
            menu
        )
        
        print("✅ 托盘图标已启动...")
        self.icon.run()

def start_tray(port, icon_path):
    tray = TrayManager(port, icon_path)
    tray.run()