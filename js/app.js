document.getElementById("app").innerHTML = `
<div class="header">
    <div class="greeting">
        ☀️ おはよう、市川さん
    </div>

    <div class="title">
        ふたりの家計簿
    </div>
</div>

<div class="card">

    <div class="card-title">
        今月の支出
    </div>

    <div class="amount">
        ¥0
    </div>

    <div class="progress">
        <div class="progress-value"></div>
    </div>

</div>

<div class="card">

    <div class="category">
        <span>🍚 食費</span>
        <span>¥0</span>
    </div>

    <div class="category">
        <span>🍜 外食</span>
        <span>¥0</span>
    </div>

    <div class="category">
        <span>🛒 日用品</span>
        <span>¥0</span>
    </div>

    <div class="category">
        <span>🚗 交通費</span>
        <span>¥0</span>
    </div>

</div>

<div class="card">

    <div class="card-title">
        最近のレシート
    </div>

    <div style="margin-top:20px;color:#6E6E73;">
        まだ登録されていません
    </div>

</div>

<div class="bottom-nav">

<span class="material-symbols-rounded">home</span>

<span class="material-symbols-rounded">receipt_long</span>

<span class="material-symbols-rounded">pie_chart</span>

<span class="material-symbols-rounded">calendar_month</span>

<span class="material-symbols-rounded">settings</span>

</div>
`;
