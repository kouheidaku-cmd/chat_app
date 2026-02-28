// シナリオIDを日本語名に変換するための辞書（JSONファイルをfetchしてもOKですが、ここでは簡易的に定義）
const scenarioMaster = {
    "cafe": "カフェで注文",
    "airport": "空港のチェックイン",
    "freetalk": "フリートーク"
};

window.onload = function() {
    const storedName = localStorage.getItem('user_name'); // キー名を統一
    
    if (storedName) {
        document.getElementById('name-area').innerText = storedName;
        GetUserData(storedName);
    } else {
        window.location.href = "/login";
    }
};

async function GetUserData(storedName) {
    try {
        // FastAPIにPOST送信（またはGETでも良いですが、今の構造を活かします）
        const response = await fetch('/getuserdata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ 'username': storedName })
        });

        if (response.ok) {
            const data = await response.json();
            
            // 1. 基本情報の表示
            document.getElementById('created-at').innerText = "登録日: " + (data.created_at || "不明");

            // 2. 進捗情報の表示（テーブルへの流し込み）
            const statsBody = document.getElementById('stats-body');
            statsBody.innerHTML = ""; // 初期化

            //data.stats要素の中に進捗データ全部入ってる
            if (data.stats && data.stats.length > 0) {
                data.stats.forEach(item => {//forEach: リスト（配列）の数だけ、中身を item という一時的な変数に入れて、{ } の中の処理を繰り返す
                    const row = document.createElement('tr');//メモリ上に新たに<tr>(行)を作成
                    
                    // シナリオ名（マスターにあれば変換、なければIDをそのまま表示）
                    const displayName = scenarioMaster[item.scenario_id] || item.scenario_id;
                    const clearMark = item.is_cleared ? "✅ クリア済み" : "🔄 挑戦中";

                    row.innerHTML = `
                        <td>${displayName}</td>
                        <td>${item.play_count} 回</td>
                        <td>${item.clear_count} 回</td>
                        <td>${clearMark}</td>
                        <td>${item.last_played}</td>
                    `;
                    statsBody.appendChild(row);
                });
            } else {
                statsBody.innerHTML = "<tr><td colspan='5'>まだ学習記録がありません。</td></tr>";
            }

        } else {
            console.error("データ取得エラー:", response.status);
            alert("ユーザーデータの取得に失敗しました");
        }
    } catch (error) {
        console.error("通信エラー:", error);
    }
}

function back() {
    window.location.href = "/home";
}