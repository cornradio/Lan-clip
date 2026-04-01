import os
import sys
import win32com.client
from win32com.shell import shell, shellcon

def get_startup_folder():
    """获取 Windows 启动文件夹路径"""
    return shell.SHGetFolderPath(0, shellcon.CSIDL_STARTUP, 0, 0)

def create_startup_shortcut():
    """创建开机自启快捷方式 (静默模式)"""
    try:
        startup_folder = get_startup_folder()
        shortcut_path = os.path.join(startup_folder, "Lan-clip.lnk")
        
        # 寻找 pythonw.exe (用于无窗口运行)
        python_exe = sys.executable
        pythonw_exe = os.path.join(os.path.dirname(python_exe), "pythonw.exe")
        
        if not os.path.exists(pythonw_exe):
            print("未找到 pythonw.exe，将使用普通 python.exe (会有黑窗口)")
            pythonw_exe = python_exe

        current_dir = os.path.abspath(os.path.dirname(__file__))
        script_path = os.path.join(current_dir, "app.py")
        icon_path = os.path.join(current_dir, "static", "lizard.png")

        # 使用 win32com 创建快捷方式
        wshell = win32com.client.Dispatch("WScript.Shell")
        shortcut = wshell.CreateShortCut(shortcut_path)
        shortcut.Targetpath = pythonw_exe
        # 参数: 运行 app.py 并开启托盘模式
        shortcut.Arguments = f'"{script_path}" --tray'
        shortcut.WorkingDirectory = current_dir
        if os.path.exists(icon_path):
            shortcut.IconLocation = icon_path
        shortcut.WindowStyle = 7  # 7 = Minimized (配合 pythonw 达到完全静默)
        shortcut.save()
        
        print("\n" + "="*50)
        print("✅ 开机自启设置成功！")
        print(f"快捷方式已添加至: {shortcut_path}")
        print(f"运行模式: 静默后台托盘 (pythonw)")
        print("="*50)
        
    except Exception as e:
        print(f"❌ 设置失败: {e}")

def remove_startup_shortcut():
    """删除开机自启"""
    try:
        startup_folder = get_startup_folder()
        shortcut_path = os.path.join(startup_folder, "Lan-clip.lnk")
        if os.path.exists(shortcut_path):
            os.remove(shortcut_path)
            print("✅ 已取消开机自启")
        else:
            print("ℹ️ 未发现已设置的自启项")
    except Exception as e:
        print(f"❌ 取消失败: {e}")

if __name__ == "__main__":
    print("Lan-clip 自动启动管理工具")
    print("1. 开启开机自启 (静默托盘模式)")
    print("2. 取消开机自启")
    
    choice = input("\n请选择功能 (输入数字): ")
    if choice == "1":
        create_startup_shortcut()
    elif choice == "2":
        remove_startup_shortcut()
    else:
        print("无效选择")
    
    input("\n按回车键退出...")
