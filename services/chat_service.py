from openai import OpenAI
from core.config import OPENAI_API_KEY,MODEL_NAME
import json
import os

#AIチャットに関するクラスを定義、この基本的な機能はすべてのユーザに共通
class ChatService:
    def __init__(self):
        self.client=OpenAI(api_key=OPENAI_API_KEY)
        self.max_history=30#ロールプレイ用の最大数
        self.status="active"
        #モード選択により決定される部分
        self.mode="freetalk"
        self.chat_history=[]
        self.fnish_conditions=None

        #JSONファイルからの読み込み
        json_path=os.path.join("static","scenarios.json")
        with open(json_path,"r",encoding="utf-8") as f:
            self.scenarios=json.load(f)

    def set_mode(self,mode_name):
        self.mode=mode_name

        #JSONから該当するモードの設定を取得
        config=self.scenarios.get(mode_name)

        if config:
            prompt_key=config.get("prompt_key")
            finish_key=config.get("finish_conditions")
            initial_message_text=config.get("initial_message")
            character_name=config.get("character")
        else:
            print("エラー：シナリオが存在しません")

        print(character_name)
        
        def read_prompt_file(filename):
            path=os.path.join("static","prompts",f"{filename}.txt")
            if os.path.exists(path):
                with open(path,"r",encoding="utf-8")as f:
                    return f.read()
            return ""
        
        #各種設定の読み込み
        system_main=read_prompt_file(prompt_key)
        self.chat_history=[{"role":"system","content":system_main}]
        self.fnish_conditions=read_prompt_file(finish_key)

        #必要なものをフロントエンドへ送る
        send_data={
            "mode_name":f"{mode_name}",
            "character":f"{character_name}",
            "initial_message":f"{initial_message_text}"
        }
        return send_data

    
    def get_response(self,user_text):
        #ユーザ履歴を追加
        self.chat_history.append({"role":"user","content":user_text})
        print(user_text)
        # OpenAI用のプロンプト組み立て
        prompt=None
        if self.mode=="freetalk":
            prompt = (
                f"ユーザーからのメッセージ：{user_text}\n"
                "会話の流れをスムーズにするため返答の生成はできるだけ早く行ってください。\n"
                "また、話し言葉を想定し箇条書きなどは控えてください\n"
                "以下のJSON形式で返答してください：\n"
                "{ \"reply\": \"返答\", \"ai_emotion\": \"喜び/悲しみ/驚き/自然体/怒り/嫌悪/恐れ\" }\n" 
                "注意点としてai_emotionには心配は含まれておりません"
                    )
        else:
            prompt=(
                f"ユーザーからのメッセージ：{user_text}\n"
                "会話の流れをスムーズにするため返答の生成はできるだけ早く行ってください。\n"
                "また、話し言葉を想定し箇条書きなどは控えてください\n"
                "以下のJSON形式で返答してください：\n"
                "{ \"reply\": \"返答\", \"ai_emotion\": \"喜び/悲しみ/驚き/自然体/怒り/嫌悪/恐れ\" }\n" 
                "注意点としてai_emotionには心配は含まれておりません"
                f"終了条件:{self.fnish_conditions}"
            )
        current_messages = self.chat_history + [{"role": "user", "content": prompt}]

        # OpenAI APIを呼び出して応答を生成
        response = self.client.chat.completions.create(
            model=MODEL_NAME,
            messages=current_messages,#この時履歴も一緒に渡す
            response_format={"type": "json_object"}
        )
        response_json=json.loads(response.choices[0].message.content)
        #chat_historyの更新
        self.chat_history.append({"role":"assistant","content":response_json["reply"]})

        #chat_historyの更新
        if self.mode=="freetalk":
            if len(self.chat_history) > 11:
                self.chat_history = [self.chat_history[0]] + self.chat_history[-10:]
        else:
            if "[SESSION_END]" in response_json["reply"]:
                self.status="end_by_ai"
                # 画面表示用に [SESSION_END] の文字だけ消しておく
                #response_json["reply"] = response_json["reply"].replace("[SESSION_END]", "").strip()
                print(self.status)
                print(self.chat_history)
            if len(self.chat_history)>=self.max_history:
                self.status="end_by_limit"
        #インスタンスの状態もjsonデータに加える
        response_json["session_status"]=self.status
        return response_json
    
    def undo_last(self):
        if len(self.chat_history)>2:
            self.chat_history.pop()
            self.chat_history.pop()
            print("サーバ側の履歴一往復削除")

    def get_hint(self):
        # ヒント生成用の短いプロンプトを作成
        hint_prompt = (
            "これまでの会話の流れを踏まえて、role:userが次に言える短いフレーズを3つ提案してください。"
            "1. [フレーズ] \n2. [フレーズ] ..."
        )
        
        # 履歴を壊さないように、コピーしたメッセージにヒント用プロンプトを足して送る
        temp_messages = self.chat_history + [{"role": "system", "content": hint_prompt}]
        
        response = self.client.chat.completions.create(
            model=MODEL_NAME,
            messages=temp_messages
        )
        
        return response.choices[0].message.content
    
    def get_report(self):
        report_prompt=None
        if self.mode=="freetalk":
            #レポート生成用のプロンプトを渡す
            report_prompt = (
                "role:userは言語の学習者です"
                "role:userの対話相手はrole:assistantです"
                "これまでの会話の流れを踏まえて、role:userの文法的な間違いや改善点があれば指摘してください"
                "userからのメッセージに返信する必要性はありません"
            )
        else:
            #レポート生成用のプロンプトを渡す
            report_prompt = (
                "role:userは言語の学習者です"
                f"role:userとの対話相手であるrole:assistantは以下のようなプロンプトで設定されていました：{self.chat_history[0]}"
                f"role:userとの会話の状態は最終的にこのような状態で終了しました。status:{self.status}  ただし各statusはそれぞれ以下の意味です。active:ユーザ側で会話が途中終了されました。　end_by_ai:ユーザが課題を解決しました　end_by_limit:ユーザは指定の回数以内の会話で課題を解決できませんでした"
                "これまでの会話の流れを踏まえて、role:userの文法的な間違いや改善点があれば指摘してください"

            )
            
        #システムプロンプトは除外
        temp_messages = self.chat_history[1:] + [{"role": "system", "content": report_prompt}]
            
        response = self.client.chat.completions.create(
            model=MODEL_NAME,
            messages=temp_messages
        )
        
        return response.choices[0].message.content