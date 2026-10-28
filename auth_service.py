import hashlib
import hmac
import os

PWD_FILE = 'pwd.txt'

# Fixed scrypt parameters (stdlib). A stored value looks like:
# scrypt$<n>$<r>$<p>$<salt_hex>$<dk_hex>
_SCRYPT_N = 2 ** 14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_SALT_LEN = 16
_SCRYPT_DKLEN = 32
_LEGACY_DEFAULT = '1230'


def _read_pwd_file():
    """Return the stripped pwd.txt contents, or None if the file is missing."""
    if not os.path.exists(PWD_FILE):
        return None
    try:
        with open(PWD_FILE, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except OSError:
        return None


def _write_pwd_file(value):
    """Rewrite pwd.txt in place. The file is bind-mounted, so do not rename over it."""
    with open(PWD_FILE, 'w', encoding='utf-8', newline='\n') as f:
        f.write(value)
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())


def _parse_hash(stored):
    parts = stored.split('$')
    if len(parts) != 6 or parts[0] != 'scrypt':
        return None
    try:
        n = int(parts[1])
        r = int(parts[2])
        p = int(parts[3])
        salt = bytes.fromhex(parts[4])
        dk = bytes.fromhex(parts[5])
    except ValueError:
        return None
    if n != _SCRYPT_N or r != _SCRYPT_R or p != _SCRYPT_P:
        return None
    if len(salt) != _SCRYPT_SALT_LEN or len(dk) != _SCRYPT_DKLEN:
        return None
    return salt, dk


def _hash_password(password, salt=None):
    if salt is None:
        salt = os.urandom(_SCRYPT_SALT_LEN)
    dk = hashlib.scrypt(
        password.encode('utf-8'),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${salt.hex()}${dk.hex()}"


def _verify_hash(password, stored):
    parsed = _parse_hash(stored)
    if parsed is None or not isinstance(password, str):
        return False
    salt, expected = parsed
    try:
        dk = hashlib.scrypt(
            password.encode('utf-8'),
            salt=salt,
            n=_SCRYPT_N,
            r=_SCRYPT_R,
            p=_SCRYPT_P,
            dklen=len(expected),
        )
    except (ValueError, OverflowError):
        return False
    return hmac.compare_digest(dk, expected)


def migrate_plaintext_password():
    """If pwd.txt holds a plaintext password, replace it with a salted scrypt hash.

    The plaintext is checked against the new hash before it is discarded.
    Nothing about the password is written to the log.
    """
    stored = _read_pwd_file()
    if not stored or _parse_hash(stored) is not None:
        return False
    hashed = _hash_password(stored)
    if not _verify_hash(stored, hashed):
        print('password migration aborted: hash self-check failed')
        return False
    _write_pwd_file(hashed)
    written = _read_pwd_file()
    if not _verify_hash(stored, written or ''):
        print('password migration failed: stored hash does not verify')
        return False
    print('password store migrated to scrypt (verified)')
    return True


def verify_password(input_pwd):
    """Check input_pwd against the stored salted hash (or the legacy default)."""
    if not isinstance(input_pwd, str):
        return False
    stored = _read_pwd_file()
    if stored is None:
        return hmac.compare_digest(input_pwd.encode('utf-8'), _LEGACY_DEFAULT.encode('utf-8'))
    if stored == '':
        return input_pwd == ''
    parsed = _parse_hash(stored)
    if parsed is not None:
        return _verify_hash(input_pwd, stored)
    # Startup migration did not run (or failed). Still accept the existing
    # plaintext, then replace it so the file does not keep the password.
    if not hmac.compare_digest(input_pwd.encode('utf-8'), stored.encode('utf-8')):
        return False
    try:
        migrate_plaintext_password()
    except OSError as exc:
        print(f'password migration failed: {exc}')
    return True


try:
    migrate_plaintext_password()
except OSError as exc:
    print(f'password migration failed: {exc}')
