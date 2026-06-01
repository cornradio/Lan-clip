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
        # Provide empty mocks for non-Windows environments (e.g. Docker)
        pystray = None
        item = None
        Menu = None
except ImportError:
    pystray = None
    item = None
    Menu = None

from clipboard_service import ClipboardMonitor

# Config file path
CONFIG_FILE = 'tray_config.json'

class TrayManager:
    def __init__(self, port, icon_path):
        self.port = port
        self.icon_path = icon_path
        self.monitor = ClipboardMonitor(port)
        self.icon = None
        
        # Load config
        self.config = self._load_config()
        self._listener_enabled = self.config.get('listener_enabled', False)
        self._threshold_mb = self.config.get('threshold_mb', 10)
        self._compress_enabled = self.config.get('compress_enabled', False) # No compression by default

        # Initialize monitor settings
        self.monitor.set_max_size(self._threshold_mb)
        self.monitor.set_compression(self._compress_enabled, 80)
        
        if self._listener_enabled:
            self.monitor.start()

        # Icon cache
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
            print(f"Failed to save config: {e}")

    def _load_base_image(self):
        try:
            img = Image.open(self.icon_path).convert('RGBA')
            return img.resize((64, 64))
        except Exception as e:
            print(f"Failed to load icon: {e}")
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
        # Folder submenu
        folder_menu = Menu(
            item('Images folder (pasted images)', self._open_folder('images')),
            item('Uploads folder (file/web uploads)', self._open_folder('uploads')),
            item('Project root folder', self._open_folder('.'))
        )

        # Threshold submenu
        threshold_menu = Menu(
            item('5 MB', self._set_threshold(5), checked=lambda _: self._threshold_mb == 5),
            item('10 MB', self._set_threshold(10), checked=lambda _: self._threshold_mb == 10),
            item('20 MB', self._set_threshold(20), checked=lambda _: self._threshold_mb == 20),
            item('50 MB', self._set_threshold(50), checked=lambda _: self._threshold_mb == 50),
            item('100 MB', self._set_threshold(100), checked=lambda _: self._threshold_mb == 100),
        )

        # Create menu
        menu = (
            item('Open browser', self._open_browser),
            item('Browse local files', folder_menu),
            Menu.SEPARATOR,
            item('Listening mode (on if icon has green dot)', self._toggle_listener, checked=lambda item: self._listener_enabled),
            item('Enable clipboard image compression (80% quality)', self._toggle_compression, checked=lambda item: self._compress_enabled),
            item('Sync threshold limit', threshold_menu),
            Menu.SEPARATOR,
            item('Exit', self._exit)
        )

        # Create tray icon
        self.icon = pystray.Icon(
            "Lan-clip",
            self._get_current_icon(),
            "Lan-clip clipboard sync",
            menu
        )

        self.icon.run()

def start_tray(port, icon_path):
    tray = TrayManager(port, icon_path)
    tray.run()
