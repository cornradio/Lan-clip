import os
import sys
import shutil
import re
from flask import Flask, render_template, request, send_from_directory, jsonify, url_for
import webbrowser
import glob
from werkzeug.utils import secure_filename
import argparse
import time

def resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

# 获取程序运行目录
def get_app_path():
    if hasattr(sys, '_MEIPASS'):
        return os.path.dirname(sys.executable)
    return os.path.abspath(".")

app = Flask(__name__,
           template_folder=resource_path('templates'),
           static_folder=resource_path('static'))

CARDS_DIR = 'cards'  # 新的卡片存储目录

# 添加全局变量存储卡片
cards_cache = []

# 在文件开头添加配置
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def ensure_cards_dir():
    if not os.path.exists(CARDS_DIR):
        os.makedirs(CARDS_DIR)

def load_cards():
    global cards_cache
    try:
        ensure_cards_dir()
        cards = []
        card_files = glob.glob(os.path.join(CARDS_DIR, '*.txt'))
        card_files.sort(key=lambda x: int(os.path.splitext(os.path.basename(x))[0]))
        for card_file in card_files:
            with open(card_file, 'r', encoding='utf-8') as f:
                cards.append(f.read().strip())
        cards_cache = cards  # 更新缓存
        return cards
    except Exception as e:
        print(f"加载卡片出错: {str(e)}")
        return []

def save_card(content):
    global cards_cache
    try:
        ensure_cards_dir()
        existing_files = glob.glob(os.path.join(CARDS_DIR, '*.txt'))
        next_num = len(existing_files) + 1
        file_path = os.path.join(CARDS_DIR, f'{next_num}.txt')
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        cards_cache.append(content)  # 更新缓存
        return True
    except Exception as e:
        print(f"保存卡片出错: {str(e)}")
        return False

@app.route('/', methods=['GET', 'POST'])
def home():
    global cards_cache
    if request.method == 'GET' and not cards_cache:  # 只在首次加载或缓存为空时从文件加载
        cards_cache = load_cards()
    
    if request.method == 'POST':
        new_text = request.form.get('text', '')
        if new_text:
            save_card(new_text)
    
    return render_template('index.html', cards=cards_cache, port=5000)

@app.route('/clear', methods=['POST'])
def clear_history():
    global cards_cache
    try:
        if os.path.exists(CARDS_DIR):
            shutil.rmtree(CARDS_DIR)
        os.makedirs(CARDS_DIR)
        cards_cache = []  # 清空缓存
        
        # 清空图片文件夹
        images_dir = os.path.join(get_app_path(), 'images')
        if os.path.exists(images_dir):
            for file in os.listdir(images_dir):
                os.remove(os.path.join(images_dir, file))
        # 清空上传文件夹
        if os.path.exists(UPLOAD_FOLDER):
            for file in os.listdir(UPLOAD_FOLDER):
                os.remove(os.path.join(UPLOAD_FOLDER, file))


        return '', 204
    except Exception as e:
        print(f"清理历史记录出错: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete_card', methods=['POST'])
def delete_card():
    global cards_cache
    try:
        card_content = request.json.get('content')
        card_id = None
        
        # 先尝试通过文件链接匹配
        if '<a href="/uploads/' in card_content:
            file_matches = re.findall(r'<a href="/uploads/([^"]+)"', card_content)
            if file_matches:
                # 查找包含这些文件链接的卡片
                files = glob.glob(os.path.join(CARDS_DIR, '*.txt'))
                for file_path in files:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        file_content = f.read().strip()
                        if any(match in file_content for match in file_matches):
                            card_id = int(os.path.splitext(os.path.basename(file_path))[0])
                            # 删除上传的文件
                            for file_filename in file_matches:
                                try:
                                    file_path = os.path.join(UPLOAD_FOLDER, file_filename)
                                    if os.path.exists(file_path):
                                        os.remove(file_path)
                                        print(f"删除文件: {file_path}")
                                except Exception as e:
                                    print(f"删除文件失败: {file_path}, 错误: {str(e)}")
                            break

        # 如果没找到，尝试通过图片路径匹配
        if card_id is None and '/images/' in card_content:
            image_paths = re.findall(r'/images/([^"]+)', card_content)
            files = glob.glob(os.path.join(CARDS_DIR, '*.txt'))
            for file_path in files:
                with open(file_path, 'r', encoding='utf-8') as f:
                    file_content = f.read().strip()
                    if any(image_path in file_content for image_path in image_paths):
                        card_id = int(os.path.splitext(os.path.basename(file_path))[0])
                        # 删除图片文件
                        for image_path in image_paths:
                            full_image_path = os.path.join(get_app_path(), 'images', image_path)
                            if os.path.exists(full_image_path):
                                os.remove(full_image_path)
                                print(f"删除图片: {full_image_path}")
                        break

        # 如果还是没找到，尝试直接匹配内容
        if card_id is None:
            files = glob.glob(os.path.join(CARDS_DIR, '*.txt'))
            for file_path in files:
                with open(file_path, 'r', encoding='utf-8') as f:
                    if card_content.strip()[:200] in f.read().strip():
                        card_id = int(os.path.splitext(os.path.basename(file_path))[0])
                        break

        if card_id is None:
            return jsonify({'status': 'error', 'message': '未找到要删除的内容'})

        # 删除对应的txt文件
        os.remove(os.path.join(CARDS_DIR, f'{card_id}.txt'))
        
        # 重命名后续文件，保持连续性
        files = glob.glob(os.path.join(CARDS_DIR, '*.txt'))
        for i in range(card_id + 1, len(files) + 2):
            old_path = os.path.join(CARDS_DIR, f'{i}.txt')
            if os.path.exists(old_path):
                new_path = os.path.join(CARDS_DIR, f'{i-1}.txt')
                os.rename(old_path, new_path)
        
        # 更新缓存
        cards_cache = load_cards()
        
        return jsonify({'status': 'success'})
            
    except Exception as e:
        print(f"删除卡片出错: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)})

# 支持post 图片 ， 并且保存图片到 images文件夹，返回图片的url
@app.route('/upload', methods=['POST'])
def upload_image():
    image = request.files.get('image')
    if image:
        images_dir = os.path.join(get_app_path(), 'images')
        if not os.path.exists(images_dir):
            os.makedirs(images_dir)
        image.save(os.path.join(images_dir, image.filename))
        return f'/images/{image.filename}'
    return '上传失败'

# 现在系统没有办法get images/ 需要增加相关路由
@app.route('/images/<path:filename>')
def get_image(filename):
    images_dir = os.path.join(get_app_path(), 'images')
    return send_from_directory(images_dir, filename)

# 添加新的路由处理文件上传
@app.route('/upload_file', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return 'No file part', 400
    
    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400
        
    filename = secure_filename(file.filename)
    # 添加随机后缀避免文件名冲突
    base, ext = os.path.splitext(filename)
    filename = f"{base}_{str(int(time.time()))}{ext}"
    
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    # 返回文件URL
    return url_for('uploaded_file', filename=filename)

# 添加路由来访问上传的文件
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    uploads_dir = os.path.join(get_app_path(), 'uploads')
    return send_from_directory(uploads_dir, filename)

def open_browser():
    webbrowser.open('http://127.0.0.1:5000')

@app.route('/api/add_card', methods=['POST'])
def add_card():
    try:
        content = request.json.get('text', '')
        if content:
            if save_card(content):
                return jsonify({'status': 'success', 'content': content})
        return jsonify({'status': 'error', 'message': '内容为空'}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    if sys.platform == 'darwin':  # macOS
        parser = argparse.ArgumentParser(description='Run the LAN clipboard app.')
        parser.add_argument('--port', type=int, default=5002, help='Port number to run the app on.')
        args = parser.parse_args()
    else:
        parser = argparse.ArgumentParser(description='Run the LAN clipboard app.')
        parser.add_argument('--port', type=int, default=5000, help='Port number to run the app on.')
        args = parser.parse_args()


    port = args.port

    app.run(host='0.0.0.0', port=port, debug=False)

# debug
# flask run --debug --host=0.0.0.0 --port 5000
# 打包
# pyinstaller --name=LAN_clipboard_app --add-data "templates;templates" --add-data "static;static" app.py -y
