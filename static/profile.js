let storedName=null;
window.onload = function() {
    // localStorage.getItem('保存した時の名前')
    storedName = localStorage.getItem('user_name');
    
    if (storedName) {
        // 画面上の要素（例：<span id="name-area">）に表示させる
        document.getElementById('name-area').innerText = storedName;
        //サーバにユーザ情報の問い合わせ
        GetUserData(storedName)
    } else {
        // もしデータがなければ、未ログインなのでログイン画面へ追い返す
        window.location.href = "/login";
    }
};


async function GetUserData(storedName) {
    // FastAPIにPOST送信し取得したデータを伝える,fetchはブラウザがサーバーと通信するための機能、今までの通信はWebSocket作ってたから不要だった
    //urlに情報を埋め込む方法もあるが安全のためにHTTP通信のBODY部に情報を格納し送信
    //js側でfetch関数を実行→FastAPIがlogin関数を実行→FastAPIの実行結果（return内容）がHTTPレスポンスの中身に詰められる→const response=awit...のresponseに格納される
    const response = await fetch('/getuserdata', {
        method: 'POST',
        headers:{
            //application~~~はヘッダーに入れるリクエスト本文の型の一つ
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'username':storedName,
        })
    });

    //成功の時
    if (response.ok) {
        const data=await response.json();
        document.getElementById('created-at').innerText = "登録日: " + data.created_at;

    }else{
        alert("ユーザーデータの取得に失敗しました");
    }
}