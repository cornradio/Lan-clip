import os
import webbrowser
import threading
import sys
import json
from PIL import Image, ImageDraw

try:
    if sys.platform == 'win32':
        import pystray
        from pystray import MenuItem as item, Menu
    else:
        # 非 Windows 环境 (如 Docker) 提供空 Mock
        pystray = None
        item = None
        Menu = None
except ImportError:
    pystray = None
    item = None
    Menu = None

from clipboard_service import ClipboardMonitor

# 配置文件路径
CONFIG_FILE = 'tray_config.json'

class TrayManager:
    def __init__(self, port, icon_path):
        self.port = port
        self.icon_path = icon_path
        self.monitor = ClipboardMonitor(port)
        self.icon = None
        
        # 加载配置
        self.config = self._load_config()
        self._listener_enabled = self.config.get('listener_enabled', False)
        self._threshold_mb = self.config.get('threshold_mb', 10)
        self._compress_enabled = self.config.get('compress_enabled', False) # 默认不压缩
        
        # 初始化监听器设置
        self.monitor.set_max_size(self._threshold_mb)
        self.monitor.set_compression(self._compress_enabled, 80)
        
        if self._listener_enabled:
            self.monitor.start()

        # 图标缓存
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
            img = Image.open(self.icon_path).convert('RGBA')
            return img.resize((64, 64))
        except Exception as e:
            print(f"加载图标失败: {e}")
            return Image.new('RGBA', (64, 64), (100, 100, 255, 255))

    def _create_active_image(self, base_img):
        active_img = base_img.copy()
        draw = ImageDraw.Draw(active_img)
        margin = 4
        dot_size = 18
        draw.ellipse([64 - dot_size - margin, margin, 64 - margin, margin + dot_size], 
                     fill=(0, 255, 0, 255), outline=(255, 255, 255, 255), width=2)
        return active_img

    def _get_current_icon(self):
        return self.active_image if self._listener_enabled else self.base_image

    def _update_icon(self):
        if self.icon:
            self.icon.icon = self._get_current_icon()

    def _open_browser(self, icon, item):
        webbrowser.open(f'http://127.0.0.1:{self.port}')

    def _open_folder(self, folder_name):
        def inner(icon, item):
            path = os.path.join(os.path.abspath("."), folder_name)
            if not os.path.exists(path):
                try:
                    os.makedirs(path)
                except:
                    pass
            if os.path.exists(path):
                os.startfile(path)
        return inner

    def _toggle_listener(self, icon, item):
        self._listener_enabled = not self._listener_enabled
        if self._listener_enabled:
            self.monitor.start()
        else:
            self.monitor.stop()
        self._update_icon()
        self._save_config()

    def _toggle_compression(self, icon, item):
        self._compress_enabled = not self._compress_enabled
        self.monitor.set_compression(self._compress_enabled, 80)
        self._save_config()

    def _set_threshold(self, mb):
        def inner(icon, item):
            self._threshold_mb = mb
            self.monitor.set_max_size(mb)
            self._save_config()
        return inner

    def _exit(self, icon, item):
        self.monitor.stop()
        icon.stop()
        os._exit(0)

    def run(self):
        # 文件夹子菜单
        folder_menu = Menu(
            item('Images 文件夹 (粘贴的图片)', self._open_folder('images')),
            item('Uploads 文件夹 (文件/网页上传)', self._open_folder('uploads')),
            item('项目根文件夹', self._open_folder('.'))
        )

        # 阈值子菜单
        threshold_menu = Menu(
            item('5 MB', self._set_threshold(5), checked=lambda _: self._threshold_mb == 5),
            item('10 MB', self._set_threshold(10), checked=lambda _: self._threshold_mb == 10),
            item('20 MB', self._set_threshold(20), checked=lambda _: self._threshold_mb == 20),
            item('50 MB', self._set_threshold(50), checked=lambda _: self._threshold_mb == 50),
            item('100 MB', self._set_threshold(100), checked=lambda _: self._threshold_mb == 100),
        )

        # 创建菜单
        menu = (
            item('打开浏览器', self._open_browser),
            item('浏览本地文件', folder_menu),
            Menu.SEPARATOR,
            item('监听模式 (开启中 if 图标带绿点)', self._toggle_listener, checked=lambda item: self._listener_enabled),
            item('开启剪贴板图片压缩 (80% 质量)', self._toggle_compression, checked=lambda item: self._compress_enabled),
            item('同步阈值限制', threshold_menu),
            Menu.SEPARATOR,
            item('退出', self._exit)
        )

        # 创建托盘图标
        self.icon = pystray.Icon(
            "Lan-clip",
            self._get_current_icon(),
            "Lan-clip 剪贴板同步",
            menu
        )

        self.icon.run()

def start_tray(port, icon_path):
    tray = TrayManager(port, icon_path)
    tray.run()
