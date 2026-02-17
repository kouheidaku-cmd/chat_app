#環境変数や定数管理を行う
import os
from dotenv import load_dotenv
from pathlib import Path

#.envの読み込み
current_dir = Path(__file__).parent.absolute()
PROJECT_ROOT = current_dir.parent#親ディレクトリにアクセス
env_path = PROJECT_ROOT / ".env"
load_dotenv(dotenv_path=env_path)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL_NAME = "gpt-4o-mini" 

#システムプロンプト
PROMPT_DIR = PROJECT_ROOT / "static/character"
PROMPTS = {}

# 指定したフォルダ内の .txt ファイルを自動スキャン
for txt_file in PROMPT_DIR.glob("*.txt"):
    # ファイル名（拡張子なし）をキーにして読み込む
    # 例: ROLEPLAY_PROMPT.txt -> PROMPTS["ROLEPLAY_PROMPT"]
    with open(txt_file, "r", encoding="utf-8") as f:
        PROMPTS[txt_file.stem] = f.read()