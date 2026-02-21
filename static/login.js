// login.js
async function login() {
    //htmlからのデータの取得
    const username = document.getElementById('username-input').value;
    if (!username) return alert("名前を入力してください");
    const password=document.getElementById('password-input').value;
    if (!password) return alert("パスワードを入力してください")

    // FastAPIにPOST送信し取得したデータを伝える,fetchはブラウザがサーバーと通信するための機能、今までの通信はWebSocket作ってたから不要だった
    //urlに情報を埋め込む方法もあるが安全のためにHTTP通信のBODY部に情報を格納し送信
    //js側でfetch関数を実行→FastAPIがlogin関数を実行→FastAPIの実行結果（return内容）がHTTPレスポンスの中身に詰められる→const response=awit...のresponseに格納される
    const response = await fetch('/login', {
        method: 'POST',
        headers:{
            //application~~~はヘッダーに入れるリクエスト本文の型の一つ
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'username':username,
            'password':password
        })
    });

    //成功の時
    if (response.ok) {
        const data=await response.json();
        console.log("ログイン成功"+data.username);
        window.location.href="/home";
    }else{
        alert("ログインに失敗しました");
    }
}

async function signup() {
    //htmlからのデータの取得
    const username = document.getElementById('newusername-input').value;
    if (!username) return alert("名前を入力してください");
    const password=document.getElementById('newpassword-input').value;
    if (!password) return alert("パスワードを入力してください")

    // FastAPIにPOST送信し取得したデータを伝える,fetchはブラウザがサーバーと通信するための機能、今までの通信はWebSocket作ってたから不要だった
    //urlに情報を埋め込む方法もあるが安全のためにHTTP通信のBODY部に情報を格納し送信
    const response = await fetch('/signup', {
        method: 'POST',
        headers:{
            //application~~~はヘッダーに入れるリクエスト本文の型の一つ
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'username':username,
            'password':password
        })
    });

    if (response.ok) {
        const data=await response.json();
        console.log("サインアップ完了"+data.username);
        window.location.href="/home";
    }else{
        alert("すでにそのユーザネームは登録されています");
    }
}