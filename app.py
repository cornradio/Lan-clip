import os
import sys
import shutil
import re
import zipfile
import io
import time
from flask import Flask, render_template, request, send_from_directory, jsonify, url_for, Response, send_file
import webbrowser
import glob
from werkzeug.utils import secure_filename
import argparse
import time
import auth_service
import json
import net_utils
if sys.platform == 'darwin':
    import tray_manager_mac as tray_manager
else:
    import tray_manager
import threading

PINNED_FILE = 'pinned.json'
PERMISSION_LOCK_FILE = 'perm_lock.json'

# Set the default port
port = 5002 if sys.platform == 'darwin' else 5000

def load_permission_lock():
    try:
        if os.path.exists(PERMISSION_LOCK_FILE):
            with open(PERMISSION_LOCK_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('enabled', False)
    except Exception as e:
        print(f"Error loading permission lock file: {str(e)}")
    return False

def save_permission_lock(enabled):
    try:
        with open(PERMISSION_LOCK_FILE, 'w', encoding='utf-8') as f:
            json.dump({'enabled': enabled}, f)
    except Exception as e:
        print(f"Error saving permission lock file: {str(e)}")

# Global variable tracking the permission lock state
permission_lock_enabled = load_permission_lock()

# Monotonic data revision, bumped on every mutation so clients can poll for changes (live refresh)
_revision_lock = threading.Lock()
data_revision = 0

def bump_revision():
    global data_revision
    with _revision_lock:
        data_revision += 1
        return data_revision

def is_authenticated():
    # Try to obtain the password from various sources
    password = request.headers.get('X-Admin-Password')
    if not password and request.is_json:
        data = request.get_json(silent=True)
        if data:
            password = data.get('password')
    if not password:
        password = request.cookies.get('admin_password')
    
    return auth_service.verify_password(password)

def get_filtered_cards(all_cards, force_show_all=False):
    # Only show all content when force_show_all is True and the user is authenticated
    if force_show_all and is_authenticated():
        return all_cards
    
    # Otherwise, regardless of authentication, only show content from the last 3 days by default
    now = time.time()
    three_days_sec = 3 * 24 * 60 * 60
    return [c for c in all_cards if now - c.get('timestamp', 0) <= three_days_sec]


def resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

# Get the directory the program is running in
def get_app_path():
    if hasattr(sys, '_MEIPASS'):
        return os.path.dirname(sys.executable)
    return os.path.abspath(".")

app = Flask(__name__,
           template_folder=resource_path('templates'),
           static_folder=resource_path('static'))

CARDS_DIR = 'cards'  # New directory for storing cards

def log_action(action, details=""):
    client_ip = request.remote_addr
    # If behind a reverse proxy, try to get the real IP
    if request.headers.get('X-Forwarded-For'):
        client_ip = request.headers.get('X-Forwarded-For').split(',')[0]
    
    now = time.strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{now}] {client_ip} -> {action} {details}")

# Add a global variable to store cards
cards_cache = []

# Add configuration at the start of the file
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
        print(f"Error loading pinned file: {str(e)}")
    return []

def save_pinned(pinned_list):
    try:
        with open(PINNED_FILE, 'w', encoding='utf-8') as f:
            json.dump(pinned_list, f)
    except Exception as e:
        print(f"Error saving pinned file: {str(e)}")

def load_cards():
    global cards_cache
    try:
        ensure_cards_dir()
        pinned_ids = load_pinned()
        cards = []
        card_files = glob.glob(os.path.join(CARDS_DIR, '*.txt'))
        # Sort by numeric value
        card_files.sort(key=lambda x: int(os.path.splitext(os.path.basename(x))[0]))
        for card_file in card_files:
            card_id = os.path.splitext(os.path.basename(card_file))[0]
            mtime = os.path.getmtime(card_file)
            time_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
            with open(card_file, 'r', encoding='utf-8', newline='') as f:
                cards.append({
                    'id': card_id,
                    'content': f.read().strip(),
                    'time': time_str,
                    'timestamp': mtime,
                    'pinned': card_id in pinned_ids
                })
        
        # Sort: pinned first, the rest by ID in descending order (the original logic sorts by ID then reverses)
        pinned_cards = [c for c in cards if c['pinned']]
        unpinned_cards = [c for c in cards if not c['pinned']]
        
        # Keep the original descending order logic (newest first)
        pinned_cards.sort(key=lambda x: int(x['id']), reverse=True)
        unpinned_cards.sort(key=lambda x: int(x['id']), reverse=True)
        
        cards_cache = pinned_cards + unpinned_cards
        return cards_cache
    except Exception as e:
        print(f"Error loading cards: {str(e)}")
        return []

def process_text_content(content):
    if not content:
        return content
    
    # Normalize line breaks to prevent double line breaks on Windows
    content = content.replace('\r\n', '\n').replace('\r', '\n')
    
    # If the content already appears to contain HTML tags (especially card structure), skip processing to avoid breaking the structure
    if '<div' in content or '<img' in content or '<a ' in content or '<script' in content:
        return content
    # Use a regular expression to match all links
    content = re.sub(r'(https?://[^\s]+)', r'<a href="\1" target="_blank">\1</a>', content)
    return content

def save_card(content, timestamp=None):
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
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            f.write(content)
        
        # If a timestamp is provided, set the file's modification time
        if timestamp is not None:
            os.utime(file_path, (timestamp, timestamp))
        
        mtime = os.path.getmtime(file_path)
        time_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))
        new_card = {
            'id': str(next_num),
            'content': content,
            'time': time_str,
            'timestamp': mtime
        }
        cards_cache = load_cards()
        bump_revision()
        return next_num
    except Exception as e:
        print(f"Error saving card: {str(e)}")
        return None

@app.route('/', methods=['GET', 'POST'])
def home():
    global cards_cache
    if not cards_cache:  # Always try to load, or adjust as needed
        cards_cache = load_cards()
    else:
        # If the cache has content, make sure the pinned state is also up to date (or sync the cache during operations)
        pass
    
    if request.method == 'POST':
        new_text = request.form.get('text', '')
        if new_text:
            processed_text = process_text_content(new_text)
            save_card(processed_text)
            log_action("HOME_POST", f"Added text: {processed_text[:50]}...")
            # Reload to update the cache
    has_restricted = len(cards_cache) > len(get_filtered_cards(cards_cache, force_show_all=False))
    return render_template('index.html', 
                          cards=get_filtered_cards(cards_cache, force_show_all=False), 
                          port=port, 
                          permission_lock_enabled=permission_lock_enabled,
                          has_restricted=has_restricted)

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
                    print(f"Failed to delete file {file_path}: {e}")
        else:
            os.makedirs(CARDS_DIR)
        cards_cache = []  # Clear the cache
        
        # Clear the images folder
        images_dir = os.path.join(get_app_path(), 'images')
        if os.path.exists(images_dir):
            for file in os.listdir(images_dir):
                os.remove(os.path.join(images_dir, file))
        # Clear the uploads folder
        if os.path.exists(UPLOAD_FOLDER):
            for file in os.listdir(UPLOAD_FOLDER):
                os.remove(os.path.join(UPLOAD_FOLDER, file))

        log_action("CLEAR_HISTORY", "Cleared all records and files")
        bump_revision()


        return '', 204
    except Exception as e:
        print(f"Error clearing history: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete_card', methods=['POST'])
def delete_card():
    if permission_lock_enabled and not is_authenticated():
        return jsonify({'status': 'error', 'message': 'Administrator password required'}), 401
    global cards_cache
    try:
        data = request.json
        card_id = data.get('id')
        
        # Try deleting by ID (preferred)
        if card_id:
            file_path = os.path.join(CARDS_DIR, f'{card_id}.txt')
            if os.path.exists(file_path):
                # If it is a file or image, handle deletion of related files first
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Delete associated uploaded files
                    file_matches = re.findall(r'<a href="/uploads/([^"]+)"', content)
                    for filename in file_matches:
                        try:
                            f_path = os.path.join(UPLOAD_FOLDER, filename)
                            if os.path.exists(f_path):
                                os.remove(f_path)
                        except: pass
                    # Delete associated images
                    image_paths = re.findall(r'/images/([^"]+)', content)
                    for img_name in image_paths:
                        try:
                            i_path = os.path.join(get_app_path(), 'images', img_name)
                            if os.path.exists(i_path):
                                os.remove(i_path)
                        except: pass
                
                os.remove(file_path)
                
                # Remove from the pinned list
                pinned_ids = load_pinned()
                if card_id in pinned_ids:
                    pinned_ids.remove(card_id)
                    save_pinned(pinned_ids)
                
                log_action("DELETE_CARD", f"ID: {card_id}")
                cards_cache = load_cards()
                bump_revision()
                return jsonify({'status': 'success', 'rev': data_revision})

        return jsonify({'status': 'error', 'message': 'No matching card ID found'})
            
    except Exception as e:
        print(f"Error deleting card: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)})

# Support POST of images, save the image to the images folder, and return the image URL
@app.route('/upload', methods=['POST'])
def upload_image():
    image = request.files.get('image')
    if image:
        images_dir = os.path.join(get_app_path(), 'images')
        if not os.path.exists(images_dir):
            os.makedirs(images_dir)
        # Add a random suffix to the filename to avoid duplicate filenames overwriting or being indistinguishable
        orig_filename = secure_filename(image.filename)
        base, ext = os.path.splitext(orig_filename)
        unique_suffix = str(int(time.time() * 1000))
        final_filename = f"{base}_{unique_suffix}{ext}"
        image.save(os.path.join(images_dir, final_filename))
        log_action("UPLOAD_IMAGE", f"Filename: {final_filename}")
        return f'/images/{final_filename}'
    return 'Upload failed'

# The system currently has no way to GET images/, so the corresponding route needs to be added
@app.route('/images/<path:filename>')
def get_image(filename):
    images_dir = os.path.join(get_app_path(), 'images')
    return send_from_directory(images_dir, filename)

# Add a new route to handle file uploads
@app.route('/upload_file', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return 'No file part', 400
    
    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400
        
    filename = secure_filename(file.filename)
    # Add a random suffix to avoid filename conflicts
    base, ext = os.path.splitext(filename)
    filename = f"{base}_{str(int(time.time()))}{ext}"
    
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    log_action("UPLOAD_FILE", f"Filename: {filename}")

    # Return the file URL
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

@app.route('/api/permission_config', methods=['GET', 'POST'])
def permission_config():
    global permission_lock_enabled
    if request.method == 'POST':
        data = request.json
        password = data.get('password')
        if not auth_service.verify_password(password):
            return jsonify({'error': 'Password verification failed'}), 401
        
        permission_lock_enabled = data.get('enabled', False)
        save_permission_lock(permission_lock_enabled)
        log_action("SET_PERMISSION_LOCK", f"{permission_lock_enabled}")
        return jsonify({'status': 'success', 'enabled': permission_lock_enabled})
    
    return jsonify({'enabled': permission_lock_enabled})

def open_browser():
    webbrowser.open('http://127.0.0.1:5000')

@app.route('/api/add_card', methods=['POST'])
def add_card():
    try:
        content = request.json.get('text', '')
        timestamp = request.json.get('timestamp')
        if content:
            # Automatically process URL links
            processed_content = process_text_content(content)
            new_id = save_card(processed_content, timestamp=timestamp)
            if new_id:
                load_cards() # Ensure sorting is updated
                log_action("API_ADD_CARD", f"ID: {new_id}, content: {processed_content[:30]}...")
                return jsonify({'status': 'success', 'content': processed_content, 'id': str(new_id), 'rev': data_revision})
        return jsonify({'status': 'error', 'message': 'Content is empty'}), 400
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/cards', methods=['GET'])
def get_cards_api():
    global cards_cache
    # Always ensure the cache is up to date, or trigger loading based on business logic
    if not cards_cache:
        cards_cache = load_cards()
    
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 20))
    show_old = request.args.get('show_old', 'false').lower() == 'true'
    
    # cards_cache is already sorted (pinned first, the rest in descending order)
    filtered_cards = get_filtered_cards(cards_cache, force_show_all=show_old)
    
    all_cards = filtered_cards
    
    start = (page - 1) * size
    end = start + size
    
    return jsonify({
        'cards': all_cards[start:end],
        'has_more': end < len(all_cards),
        'has_restricted': len(cards_cache) > len(get_filtered_cards(cards_cache, force_show_all=False))
    })

@app.route('/api/pin_card', methods=['POST'])
def pin_card():
    if permission_lock_enabled and not is_authenticated():
        return jsonify({'status': 'error', 'message': 'Administrator password required'}), 401
    try:
        card_id = request.json.get('id')
        if not card_id:
            return jsonify({'status': 'error', 'message': 'Missing card ID'}), 400

        pinned_ids = load_pinned()
        if card_id not in pinned_ids:
            pinned_ids.append(card_id)
            save_pinned(pinned_ids)
            log_action("PIN_CARD", f"ID: {card_id}")
            load_cards() # Update the cache
            bump_revision()
        return jsonify({'status': 'success', 'rev': data_revision})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/unpin_card', methods=['POST'])
def unpin_card():
    if permission_lock_enabled and not is_authenticated():
        return jsonify({'status': 'error', 'message': 'Administrator password required'}), 401
    try:
        card_id = request.json.get('id')
        if not card_id:
            return jsonify({'status': 'error', 'message': 'Missing card ID'}), 400

        pinned_ids = load_pinned()
        if card_id in pinned_ids:
            pinned_ids.remove(card_id)
            save_pinned(pinned_ids)
            log_action("UNPIN_CARD", f"ID: {card_id}")
            load_cards() # Update the cache
            bump_revision()
        return jsonify({'status': 'success', 'rev': data_revision})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/export')
def export_content():
    # Export content: package cards.json, images/, uploads/
    try:
        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Package card data
            if os.path.exists(CARDS_FILE):
                 zf.write(CARDS_FILE, 'cards.json')
            # Package the images folder
            if os.path.exists('images'):
                for root, dirs, files in os.walk('images'):
                    for file in files:
                        zf.write(os.path.join(root, file))
            # Package the uploads folder
            if os.path.exists('uploads'):
                for root, dirs, files in os.walk('uploads'):
                    for file in files:
                        zf.write(os.path.join(root, file))
        memory_file.seek(0)
        filename = f"lan_clip_package_{int(time.time())}.zip"
        return send_file(memory_file, download_name=filename, as_attachment=True)
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/import', methods=['POST'])
def import_content():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'No file selected'}), 400
    
    try:
        # Extract the ZIP to the current directory
        with zipfile.ZipFile(file, 'r') as zf:
            zf.extractall('.')
        
        # Force a reload of the cache
        global cards_cache
        cards_cache = load_cards()
        log_action("IMPORT_CONTENT", "Content successfully imported from ZIP")
        bump_revision()
        return jsonify({'status': 'success', 'message': 'Import successful'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/revision', methods=['GET'])
def get_revision():
    # Lightweight endpoint clients poll to detect changes (live refresh)
    return jsonify({'rev': data_revision})

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run the LAN clipboard app.')
    parser.add_argument('--port', type=int, default=port, help='Port number to run the app on.')
    parser.add_argument('--tray', action='store_true', help='Enable system tray mode')
    args = parser.parse_args()
    
    port = args.port
    
    from waitress import serve
    
    def start_server():
        print(f"Server running on http://localhost:{port}")
        net_utils.display_server_info(port)
        serve(app, host="0.0.0.0", port=port)

    if args.tray:
        # Tray mode: start the server in a background thread
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()
        
        # Start the tray icon (the main thread blocks here)
        icon_path = resource_path(os.path.join('static', 'lizard.png'))
        tray_manager.start_tray(port, icon_path)
    else:
        # Normal mode
        start_server()

# debug
# flask run --debug --host=0.0.0.0 --port 5000
# Build/package
# pyinstaller --name=LAN_clipboard_app --add-data "templates;templates" --add-data "static;static" app.py -y
