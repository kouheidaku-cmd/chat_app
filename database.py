from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

#SQLiteは「./test.db」というファイルにデータを保存
SQLALCHEMY_DATABASE_URL="sqlite:///./test.db"

#エンジンの作成、engine:dbの中でユーザが求める情報を取ってくるシステム
engine=create_engine(
    SQLALCHEMY_DATABASE_URL,connect_args={"check_same_thread":False}
)

#データベース操作用のセッション
SessionLocal=sessionmaker(autocommit=False,autoflush=False,bind=engine)

Base=declarative_base()

