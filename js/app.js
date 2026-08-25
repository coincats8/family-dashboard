// =======================================
// Family Dashboard
// API Version
// =======================================

const API =
"https://script.google.com/macros/s/AKfycbxfmSB9YZCQ5aWsU5yyl3DB2dB6egoz5Y5noF0zGM2cc7ID3jl0DuMh0uNWlguM67s/exec?mode=dashboard";

function yen(value){

    return "¥"+Number(value).toLocaleString("ja-JP");

}

async function loadDashboard(){

    const response = await fetch(API);

    const data = await response.json();

    console.log(data);

    // 合計
    document.getElementById("totalMoney").textContent =
        yen(data.expense);

    // プログレスバー
    const percent =
        data.expense / data.budget * 100;

    document.querySelector(".progress-bar").style.width =
        percent + "%";

    // 予算
    document.querySelector(".budget-row").innerHTML=`
        <span>予算 ${yen(data.budget)}</span>
        <span>残り ${yen(data.balance)}</span>
    `;

}

window.onload=()=>{

    loadDashboard();

}
