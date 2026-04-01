import time
import pyperclip
import requests
import threading
import os
import io
import math
from PIL import ImageGrab, Image

class ClipboardMonitor:
    def __init__(self, port):
        self.port = port
        self.base_url = f"http://127.0.0.1:{port}"
        self.api_add_card = f"{self.base_url}/api/add_card"
        self.api_upload_image = f"{self.base_url}/upload"
        self.api_upload_file = f"{self.base_url}/upload_file"
        
        self.max_size_mb = 10 
        self.compress_images = False # 默认不压缩，由 tray_manager 设置
        self.compression_quality = 80 # 默认 80%
        
        self._last_data = self._get_clipboard_hash()
        self.is_running = False
        self._thread = None
        self._callback = None

    def set_max_size(self, mb):
        self.max_size_mb = mb

    def set_compression(self, enabled, quality=80):
        self.compress_images = enabled
        self.compression_quality = quality
        print(f"剪贴板图片压缩开启: {enabled}, 质量: {quality}%")

    def _format_size(self, size_bytes):
        if size_bytes == 0:
            return "0B"
        size_name = ("B", "KB", "MB", "GB", "TB")
        i = int(math.floor(math.log(size_bytes, 1024)))
        p = math.pow(1024, i)
        s = round(size_bytes / p, 1)
        return "%s %s" % (s, size_name[i])

    def _get_clipboard_hash(self):
        """获取当前剪贴板内容的标识（用于比较是否变化）"""
        try:
            text = pyperclip.paste()
            if text and text.strip():
                return ("text", text)
            
            data = ImageGrab.grabclipboard()
            if isinstance(data, Image.Image):
                return ("image", data.size)
            elif isinstance(data, list):
                return ("files", tuple(data))
        except Exception:
            pass
        return None

    def set_callback(self, callback):
        self._callback = callback

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self.is_running = True
        self._thread = threading.Thread(target=self._monitor, daemon=True)
        self._thread.start()
        print(f"剪贴板同步已开启 (最大限制: {self.max_size_mb}MB)")

    def stop(self):
        self.is_running = False
        print("剪贴板监听已停止")

    def _monitor(self):
        while self.is_running:
            try:
                current_data = self._get_clipboard_hash()
                if current_data and current_data != self._last_data:
                    self._last_data = current_data
                    self._handle_clipboard_change()
            except Exception as e:
                print(f"监听循环异常: {e}")
            time.sleep(1.5)

    def _handle_clipboard_change(self):
        try:
            # 重新获取内容进行发送
            data = ImageGrab.grabclipboard()
            
            if isinstance(data, Image.Image):
                print("检测到剪贴板图片，正在同步...")
                img_byte_arr = io.BytesIO()
                
                # 如果开启压缩，且不是所有格式都支持压缩（JPEG/PNG 常用）
                # 这里我们默认转换为 RGB/RGBA 统一处理
                save_format = 'PNG'
                save_params = {}
                
                if self.compress_images:
                    # 压缩通常指 JPEG 压缩
                    save_format = 'JPEG'
                    save_params = {'quality': self.compression_quality, 'optimize': True}
                    if data.mode in ("RGBA", "P"):
                        data = data.convert("RGB")
                    print(f"正在以 {self.compression_quality}% 质量压缩图片...")

                data.save(img_byte_arr, format=save_format, **save_params)
                size_bytes = img_byte_arr.tell()
                
                # 检查阈值
                if size_bytes > self.max_size_mb * 1024 * 1024:
                    print(f"图片大小 ({self._format_size(size_bytes)}) 超过阈值 {self.max_size_mb}MB，跳过同步")
                    return

                img_byte_arr.seek(0)
                ext = ".jpg" if save_format == 'JPEG' else ".png"
                name = f"clipboard_{int(time.time())}{ext}"
                files = {'image': (name, img_byte_arr, f'image/{save_format.lower()}')}
                resp = requests.post(self.api_upload_image, files=files, timeout=10)
                if resp.status_code == 200:
                    img_url = resp.text
                    size_str = self._format_size(size_bytes)
                    content = f'''<div class="image-card">
                        <img src="{img_url}" alt="{name}" style="max-width: 100%; height: auto; border-radius: 8px;">
                        <div class="image-info">
                            <i class="fas fa-image" style="margin-right: 4px;"></i>
                            <span>{name} ({size_str})</span>
                        </div>
                    </div>'''
                    requests.post(self.api_add_card, json={'text': content})

            elif isinstance(data, list):
                print(f"检测到剪贴板文件 ({len(data)}个)，正在同步...")
                for file_path in data:
                    if os.path.exists(file_path) and os.path.isfile(file_path):
                        size_bytes = os.path.getsize(file_path)
                        
                        # 检查阈值
                        if size_bytes > self.max_size_mb * 1024 * 1024:
                            print(f"文件 {os.path.basename(file_path)} 大小 ({self._format_size(size_bytes)}) 超过阈值 {self.max_size_mb}MB，跳过同步")
                            continue

                        size_str = self._format_size(size_bytes)
                        file_name = os.path.basename(file_path)
                        ext = os.path.splitext(file_name)[1].lower()
                        
                        with open(file_path, 'rb') as f:
                            # 关键修复：如果是图片，直接调用图片上传接口，以解决 WebView2 预览显示问题
                            if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                                files = {'image': (file_name, f)}
                                up_resp = requests.post(self.api_upload_image, files=files, timeout=30)
                                if up_resp.status_code == 200:
                                    img_url = up_resp.text
                                    html = f'''<div class="image-card">
                                        <img src="{img_url}" alt="{file_name}" style="max-width: 100%; height: auto; border-radius: 8px;">
                                        <div class="image-info">
                                            <i class="fas fa-image" style="margin-right: 4px;"></i>
                                            <span>{file_name} ({size_str}) [从本地复制]</span>
                                        </div>
                                    </div>'''
                                    requests.post(self.api_add_card, json={'text': html})
                            else:
                                # 普通文件走文件通道
                                files = {'file': (file_name, f)}
                                up_resp = requests.post(self.api_upload_file, files=files, timeout=30)
                                if up_resp.status_code == 200:
                                    file_url = up_resp.text
                                    html = f'''<div class="file-card">
                                        <i class="fas fa-file" style="margin-right: 8px;"></i>
                                        <a href="{file_url}" target="_blank">{file_name}</a>
                                        <span class="file-info" style="margin-left: 8px;">({size_str})</span>
                                    </div>'''
                                    requests.post(self.api_add_card, json={'text': html})

            else:
                text = pyperclip.paste()
                if text and text.strip():
                    print(f"检测到剪贴板文本，正在同步: {text[:20]}...")
                    requests.post(self.api_add_card, json={'text': text}, timeout=5)
                    
        except Exception as e:
            print(f"处理剪贴板数据失败: {e}")
