//html要素の取得
const chatLog=document.getElementById("chat-log"); //チャットの履歴の表示欄
const chatInput=document.getElementById("chat-input");//chatの入力欄
const sendButton=document.getElementById("send-button");//chatの送信ボタン要素を取得
const muteButton=document.getElementById("mute-button");
const aiFace=document.getElementById("ai-face");//aiの顔
const aiStatus=document.getElementById("ai-status");//aiの感情
const speedRange = document.getElementById("speed-range");
const speedValue = document.getElementById("speed-value");


//AIの表情画像のパス管理
let currentEmotionImg="/static/character/neutral.png";//グローバル変数でAIの感情画像を保持
let currentEmotionImg2="/static/character/neutral-2.png";
let currentEmotionImg3="/static/character/neutral-3.png";

let mouthInterval=null;//口パクの状態を管理する変数
let speak_frag=0;//発話のフラッグ
let isMuted=true;//初期状態はマイクオフ
let currentSpeed = 1.0;
let lastAiResponse = ""; // 最新のAIの返答を保持する変数

//------WebSocketの接続設定 (Python側のURLに合わせる)-----
//ウェブブラウザとサーバー間で永続的かつ双方向の通信を可能にする通信プロトコル
const socket = new WebSocket('ws://localhost:8000/ws/chat');

//ファイルを読み込んだ時の処理
window.onload = () => {
    //瞬きの開始
    startBlinking();

    //モードの情報の取得と送信
    const urlParams = new URLSearchParams(window.location.search);
    const selectedMode = urlParams.get('mode') || 'freetalk'; // デフォルトはフリートーク

    // WebSocketがつながった後にモード切替命令を送る
    socket.onopen = () => {
        console.log("WebSocket接続成功 / モード:", selectedMode);
        socket.send(JSON.stringify({
            type: "mode_change",
            value: selectedMode
        }));
    };
};

//socketがつながってる間の処理
socket.onmessage = (event) => {//サーバーからメッセージを受信したときの処理
    const data = JSON.parse(event.data);

    if (data.status==="chat_response"){//サーバーからAIの返答を受信したときの処理
        lastAiResponse=data.reply
        //音声の発生
        speak(data.reply);

        //チャットログに返信を追加
        const li = document.createElement("li");//新しいリストアイテム要素を作成
        li.style.marginBottom="10px";//リストアイテムの下に余白を追加
        li.innerHTML=`<strong>AI:</strong> ${data.reply}`;//リストアイテムの内容を設定
        chatLog.appendChild(li);

        //AIの表情を変換
        updateAiFace(data.ai_emotion);
        
    }else if (data.status === "hint_response") {
        // ヒントを表示する
        document.getElementById("hint-text").innerText = data.hint;
    }else if(data.status==="talk_finish"){
        console.log("レポート受け取りました")
        setTimeout(() => {
            // チャットログなどを隠してレポートを表示する
            document.getElementById("chat-section").style.display = "none"; 
            const reportSection = document.getElementById("report-section");
            const reportText = document.getElementById("report-text");
            
            reportText.innerText = data.report; // サーバーから届いたレポートを入れる
            reportSection.classList.remove("hidden");
            reportSection.style.display = "block";
        }, 3000);
    }
};

//-----AIの感情を切り替える関数-----
function updateAiFace(ai_emotion){
    const emotions={
        "喜び": "happy",
        "悲しみ": "sad",
        "驚き": "surprised",
        "怒り": "angry",
        "嫌悪": "disgusted",
        "恐れ": "fearful",
        "自然体":"neutral"
    };
    currentEmotionImg = `/static/character/${emotions[ai_emotion]}.png`;
    currentEmotionImg2 = `/static/character/${emotions[ai_emotion]}-2.png`;
    currentEmotionImg3 = `/static/character/${emotions[ai_emotion]}-3.png`;

    aiFace.src=currentEmotionImg
    aiStatus.innerText=`AIの状態:${ai_emotion}`
}


//-----メッセージ送信関数-----
function submitaction(){
    if (chatInput.value.trim()===""){
        return;
    }
    const data={
        type:"chat",
        value:chatInput.value
    }
    socket.send(JSON.stringify(data));
    chatInput.value = ""; // index側の入力欄を空にする
    //チャットログに追加
    const li = document.createElement("li");//新しいリストアイテム要素を作成
    li.style.marginBottom="10px";//リストアイテムの下に余白を追加
    li.innerHTML=`<strong>あなた:</strong> ${data.value}`;//リストアイテムの内容を設定
    chatLog.appendChild(li);
}

//エンターキーでチャット送信
function enterKeyPress(event){
    if(event.key==="Enter"){
        submitaction();
    }
}

//-----マイクオンオフボタン-----
function muteButtonPress(){
    isMuted=!isMuted;//状態の反転
    
    if (isMuted){
        recognition.stop();
        muteButton.innerText = "🔇 マイクOFF";
        muteButton.classList.add("muted"); // CSSで色を変える用
    }else{
        recognition.start();
        muteButton.innerText = "🎤 マイクON";
        muteButton.classList.remove("muted");
    }
}

//------お助けボタン------
function requestHelp(){
    const hintDisplay=document.getElementById("hint-display");
    const hintText=document.getElementById("hint-text");
    
    // もし今表示されているなら、非表示にして関数を抜ける
    if (hintDisplay.style.display === "block") {
        hintDisplay.style.display = "none";
        return;
    }

    const data={
        type:"help_request",
        value:null
    };
    socket.send(JSON.stringify(data));

    hintDisplay.style.display = "block";
    hintText.innerText = "考え中...";
}

//-------もう一度話す--------
function repeatLastAIResponse(){
    if (lastAiResponse){
        speak(lastAiResponse);
    }else{
        console.log("まだAIの返答がありません")
    }
}

//-------一つ前にやり取りが戻る--------
function undoLastMessage() {
    //画面上のログを削除（自分とAIの最後の1往復分）
    for (let i = 0; i < 2; i++) {
        if (chatLog.lastChild) {
            chatLog.removeChild(chatLog.lastChild);
        }
    }

    //サーバー（Python）側に「最後の一往復を消して」と命令を送る、これによりchat_historyを消す
    const data = {
        type: "undo",
        value: null
    };
    socket.send(JSON.stringify(data));
    
    //AIの発話を止める（もし喋っている最中なら）
    window.speechSynthesis.cancel();
    
    console.log("最後の一往復を削除しました");
}

//-----音声を発声させる関数-----
function speak(text) {
    if (!window.speechSynthesis) {
        console.error('このブラウザは音声読み上げに対応していません');
        return;
    }

    speak_frag=1;//話してる時のfragを上げる

    //今発生している音を中断、ちなみにwindowはブラウザのタブそのものを表すjsの最上位のオブジェクト
    window.speechSynthesis.cancel();

    const resumeInfinity=setInterval(()=>{
        if (!window.speechSynthesis.speaking){
            clearInterval(resumeInfinity);
        }else{
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
        }
    },10000);

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    utter.rate = currentSpeed;
    utter.pitch = 1.5;

    utter.onstart = () => {//utter.onstartという変数に処理そのものを代入、utterが始まった途端start操作を行う
        console.log("onstart fired");
        if (mouthInterval) clearInterval(mouthInterval);//mouthIntervalが存在する場合削除

        mouthInterval = setInterval(() => {
            aiFace.src = aiFace.src.includes(currentEmotionImg)
                ? currentEmotionImg2
                : currentEmotionImg;
        }, 200);
    };


    // 💡 読み上げ終了
    utter.onend = () => {
        if (mouthInterval) {
            clearInterval(mouthInterval);
            mouthInterval = null;
        }
        // 終了時は確実に「閉じ口」に戻す
        aiFace.src = currentEmotionImg;
        console.log("口パク終了");
        setTimeout(()=>{//プログラムとブラウザのタイムラグを埋める調整
            speak_frag=0;
            console.log("マイク有効");
        },1000);
    };

    window.speechSynthesis.speak(utter);//ここで音声の発話を行う
}

//-----瞬きを行う関数-----
function startBlinking(){
    //瞬きを行う感覚をランダムに生成
    const nextBlinking=Math.random()*3000+3000;

    //nextBlinking後に以下の動作を行う
    setTimeout(()=>{
        //AIがしゃべっていないときに瞬きさせる
        if(!mouthInterval){
            aiFace.src=currentEmotionImg3;
            //150ミリ秒後普通の顔に戻す
            setTimeout(()=>{
                aiFace.src=currentEmotionImg;
                startBlinking();
            },200);
        }else{
            startBlinking();
        }
    },nextBlinking);
}


//-----音声入力を行う関数-----
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;//音声認識機能の読み込み
const recognition = new SpeechRecognition();//音声認識マシンのインスタンスを作成

recognition.lang = 'ja-JP';      // 日本語
recognition.interimResults = false; // 確定した結果だけ受け取る
recognition.continuous = true;   // 常に聞き続ける

// 音声を認識した時の処理
recognition.onresult = (event) => {
    if (speak_frag==0){//AIの発話中聞き取り機能オフに
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        if (transcript) {
            console.log("認識された声:", transcript);
            
            // 入力欄に文字を入れて、そのまま送信関数を呼ぶ
            const chatInput = document.getElementById("chat-input");
            chatInput.value = transcript;
            submitaction(); 
        }
    }
};
// エラーや停止時の自動再起動
// 自動再起動ロジックに「ミュート中でないこと」という条件を追加します
recognition.onend = () => {
    if (!isMuted && speak_frag === 0) {
        console.log("自動再起動中...");
        try {
            recognition.start();
        } catch (e) {
            console.error("再起動失敗:", e);
        }
    }
};

//---------スライダーが動かされた時に話すスピードの値を更新---------
speedRange.addEventListener("input", (e) => {
    currentSpeed = parseFloat(e.target.value);
    speedValue.innerText = currentSpeed.toFixed(1); // 表示を更新（例: 0.8）
});

//------実行中の動作------
//ボタンを押すことによりチャット送信
sendButton.addEventListener("click",submitaction);
