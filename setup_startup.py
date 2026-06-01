import os
import sys
import win32com.client
from win32com.shell import shell, shellcon

def get_startup_folder():
    """Get the Windows Startup folder path"""
    return shell.SHGetFolderPath(0, shellcon.CSIDL_STARTUP, 0, 0)

def create_startup_shortcut():
    """Create a startup shortcut (silent mode)"""
    try:
        startup_folder = get_startup_folder()
        shortcut_path = os.path.join(startup_folder, "Lan-clip.lnk")
        
        # Find pythonw.exe (for windowless execution)
        python_exe = sys.executable
        pythonw_exe = os.path.join(os.path.dirname(python_exe), "pythonw.exe")
        
        if not os.path.exists(pythonw_exe):
            print("pythonw.exe not found; falling back to regular python.exe (a console window will appear)")
            pythonw_exe = python_exe

        current_dir = os.path.abspath(os.path.dirname(__file__))
        script_path = os.path.join(current_dir, "app.py")
        icon_path = os.path.join(current_dir, "static", "lizard.png")

        # Create the shortcut using win32com
        wshell = win32com.client.Dispatch("WScript.Shell")
        shortcut = wshell.CreateShortCut(shortcut_path)
        shortcut.Targetpath = pythonw_exe
        # Arguments: run app.py and enable tray mode
        shortcut.Arguments = f'"{script_path}" --tray'
        shortcut.WorkingDirectory = current_dir
        if os.path.exists(icon_path):
            shortcut.IconLocation = icon_path
        shortcut.WindowStyle = 7  # 7 = Minimized (combined with pythonw for completely silent operation)
        shortcut.save()
        
        print("\n" + "="*50)
        print("✅ Startup entry set up successfully!")
        print(f"Shortcut added to: {shortcut_path}")
        print(f"Run mode: silent background tray (pythonw)")
        print("="*50)
        
    except Exception as e:
        print(f"❌ Setup failed: {e}")

def remove_startup_shortcut():
    """Remove the startup entry"""
    try:
        startup_folder = get_startup_folder()
        shortcut_path = os.path.join(startup_folder, "Lan-clip.lnk")
        if os.path.exists(shortcut_path):
            os.remove(shortcut_path)
            print("✅ Startup entry removed")
        else:
            print("ℹ️ No startup entry found")
    except Exception as e:
        print(f"❌ Removal failed: {e}")

if __name__ == "__main__":
    print("Lan-clip startup management tool")
    print("1. Enable startup (silent tray mode)")
    print("2. Disable startup")

    choice = input("\nSelect an option (enter a number): ")
    if choice == "1":
        create_startup_shortcut()
    elif choice == "2":
        remove_startup_shortcut()
    else:
        print("Invalid choice")

    input("\nPress Enter to exit...")
