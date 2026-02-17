from openai import OpenAI
from core.config import OPENAI_API_KEY,MODEL_NAME,PROMPTS
import json

#AIチャットに関するクラスを定義、この基本的な機能はすべてのユーザに共通
class ChatService:
    def __init__(self):
        self.client=OpenAI(api_key=OPENAI_API_KEY)
        self.chat_history=[]
        self.mode="freetalk"
        self.max_history=30#ロールプレイ用の最大数
        self.status="active"

    def set_mode(self,mode_name):
        self.mode=mode_name
        if mode_name == "roleplay":
            self.chat_history = [{"role": "system", "content": PROMPTS["ROLEPLAY_PROMPT"]}]
        else:
            self.chat_history = [{"role": "system", "content": PROMPTS["FREETALK_PROMPT"]}]
    
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
        elif self.mode=="roleplay":
            prompt=(
                f"ユーザーからのメッセージ：{user_text}\n"
                "会話の流れをスムーズにするため返答の生成はできるだけ早く行ってください。\n"
                "また、話し言葉を想定し箇条書きなどは控えてください\n"
                "以下のJSON形式で返答してください：\n"
                "{ \"reply\": \"返答\", \"ai_emotion\": \"喜び/悲しみ/驚き/自然体/怒り/嫌悪/恐れ\" }\n" 
                "注意点としてai_emotionには心配は含まれておりません"
                f"終了条件:{PROMPTS["finish_conditions"]}"
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
        elif self.mode=="roleplay":
            if "[SESSION_END]" in response_json["reply"]:
                self.status="end_by_ai"
                # 画面表示用に [SESSION_END] の文字だけ消しておく
                #response_json["reply"] = response_json["reply"].replace("[SESSION_END]", "").strip()
                print(self.status)
            if len(self.chat_history)>=self.max_history:
                self.status="end_by_limit"

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