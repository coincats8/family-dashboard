// ================================
// Family Dashboard v0.2
// ================================

// 仮データ（後でスプレッドシートから取得）
const dashboard = {
  budget: 300000,
  total: 152380,
  categories: {
    food: 48230,
    eatingOut: 12830,
    daily: 8520,
    transport: 5980
  }
};

// 金額を「¥123,456」にする
function yen(value) {
  return "¥" + value.toLocaleString("ja-JP");
}

// カウントアップ
function animateNumber(target, end) {
  let current = 0;

  const step = Math.max(1, Math.ceil(end / 80));

  const timer = setInterval(() => {

    current += step;

    if (current >= end) {
      current = end;
      clearInterval(timer);
    }

    target.textContent = yen(current);

  }, 16);
}

// 今日の日付
function setMonth() {

  const now = new Date();

  const month = document.querySelector(".month");

  month.textContent =
    now.getFullYear() +
    "年" +
    (now.getMonth() + 1) +
    "月";

}

// 初期表示
window.onload = () => {

  setMonth();

  // 合計金額
  const total = document.getElementById("totalMoney");

  animateNumber(total, dashboard.total);

  // プログレスバー
  const percent = dashboard.total / dashboard.budget * 100;

  document.querySelector(".progress-bar").style.width =
    percent + "%";

  // 残り予算
  document.querySelector(".budget-row").innerHTML = `
    <span>予算 ${yen(dashboard.budget)}</span>
    <span>残り ${yen(dashboard.budget-dashboard.total)}</span>
  `;

  // カテゴリ
  const rows = document.querySelectorAll(".category strong");

  rows[0].textContent = yen(dashboard.categories.food);
  rows[1].textContent = yen(dashboard.categories.eatingOut);
  rows[2].textContent = yen(dashboard.categories.daily);
  rows[3].textContent = yen(dashboard.categories.transport);

};
