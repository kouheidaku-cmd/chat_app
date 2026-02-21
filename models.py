#テーブルの設計図,sqlalchemyのおかげでSQL文を使わずにdbの操作を行える
from sqlalchemy import Column,Integer,String,Boolean,ForeignKey,DateTime#SQL文で使う文法？の読み込み
from database import Base#database.pyからの読み込み,すべてのテーブルの親となるクラス
from datetime import datetime,timezone

class User(Base):#これはBaseクラスを継承している
    __tablename__="users"
    id=Column(Integer,primary_key=True,index=True)#primary_key:主キー index:インデックスつけることで高速化　ちなみにColumnはカラム(列の縦)のこと
    username=Column(String,unique=True,index=True)#unique:同じusernameは登録不可
    hashed_password = Column(String)
    is_premium=Column(Boolean,default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Progress(Base):
    __tablename__="progress"
    id=Column(Integer,primary_key=True)
    user_id=Column(Integer,ForeignKey("users.id"))#ForeignKey:外部キーを使ってusersテーブルのidと紐づけ
    scenario_id=Column(String)
    is_cleared=Column(Boolean,default=False)

