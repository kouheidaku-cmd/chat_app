# auth.py
from passlib.context import CryptContext

# ハッシュ化の設定
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# auth.py の該当箇所
def get_password_hash(password: str):
    # もしバイト列で届いていたら文字列に変換
    if isinstance(password, bytes):
        password = password.decode('utf-8')
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    if isinstance(plain_password, bytes):
        plain_password = plain_password.decode('utf-8')
    return pwd_context.verify(plain_password, hashed_password)