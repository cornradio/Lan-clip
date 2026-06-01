import argparse
import subprocess
import webbrowser
import sys
import os
from PIL import Image, ImageDraw
import pystray
from pystray import MenuItem, Icon

# Get the directory the program is running in
if getattr(sys, 'frozen', False):
    # If running as a packaged exe
    application_path = os.path.dirname(sys.executable)
else:
    # If running as a python script
    application_path = os.path.dirname(os.path.abspath(__file__))

# Build the full path to clipboard_app.exe
clipboard_app_path = os.path.join(application_path,'LAN_clipboard_app.exe')

# Launch clipboard_app.exe in the background, hiding the command line window
startupinfo = subprocess.STARTUPINFO()
startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
startupinfo.wShowWindow = subprocess.SW_HIDE

# Parse command line arguments
parser = argparse.ArgumentParser(description='Run the LAN clipboard app with custom port.')
parser.add_argument('--port', type=int, default=5000, help='Port number to run the app on.')
args = parser.parse_args()

# Use the parsed port number
port = args.port

# Build the full command for clipboard_app.exe
clipboard_app_command = [clipboard_app_path, f"--port={port}"]

# Launch clipboard_app.exe
clipboard_process = subprocess.Popen(clipboard_app_command, startupinfo=startupinfo)

def create_image(width, height):
    """Create a simple tray icon"""
    image = Image.new('RGB', (width, height), color=(255, 255, 255))
    dc = ImageDraw.Draw(image)
    dc.rectangle(
        (width // 4, height // 4, width * 3 // 4, height * 3 // 4),
        fill=(0, 0, 0)
    )
    return image


def open_website(url):
    """Open the specified website"""
    webbrowser.open(url)

def exit_action(icon, item):
    """Exit the program and close clipboard_app.exe"""
    clipboard_process.terminate()  # Terminate clipboard_app.exe
    icon.stop()  # Stop the tray icon

# Get the IP address
def get_ip():
    cmd = "ipconfig | findstr 192"
    result = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, text=True, encoding='gbk', startupinfo=startupinfo)
    # Only get the first IP address
    ip_list = result.stdout.strip().split('\n')
    if ip_list:
        # Extract the numeric part of the first IP address
        first_ip = ip_list[0]
        import re
        ip_match = re.search(r'192\.\d+\.\d+\.\d+', first_ip)
        if ip_match:
            return ip_match.group()
    return "Unknown IP"

def open_file_location(path):
    """Open the file's location"""
    os.startfile(path)

# Create the tray icon
icon = Icon("Clipboard Loader")
icon.icon = create_image(64, 64)  # Create the icon
icon.title = "Clipboard Loader"

icon.menu = pystray.Menu(
    MenuItem(f"Open 127.0.0.1:{port}", lambda icon, item: open_website(f"http://127.0.0.1:{port}/")),
    MenuItem(f"Open {get_ip()}:{port}", lambda icon, item: open_website(f"http://{get_ip()}:{port}/")),
    # MenuItem to open the file location
    MenuItem("Open File Location", lambda icon, item: open_file_location(application_path+"\\uploads")),
    MenuItem("Exit", exit_action)
)

# Run the tray icon
icon.run()

# make exe
# pyinstaller --onefile --noconsole --clean apploader.py -y