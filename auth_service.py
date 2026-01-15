import os

PWD_FILE = 'pwd.txt'

def get_stored_password():
    """Reads the password from pwd.txt in the root directory."""
    # Assuming pwd.txt is in the same directory as the main app entry point or explicitly defined
    # Using absolute path logic similar to app.py might be safer, but relative to CWD usually works for this user
    
    if os.path.exists(PWD_FILE):
        try:
            with open(PWD_FILE, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except:
            pass
    return '1230'

def verify_password(input_pwd):
    """Verifies the input password against the stored password."""
    return input_pwd == get_stored_password()
