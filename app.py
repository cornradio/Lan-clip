import os
import sys
import shutil
import re
from flask import Flask, render_template, request, send_from_directory, jsonify, url_for
import webbrowser
import glob
from werkzeug.utils import secure_filename
import argparse
import argparse
import time
import auth_service
import json
import net_utils

PINNED_FILE = 'pinned.json'

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

def log_action(action, details=""):
    client_ip = request.remote_addr
    # 如果有反向代理，尝试获取真实 IP
    if request.headers.get('X-Forwarded-For'):
        client_ip = request.headers.get('X-Forwarded-For').split(',')[0]
    
    now = time.strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{now}] {client_ip} -> {action} {details}")

# 添加全局变量存储卡片
cards_cache = []

# 在文件开头添加配置
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def ensure_cards_dir():
    if not os.path.exists(CARDS_DIR):
        os.makedirs(CARDS_DIR)

def load_pinned():
    try:
        if os.path.exists(PINNED_FILE):
            with open(PINNED_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
    except Exception as e:
        print(f"加载置顶文件出错: {str(e)}")
    return []

def save_pinned(pinned_list):
    try:
        with open(PINNED_FILE, 'w', encoding='utf-8') as f:
            json.dump(pinned_list, f)
    except Exception as e:
        print(f"保存置顶文件出错: {str(e)}")

def load_cards():
    global cards_cache
    try:
        ensure_cards_dir()
        pinned_ids = load_pinned()
        cards = []
        card_files = glob.glob(os.path.join(CARDS_DIR, '*.txt'))
        # 按照数字大小排序
        card_files.sort(key=lambda x: int(os.path.splitext(os.path.basename(x))[0]))
        for card_file in card_files:
            card_id = os.path.splitext(os.path.basename(card_file))[0]
            mtime = os.path.getmtime(card_file)
            time_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
            with open(card_file, 'r', encoding='utf-8') as f:
                cards.append({
                    'id': card_id,
                    'content': f.read().strip(),
                    'time': time_str,
                    'timestamp': mtime,
                    'pinned': card_id in pinned_ids
                })
        
        # 排序：置顶的在前，其余按 ID 倒序（或者按时间，这里原逻辑是 ID 排序后再倒序）
        pinned_cards = [c for c in cards if c['pinned']]
        unpinned_cards = [c for c in cards if not c['pinned']]
        
        # 保持原有的倒序逻辑（最新的在前面）
        pinned_cards.sort(key=lambda x: int(x['id']), reverse=True)
        unpinned_cards.sort(key=lambda x: int(x['id']), reverse=True)
        
        cards_cache = pinned_cards + unpinned_cards
        return cards_cache
    except Exception as e:
        print(f"加载卡片出错: {str(e)}")
        return []

def save_card(content):
    global cards_cache
    try:
        ensure_cards_dir()
        existing_files = glob.glob(os.path.join(CARDS_DIR, '*.txt'))
        if not existing_files:
            next_num = 1
        else:
            ids = [int(os.path.splitext(os.path.basename(f))[0]) for f in existing_files]
            next_num = max(ids) + 1
            
        file_path = os.path.join(CARDS_DIR, f'{next_num}.txt')
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        mtime = os.path.getmtime(file_path)
        time_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
        new_card = {
            'id': str(next_num),
            'content': content,
            'time': time_str,
            'timestamp': mtime
        }
        cards_cache = load_cards()
        return next_num
    except Exception as e:
        print(f"保存卡片出错: {str(e)}")
        return None

@app.route('/', methods=['GET', 'POST'])
def home():
    global cards_cache
    if not cards_cache:  # 始终尝试加载，或者根据需要调整
        cards_cache = load_cards()
    else:
        # 如果缓存有内容，确保置顶状态也是最新的（或者在操作时同步更新缓存）
        pass
    
    if request.method == 'POST':
        new_text = request.form.get('text', '')
        if new_text:
            save_card(new_text)
            log_action("HOME_POST", f"添加文本: {new_text[:50]}...")
            # 重新加载以更新缓存
            load_cards()
    
    return render_template('index.html', cards=cards_cache, port=5000)

@app.route('/clear_history', methods=['POST'])
def clear_history():
    # Verify password
    data = request.get_json(silent=True) or {}
    password = data.get('password')
    if not auth_service.verify_password(password):
         return jsonify({'error': 'Password authentication failed'}), 401

    global cards_cache
    try:
        if os.path.exists(CARDS_DIR):
            for file in os.listdir(CARDS_DIR):
                file_path = os.path.join(CARDS_DIR, file)
                try:
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                except Exception as e:
                    print(f"删除文件 {file_path} 失败: {e}")
        else:
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

        log_action("CLEAR_HISTORY", "清空了所有记录和文件")


        return '', 204
    except Exception as e:
        print(f"清理历史记录出错: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete_card', methods=['POST'])
def delete_card():
    global cards_cache
    try:
        data = request.json
        card_id = data.get('id')
        
        # 尝试通过 ID 删除（首选）
        if card_id:
            file_path = os.path.join(CARDS_DIR, f'{card_id}.txt')
            if os.path.exists(file_path):
                # 如果是文件或图片，先处理相关文件删除
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # 删除关联的上传文件
                    file_matches = re.findall(r'<a href="/uploads/([^"]+)"', content)
                    for filename in file_matches:
                        try:
                            f_path = os.path.join(UPLOAD_FOLDER, filename)
                            if os.path.exists(f_path):
                                os.remove(f_path)
                        except: pass
                    # 删除关联的图片
                    image_paths = re.findall(r'/images/([^"]+)', content)
                    for img_name in image_paths:
                        try:
                            i_path = os.path.join(get_app_path(), 'images', img_name)
                            if os.path.exists(i_path):
                                os.remove(i_path)
                        except: pass
                
                os.remove(file_path)
                
                # 从置顶列表中移除
                pinned_ids = load_pinned()
                if card_id in pinned_ids:
                    pinned_ids.remove(card_id)
                    save_pinned(pinned_ids)
                
                log_action("DELETE_CARD", f"ID: {card_id}")
                cards_cache = load_cards()
                return jsonify({'status': 'success'})

        return jsonify({'status': 'error', 'message': '未找到对应的卡片 ID'})
            
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
        # 为文件名添加随机后缀，避免重复文件名覆盖/无法区分
        orig_filename = secure_filename(image.filename)
        base, ext = os.path.splitext(orig_filename)
        unique_suffix = str(int(time.time() * 1000))
        final_filename = f"{base}_{unique_suffix}{ext}"
        image.save(os.path.join(images_dir, final_filename))
        log_action("UPLOAD_IMAGE", f"文件名: {final_filename}")
        return f'/images/{final_filename}'
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
    log_action("UPLOAD_FILE", f"文件名: {filename}")
    
    # 返回文件URL
    return url_for('uploaded_file', filename=filename)

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    uploads_dir = os.path.join(get_app_path(), 'uploads')
    return send_from_directory(uploads_dir, filename)

@app.route('/api/verify_password', methods=['POST'])
def verify_password_api():
    data = request.json
    pwd = data.get('password')
    if auth_service.verify_password(pwd):
        return jsonify({'valid': True})
    return jsonify({'valid': False})

def open_browser():
    webbrowser.open('http://127.0.0.1:5000')

@app.route('/api/add_card', methods=['POST'])
def add_card():
    try:
        content = request.json.get('text', '')
        if content:
            new_id = save_card(content)
            if new_id:
                load_cards() # Ensure sorting is updated
                log_action("API_ADD_CARD", f"ID: {new_id}, 内容: {content[:30]}...")
                return jsonify({'status': 'success', 'content': content, 'id': str(new_id)})
        return jsonify({'status': 'error', 'message': '内容为空'}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/cards', methods=['GET'])
def get_cards_api():
    global cards_cache
    # 始终确保缓存是最新的，或者根据业务逻辑触发加载
    if not cards_cache:
        cards_cache = load_cards()
    
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 20))
    
    # cards_cache 已经是排序好的了（置顶在前，其余倒序）
    all_cards = cards_cache
    
    start = (page - 1) * size
    end = start + size
    
    return jsonify({
        'cards': all_cards[start:end],
        'has_more': end < len(all_cards)
    })

@app.route('/api/pin_card', methods=['POST'])
def pin_card():
    try:
        card_id = request.json.get('id')
        if not card_id:
            return jsonify({'status': 'error', 'message': 'Missing card ID'}), 400
        
        pinned_ids = load_pinned()
        if card_id not in pinned_ids:
            pinned_ids.append(card_id)
            save_pinned(pinned_ids)
            log_action("PIN_CARD", f"ID: {card_id}")
            load_cards() # 更新缓存
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/unpin_card', methods=['POST'])
def unpin_card():
    try:
        card_id = request.json.get('id')
        if not card_id:
            return jsonify({'status': 'error', 'message': 'Missing card ID'}), 400
        
        pinned_ids = load_pinned()
        if card_id in pinned_ids:
            pinned_ids.remove(card_id)
            save_pinned(pinned_ids)
            log_action("UNPIN_CARD", f"ID: {card_id}")
            load_cards() # 更新缓存
        return jsonify({'status': 'success'})
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
    # app.run(host='0.0.0.0', port=port, debug=False)
    from waitress import serve
    print(f"Server running on http://localhost:{port}")
    net_utils.display_server_info(port)
    serve(app, host="0.0.0.0", port=port)

# debug
# flask run --debug --host=0.0.0.0 --port 5000
# 打包
# pyinstaller --name=LAN_clipboard_app --add-data "templates;templates" --add-data "static;static" app.py -y
