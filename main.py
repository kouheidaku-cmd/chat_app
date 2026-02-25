#----------------プログラム全体を管理するサーバプログラム-----------
from fastapi import FastAPI, WebSocket,Depends, HTTPException,status,Form
from fastapi.responses import FileResponse 
from fastapi.staticfiles import StaticFiles 
from services.chat_service import ChatService
import uvicorn#こいつがサーバ
import json
import models
from database import engine,SessionLocal
from sqlalchemy.orm import Session
from typing import List
from auth import get_password_hash,verify_password
from datetime import datetime

#DBの作成、接続
#サーバ起動時にDBがあるかどうかの確認、もしない場合はtest.dbを作成
models.Base.metadata.create_all(bind=engine)

#APIが呼ばれるたびに新しいDB接続(セッション)を作り処理が終わったらfinallyでdbを閉じる関数
def get_db():
    db=SessionLocal()
    try:
        yield db#yieldは全部値を返すreturnとは異なり関数内で値を一つずつ一時停止して返す
    finally:
        db.close()



#fastapiインスタンスはいろんなファイルをつなぐルーティングを行う、ちなみにサーバではない
#Web APIを作るためのフレームワーク
app = FastAPI()
#フロントエンド部分をユーザ側に公開、これをしないと画像とかにアクセスできなくなる
app.mount("/static", StaticFiles(directory="static"), name="static")


#------以下ルーティング------
#---DB関連-----
#ログイン画面の表示
@app.get("/")
async def get_login():
    return FileResponse('static/login.html')

#usernameとsessionを渡してログインを行う関数
@app.post("/login")
def login(username: str = Form(...), password: str = Form(...),db: Session = Depends(get_db)):#Form(...)で引数がHTTPリクエストのBODYのフォームデータとして送られてきていると宣言
    # DBからユーザーを探す
    user = db.query(models.User).filter(models.User.username == username).first()
    
    if not user or not verify_password(password,user.hashed_password):
        #raise:実行された瞬間に関数の処理が中断 HTTPException:ブラウザにHTTPエラーを返す
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ユーザー名またはパスワードが正しくありません"
        )
    #成功
    return {"message":"ログイン成功","username":user.username}

#usernameとsessionを渡してサインアップを行う関数
@app.post("/signup")
def sinup(username: str = Form(...), password: str = Form(...),db: Session = Depends(get_db)):#Form(...)で引数がHTTPリクエストのBODYのフォームデータとして送られてきていると宣言
    # DBからユーザーを探す
    exising_user = db.query(models.User).filter(models.User.username == username).first()
    print(f"DEBUG: password type is {type(password)}")
    if exising_user :
        #raise:実行された瞬間に関数の処理が中断 HTTPException:ブラウザにHTTPエラーを返す
        raise HTTPException(
            status_code=400,detail="このユーザ名は既に使用されています"
        )
    
    #成功
    #新しいパスワードをハッシュ化して保存
    new_user=models.User(
        username=username,
        hashed_password=get_password_hash(password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message":"ユーザ登録が完了しました"}

#------DB関連終了--------

@app.get("/home")
async def get_home():
    return FileResponse('static/home.html')

@app.get("/profile")
async def get_profile():
    return FileResponse('static/profile.html')

@app.post("/getuserdata")
def sinup(username: str = Form(...),db: Session = Depends(get_db)):#Form(...)で引数がHTTPリクエストのBODYのフォームデータとして送られてきていると宣言
    # DBからユーザーを探す
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user :
        #raise:実行された瞬間に関数の処理が中断 HTTPException:ブラウザにHTTPエラーを返す
        raise HTTPException(
            status_code=404,detail="ユーザーがデータベース上で見つけられませんでした"
        )
    
    #FASTAPIにおける関数の戻り値はデフォルトでjson
    return{
        "username":user.username,
        "created_at":user.created_at.strftime("%Y-%m-%d %H:%M:%S") if user.created_at else "不明"
    }

@app.get("/chat")
async def get_chat():
    return FileResponse('static/chat.html')

@app.get("/chatscript.js")
async def get_js():
    return FileResponse('static/chatscript.js')

# WebSocket 応答ロジック
@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):

    #変数の設定、インスタンスの作成
    chat_service=ChatService()
    username=None
    scenario_id=None

    await websocket.accept()
    print("Client connected")
    try:
        while True:
            # クライアント(ユーザ側)からテキスト（JSON形式）を受信
            data = await websocket.receive_json()

            #roleの選択
            if data["type"]=="mode_change":
                #フロントエンドから送られてきたモードの選択結果によって必要な情報を取得し再度送り返す
                init_data=chat_service.set_mode(data["value"])
                init_data["status"]="init_response"
                username=data["username"]
                scenario_id=data["value"]

                print(f"サーバにusernameが伝わりました：{username}")

                await websocket.send_json(init_data)

            
            #通常のチャット処理
            if data["type"] == "chat":
                print(data)
                # AIから返答を取得
                response = chat_service.get_response(data["value"])
                print(response)
                # クライアントへ返信
                await websocket.send_json({
                    "status": "chat_response",
                    "reply": response["reply"],
                    "ai_emotion": response["ai_emotion"],
                    "session_status":response["session_status"]
                })

                #-------データベースの更新関数-------
                def save_data_to_db(username:str,scenario_id:str,status:str,db: Session):
                    # DB上のuserを検索
                    user=db.query(models.User).filter(
                        models.User.username==username
                    ).first()
                    if not user:
                        print(f"DB上にユーザー：{username}が見つかりませんでした")
                    #useridの取得
                    user_id=user.id
                    
                    #取得したuser_idとscinario_idから該当ユーザーの該当シナリオデータの検索
                    progress=db.query(models.Progress).filter(
                        models.Progress.user_id==user_id,
                        models.Progress.scenario_id==scenario_id
                    ).first()

                    if progress:
                        progress.play_count+=1
                        progress.last_played_at=datetime.now()
                        if status=="end_by_ai":
                            progress.is_cleared=True
                            progress.clear_count+=1
                    else:
                        new_progress=models.Progress(
                            user_id=user_id,
                            scenario_id=scenario_id,
                            play_count=1,
                            last_played_at=datetime.now()
                        )
                        if status=="end_by_ai":
                            new_progress.is_cleared=True
                            new_progress.clear_count=1
                        db.add(new_progress)
                    db.commit()
                    print(f"DEBUG: {username} の進捗を更新しました (Scenario: {scenario_id})")

                
                #chat終了の処理
                if response["session_status"]!="active":#ロールプレイが成功したとき
                    print("ロールプレイ成功！レポート作成します")
                    report_text=chat_service.get_report()
                    # クライアントへ返信
                    await websocket.send_json({
                        "status": "talk_finish",
                        "session_status": response["session_status"],
                        "report":report_text
                    })
                    #DBの更新
                    db=SessionLocal()
                    save_data_to_db(username,scenario_id,response["session_status"],db)
                    db.close()



            #一つ前に戻る処理
            elif data["type"]=="undo":
                chat_service.undo_last()
            #ヒントの処理
            elif data["type"] == "help_request":
                hint_text = chat_service.get_hint()
                await websocket.send_json({
                    "status": "hint_response",
                    "hint": hint_text
                })
            #途中終了の処理
            elif data["type"]=="request_feedback":
                report_text=chat_service.get_report()

                await websocket.send_json({
                    "status": "talk_finish",
                    "session_status": "end_by_user", # ユーザーによる終了
                    "report": report_text
                })

    except Exception as e:
        print(f"Connection closed: {e}")



# pythonサーバの立ち上げ
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)