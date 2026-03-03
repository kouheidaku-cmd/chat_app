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
let character=null;
let currentEmotionImg=null;
let currentEmotionImg2=null;
let currentEmotionImg3=null;

let mouthInterval=null;//口パクの状態を管理する変数
let speak_frag=0;//発話のフラッグ
let isMuted=true;//初期状態はマイクオフ
let currentSpeed = 1.0;
let target_text="";//今回の会話の目的をテキスト形式で保存する変数
let target_frag=0;

//------WebSocketの接続設定 (Python側のURLに合わせる)-----
//ウェブブラウザとサーバー間で永続的かつ双方向の通信を可能にする通信プロトコル
const socket = new WebSocket('ws://localhost:8000/ws/chat');

//ファイルを読み込んだ時の処理
window.onload = () => {
    //モードの情報の取得と送信
    const urlParams = new URLSearchParams(window.location.search);
    const selectedMode = urlParams.get('mode') || 'freetalk'; // デフォルトはフリートーク
    const username=localStorage.getItem("user_name")//この時にusernameも送っちゃう

    // WebSocketがつながった後にモード切替命令を送る
    socket.onopen = () => {
        console.log("WebSocket接続成功 / モード:", selectedMode);
        socket.send(JSON.stringify({
            type: "mode_change",
            value: selectedMode,
            username:username
        }));
    };
};

//socketがつながってる間の処理
socket.onmessage = (event) => {//サーバーからメッセージを受信したときの処理
    const data = JSON.parse(event.data);
    console.log("サーバーからのデータ:", data);

    if (data.status==="init_response"){
        //顔画像の準備
        console.log("顔画像準備")
        const initialmsg=data.initial_message;
        character=data.character;
        currentEmotionImg=`/static/character/${character}/neutral.png`;
        currentEmotionImg2=`/static/character/${character}/neutral-2.png`;
        currentEmotionImg3=`/static/character/${character}/neutral-3.png`;
        //瞬きの開始
        startBlinking();
        console.log(initialmsg);
        //背景画像の準備
        const bgFile = data.background; // Python側で send_data に含める必要があります
        const bgContainer = document.getElementById("ai-background");
        //targetの読み込み
        target_text=data.target;
        console.log(target_text);
        
        
        // 2. 背景画像をセット
        if (bgFile) {
            bgContainer.style.backgroundImage = `url('/static/backgrounds/${bgFile}')`;
        }

        //ロード画面を非表示にする
        setTimeout(()=>{
            const loadingScreen = document.getElementById("loading-screen");
            loadingScreen.classList.add("hidden");
            //最初のメッセージの処理
            speak(initialmsg);
            const li = document.createElement("li");//新しいリストアイテム要素を作成
            li.style.marginBottom="10px";//リストアイテムの下に余白を追加
            li.innerHTML=`<strong>AI:</strong> ${initialmsg}`;//リストアイテムの内容を設定
            chatLog.appendChild(li);

        },5000);

        
    }

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
        }, 1000);
    }else if(data.status==="repeat_response"){
        let last_message=data.value
        speak(last_message)
    }else if (data.status==="repeat_response_error"){
        console.log("参照すべき履歴がありません")
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
    currentEmotionImg = `/static/character/${character}/${emotions[ai_emotion]}.png`;
    currentEmotionImg2 = `/static/character/${character}/${emotions[ai_emotion]}-2.png`;
    currentEmotionImg3 = `/static/character/${character}/${emotions[ai_emotion]}-3.png`;

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

//------課題の確認ボタン------
function CheckTarget(){
    if (target_frag==0){
        document.getElementById("check-target").innerText = target_text;
        target_frag=1;
    }else{
        document.getElementById("check-target").innerText = "タスクを確認";
        target_frag=0;
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

//-------もう一度話すボタン,このボタンが押された瞬間にサーバ側に要求を送る--------
function repeatLastAIResponse(){
    const data = {
        type: "repeat_request",
        value: null
    };
    socket.send(JSON.stringify(data));
}


//-------一つ前にやり取りが戻るボタン--------
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
    speak_frag=0;
    
    console.log("最後の一往復を削除しました");
}

//-----途中終了ボタン------------
function forceFinish() {
    if (confirm("会話を終了して、これまでの内容でレポートを作成しますか？")) {
        // AIの音声を止める
        window.speechSynthesis.cancel();
        speak_frag=0;
        
        // サーバーに「強制終了してレポートが欲しい」とリクエストを送る
        // typeは "request_feedback" としても良いですし、
        // 今後の拡張を考えて "force_finish" という新しいtypeを作ってもOKです。
        const data = {
            type: "request_feedback",
            value: null
        };
        socket.send(JSON.stringify(data));

        // 画面上にローディング表示などを出す（任意）
        aiStatus.innerText = "レポートを作成中...";
    }
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
    utter.lang = 'en-US';
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
let recognitionTimer;
let finalTranscript = ''; // 確定した文字列を溜めておく変数

recognition.lang = 'en-US';
recognition.interimResults = true; 
recognition.continuous = true;

recognition.onresult = (event) => {
    if (speak_frag !== 0) return;

    let interimTranscript = ''; // 今、聞き取り中の断片
    
    // 全ての認識結果をループで回して繋ぎ合わせる
    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            // ブラウザが「ここは確定」と判断した部分
            finalTranscript += transcript;
        } else {
            // まだ検討中の部分
            interimTranscript += transcript;
        }
    }

    // 表示用のテキスト（確定分 + 検討中分）
    const fullText = finalTranscript + interimTranscript;
    
    if (fullText.trim()) {
        const chatInput = document.getElementById("chat-input");
        chatInput.value = fullText.trim();

        // タイマーのリセット
        clearTimeout(recognitionTimer);
        recognitionTimer = setTimeout(() => {
            console.log("5秒経過：送信します", fullText.trim());
            submitaction();
            
            // 送信後は、溜めていた文字列をリセットする
            finalTranscript = ''; 
        }, 3000); 
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
