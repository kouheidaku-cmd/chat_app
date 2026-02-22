function dofreetalk() {
    // chat.htmlにモード情報を付けて遷移
    window.location.href = `/chat?mode=freetalk`;
}
function showRoleplaySelect(){
    document.getElementById("main-menu").classList.add("hidden");//画面の切り替えは要はクラスの付け替え
    document.getElementById("roleplay-menu").classList.remove("hidden");
    loadScenarios()
}
function logout(){
    //ローカルストレージの削除
    localStorage.removeItem('user_name');
    //ログインページへの移動
    window.location.href = `/`;
}
function checkprofile(){
    window.location.href=`profile`;
}

function showMainMenu(){
    document.getElementById("main-menu").classList.remove("hidden");
    document.getElementById("roleplay-menu").classList.add("hidden");
}
function startChat(mode){
    window.location.href=`chat?mode=${mode}`;
}
async function loadScenarios() {
    // 1. JSONファイルを読み込む
    const response = await fetch('/static/scenarios.json');
    const scenarios = await response.json();
    
    // 2. ボタンを並べたい場所（親要素）を取得
    const scenarioList = document.getElementById('scenario-list');
    scenarioList.innerHTML = ''; // 中身を一度空にする

    // 3. JSONのデータ分だけループを回す
    Object.keys(scenarios).forEach(key => {
        const item = scenarios[key];

        // 4. 新しい div (mode-card) を作成
        const card = document.createElement('div');
        card.className = 'mode-card';
        
        // 5. クリックした時の動作を設定
        card.onclick = () => {
            startChat(key)
        };

        // 6. カードの中身を組み立てる
        card.innerHTML = `
            <div class="mode-icon">${item.icon}</div>
            <div class="mode-title">${item.title}</div>
            <div class="mode-desc">${item.description}</div>
        `;

        // 7. 親要素に追加する
        scenarioList.appendChild(card);
    });
}

window.onload = function() {
    // localStorage.getItem('保存した時の名前')
    const storedName = localStorage.getItem('user_name');
    
    if (storedName) {
        // 画面上の要素（例：<span id="name-area">）に表示させる
        document.getElementById('name-area').innerText = storedName;
    } else {
        // もしデータがなければ、未ログインなのでログイン画面へ追い返す
        window.location.href = "/login";
    }
};