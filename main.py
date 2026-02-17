#----------------プログラム全体を管理するサーバプログラム-----------
from fastapi import FastAPI, WebSocket
from fastapi.responses import FileResponse 
from fastapi.staticfiles import StaticFiles 
from services.chat_service import ChatService
import uvicorn#こいつがサーバ


#fastapiインスタンスはいろんなファイルをつなぐルーティングを行う、ちなみにサーバではない
app = FastAPI()
#フロントエンド部分をユーザ側に公開、これをしないと画像とかにアクセスできなくなる
app.mount("/static", StaticFiles(directory="static"), name="static")

#インスタンス化
chat_service=ChatService()

#------以下ルーティング------
@app.get("/")
async def get_index():
    return FileResponse('static/index.html')

@app.get("/chat")
async def get_chat():
    return FileResponse('static/chat.html')

@app.get("/chatscript.js")
async def get_js():
    return FileResponse('static/chatscript.js')

# WebSocket 応答ロジック
@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()
    print("Client connected")
    try:
        while True:
            # クライアント(ユーザ側)からテキスト（JSON形式）を受信
            data = await websocket.receive_json()

            #roleの選択
            if data["type"]=="mode_change":
                chat_service.set_mode(data["value"])

            
            #通常のチャット処理
            if data["type"] == "chat":
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
                #chat終了の処理
                if response["session_status"]!="active":
                    print("レポート作成します")
                    report_text=chat_service.get_report()
                    # クライアントへ返信
                    await websocket.send_json({
                        "status": "talk_finish",
                        "session_status": response["session_status"],
                        "report":report_text
                    })
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