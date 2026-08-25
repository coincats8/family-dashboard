// =========================================================
// Family Dashboard
// app.js
// v0.6
// =========================================================


// =========================================================
// 1. API
// =========================================================

const API_URL =
  "https://script.google.com/macros/s/AKfycbxfmSB9YZCQ5aWsU5yyl3DB2dB6egoz5Y5noF0zGM2cc7ID3jl0DuMh0uNWlguM67s/exec?mode=dashboard";


// =========================================================
// 2. SETTINGS
// =========================================================

const SETTINGS = {
  refreshInterval: 60000,
  recentLimit: 5,
  categoryLimit: 12
};


// =========================================================
// 3. STATE
// =========================================================

let dashboardData = null;
let refreshTimer = null;


// =========================================================
// 4. DOM
// =========================================================

function getElements() {
  return {
    greeting:
      document.getElementById("greeting"),

    currentMonth:
      document.getElementById("currentMonth"),

    totalMoney:
      document.getElementById("totalMoney"),

    budgetMoney:
      document.getElementById("budgetMoney"),

    balanceMoney:
      document.getElementById("balanceMoney"),

    budgetPercent:
      document.getElementById("budgetPercent"),

    budgetProgress:
      document.getElementById("budgetProgress"),

    progressBar:
      document.getElementById("progressBar"),

    categoryList:
      document.getElementById("categoryList"),

    recentList:
      document.getElementById("recentList"),

    aiAdvice:
      document.getElementById("aiAdvice"),

    lastUpdated:
      document.getElementById("lastUpdated"),

    errorToast:
      document.getElementById("errorToast"),

    errorMessage:
      document.getElementById("errorMessage")
  };
}


// =========================================================
// 5. MONEY
// =========================================================

function yen(value) {
  const number = Number(value) || 0;

  return "¥" + number.toLocaleString("ja-JP");
}


// =========================================================
// 6. HTML ESCAPE
// =========================================================

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =========================================================
// 7. COLOR
// =========================================================

function safeColor(value) {
  const color = String(value || "").trim();

  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }

  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return color;
  }

  return "#34C759";
}


// =========================================================
// 8. DATE
// =========================================================

function setHeaderDate(data = null) {
  const el = getElements();

  const now = new Date();

  const year =
    Number(data?.year) ||
    now.getFullYear();

  const month =
    Number(data?.month) ||
    now.getMonth() + 1;

  if (el.currentMonth) {
    el.currentMonth.textContent =
      `${year}年${month}月`;
  }

  if (!el.greeting) {
    return;
  }

  const hour = now.getHours();

  let icon = "🌿";
  let text = "こんにちは";

  if (hour >= 5 && hour < 11) {
    icon = "☀️";
    text = "おはよう";
  } else if (hour >= 18 || hour < 5) {
    icon = "🌙";
    text = "こんばんは";
  }

  el.greeting.textContent =
    `${icon} ${text}、市川さん`;
}


// =========================================================
// 9. RECEIPT DATE
// =========================================================

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}


// =========================================================
// 10. LOADING
// =========================================================

function setLoading() {
  const el = getElements();

  if (el.lastUpdated) {
    el.lastUpdated.textContent =
      "データを取得しています";
  }
}


// =========================================================
// 11. API
// =========================================================

async function loadDashboard(options = {}) {
  const silent = Boolean(options.silent);

  try {
    if (!silent) {
      setLoading();
    }

    const separator =
      API_URL.includes("?")
        ? "&"
        : "?";

    const requestUrl =
      `${API_URL}${separator}_=${Date.now()}`;

    const response =
      await fetch(requestUrl, {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
      });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    validateData(data);

    dashboardData = data;

    renderDashboard(data);

    setUpdatedTime();

    console.log(
      "Family Dashboard:",
      data
    );

  } catch (error) {
    console.error(
      "Family Dashboard API Error:",
      error
    );

    showError(
      "データを取得できませんでした"
    );

    if (!dashboardData) {
      renderError();
    }
  }
}


// =========================================================
// 12. VALIDATE
// =========================================================

function validateData(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      "API response is invalid"
    );
  }

  if (
    typeof data.budget ===
    "undefined"
  ) {
    throw new Error(
      "budget is missing"
    );
  }

  if (
    typeof data.expense ===
    "undefined"
  ) {
    throw new Error(
      "expense is missing"
    );
  }
}


// =========================================================
// 13. RENDER ALL
// =========================================================

function renderDashboard(data) {
  setHeaderDate(data);

  renderSummary(data);

  renderCategories(
    Array.isArray(data.categories)
      ? data.categories
      : []
  );

  renderRecent(
    Array.isArray(data.recent)
      ? data.recent
      : []
  );

  renderAdvice(data);
}


// =========================================================
// 14. SUMMARY
// =========================================================

function renderSummary(data) {
  const el = getElements();

  const living =
    data.living &&
    typeof data.living === "object"
      ? data.living
      : {};

  const budget =
    Number(
      living.budget ??
      data.budget
    ) || 0;

  const expense =
    Number(
      living.expense ??
      data.expense
    ) || 0;

  const remaining =
    Number(
      living.remaining ??
      data.balance ??
      (budget - expense)
    ) || 0;

  let rate =
    Number(living.rate);

  if (!Number.isFinite(rate)) {
    rate =
      budget > 0
        ? (expense / budget) * 100
        : 0;
  }

  if (el.totalMoney) {
    el.totalMoney.textContent =
      yen(expense);
  }

  if (el.budgetMoney) {
    el.budgetMoney.textContent =
      yen(budget);
  }

  if (el.balanceMoney) {
    el.balanceMoney.textContent =
      yen(remaining);

    el.balanceMoney.classList.remove(
      "is-warning",
      "is-danger"
    );

    if (remaining < 0) {
      el.balanceMoney.classList.add(
        "is-danger"
      );
    } else if (rate >= 80) {
      el.balanceMoney.classList.add(
        "is-warning"
      );
    }
  }

  const rounded =
    Math.round(rate);

  if (el.budgetPercent) {
    el.budgetPercent.textContent =
      `${rounded}%`;
  }

  if (el.budgetProgress) {
    el.budgetProgress.setAttribute(
      "aria-valuenow",
      String(
        Math.min(
          100,
          Math.max(0, rounded)
        )
      )
    );
  }

  if (el.progressBar) {
    const width =
      Math.min(
        100,
        Math.max(0, rate)
      );

    el.progressBar.style.width =
      `${width}%`;

    el.progressBar.classList.remove(
      "is-warning",
      "is-danger"
    );

    if (rate >= 100) {
      el.progressBar.classList.add(
        "is-danger"
      );
    } else if (rate >= 80) {
      el.progressBar.classList.add(
        "is-warning"
      );
    }
  }
}


// =========================================================
// 15. CATEGORIES
// =========================================================

function renderCategories(categories) {
  const el = getElements();

  if (!el.categoryList) {
    return;
  }

  if (categories.length === 0) {
    el.categoryList.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-rounded">
          pie_chart
        </span>

        <strong>
          カテゴリがありません
        </strong>

        <p>
          設定シートのカテゴリが
          ここに表示されます。
        </p>
      </div>
    `;

    return;
  }

  const livingCategories =
    categories
      .filter(category => {
        return (
          !category.group ||
          category.group === "生活費"
        );
      })
      .slice(
        0,
        SETTINGS.categoryLimit
      );

  el.categoryList.innerHTML =
    livingCategories
      .map(category => {
        const name =
          escapeHTML(
            category.name ||
            "🧾 雑費"
          );

        const budget =
          Number(
            category.budget
          ) || 0;

        const amount =
          Number(
            category.amount
          ) || 0;

        const remaining =
          Number(
            category.remaining ??
            (budget - amount)
          ) || 0;

        const color =
          safeColor(
            category.color
          );

        const percent =
          budget > 0
            ? Math.min(
                100,
                Math.max(
                  0,
                  (amount / budget) * 100
                )
              )
            : (
                amount > 0
                  ? 100
                  : 0
              );

        const budgetText =
          budget > 0
            ? `${yen(amount)} / ${yen(budget)}`
            : yen(amount);

        const remainingText =
          budget > 0
            ? `残り ${yen(remaining)}`
            : "予算未設定";

        return `
          <div class="category-item">

            <div class="category-top">

              <span class="category-name">
                ${name}
              </span>

              <strong class="category-amount">
                ${budgetText}
              </strong>

            </div>

            <div class="category-progress">

              <div
                class="category-progress-bar"
                style="
                  width:${percent}%;
                  background:${color};
                "
              ></div>

            </div>

            <div
              style="
                margin-top:6px;
                text-align:right;
                font-size:11px;
                color:#8e8e93;
              "
            >
              ${remainingText}
            </div>

          </div>
        `;
      })
      .join("");
}


// =========================================================
// 16. RECENT
// =========================================================

function renderRecent(recent) {
  const el = getElements();

  if (!el.recentList) {
    return;
  }

  if (recent.length === 0) {
    el.recentList.innerHTML = `
      <div class="empty-state">

        <span class="material-symbols-rounded">
          receipt_long
        </span>

        <strong>
          今月のレシートはありません
        </strong>

        <p>
          LINEからレシートを登録すると、
          ここに表示されます。
        </p>

      </div>
    `;

    return;
  }

  el.recentList.innerHTML =
    recent
      .slice(
        0,
        SETTINGS.recentLimit
      )
      .map(item => {
        const shop =
          escapeHTML(
            item.shop ||
            "店舗名なし"
          );

        const category =
          escapeHTML(
            item.category ||
            "その他"
          );

        const date =
          escapeHTML(
            formatDate(
              item.date
            )
          );

        const amount =
          Number(
            item.amount
          ) || 0;

        const imageUrl =
          safeImageUrl(
            item.imageUrl
          );

        const image =
          imageUrl
            ? `
              <div class="receipt-thumbnail">
                <img
                  src="${escapeHTML(imageUrl)}"
                  alt="レシート"
                  loading="lazy"
                  onerror="
                    this.style.display='none';
                    this.nextElementSibling.style.display='inline-block';
                  "
                >

                <span
                  class="material-symbols-rounded"
                  style="display:none;"
                >
                  receipt_long
                </span>
              </div>
            `
            : `
              <div class="receipt-thumbnail">
                <span class="material-symbols-rounded">
                  receipt_long
                </span>
              </div>
            `;

        return `
          <div class="receipt-item">

            ${image}

            <div class="receipt-info">

              <div class="receipt-shop">
                ${shop}
              </div>

              <div class="receipt-meta">

                <span class="receipt-category">
                  ${category}
                </span>

                ${
                  date
                    ? `
                      <span>•</span>
                      <span>${date}</span>
                    `
                    : ""
                }

              </div>

            </div>

            <strong class="receipt-amount">
              ${yen(amount)}
            </strong>

          </div>
        `;
      })
      .join("");
}


// =========================================================
// 17. IMAGE URL
// =========================================================

function safeImageUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const url =
      new URL(
        String(value)
      );

    if (
      url.protocol === "https:" ||
      url.protocol === "http:"
    ) {
      return url.href;
    }

  } catch (error) {
    return "";
  }

  return "";
}


// =========================================================
// 18. AI ADVICE
// =========================================================

function renderAdvice(data) {
  const el = getElements();

  if (!el.aiAdvice) {
    return;
  }

  const living =
    data.living || {};

  const expense =
    Number(
      living.expense ??
      data.expense
    ) || 0;

  const budget =
    Number(
      living.budget ??
      data.budget
    ) || 0;

  const remaining =
    Number(
      living.remaining ??
      data.balance ??
      (budget - expense)
    ) || 0;

  const saving =
    data.saving || {};

  const investment =
    data.investment || {};

  const savingTarget =
    Number(
      saving.target
    ) || 0;

  const investmentTarget =
    Number(
      investment.target
    ) || 0;

  const categories =
    Array.isArray(
      data.categories
    )
      ? data.categories
      : [];

  if (expense <= 0) {
    let message =
      `今月の生活費予算は${yen(budget)}です。`;

    if (savingTarget > 0) {
      message +=
        ` 貯蓄目標は${yen(savingTarget)}。`;
    }

    if (investmentTarget > 0) {
      message +=
        ` 投資予定は${yen(investmentTarget)}です。`;
    }

    el.aiAdvice.textContent =
      message;

    return;
  }

  const top =
    [...categories]
      .filter(
        item =>
          item.group === "生活費" ||
          !item.group
      )
      .sort(
        (a, b) =>
          (Number(b.amount) || 0) -
          (Number(a.amount) || 0)
      )[0];

  const rate =
    budget > 0
      ? (expense / budget) * 100
      : 0;

  if (rate >= 100) {
    el.aiAdvice.textContent =
      `生活費予算を${yen(Math.abs(remaining))}超えています。カテゴリ別の支出を確認してみましょう。`;

    return;
  }

  if (rate >= 80) {
    el.aiAdvice.textContent =
      `生活費予算の${Math.round(rate)}%を使っています。残りは${yen(remaining)}です。`;

    return;
  }

  if (
    top &&
    Number(top.amount) > 0
  ) {
    el.aiAdvice.textContent =
      `今月は「${top.name}」が最も多く${yen(top.amount)}です。生活費の残りは${yen(remaining)}です。`;

    return;
  }

  el.aiAdvice.textContent =
    `今月の生活費は${yen(expense)}、残りは${yen(remaining)}です。`;
}


// =========================================================
// 19. UPDATED TIME
// =========================================================

function setUpdatedTime() {
  const el = getElements();

  if (!el.lastUpdated) {
    return;
  }

  const now =
    new Date();

  const time =
    now.toLocaleTimeString(
      "ja-JP",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  el.lastUpdated.textContent =
    `${time} 更新`;
}


// =========================================================
// 20. ERROR TOAST
// =========================================================

function showError(message) {
  const el = getElements();

  if (
    !el.errorToast ||
    !el.errorMessage
  ) {
    return;
  }

  el.errorMessage.textContent =
    message;

  el.errorToast.classList.add(
    "show"
  );

  window.setTimeout(
    () => {
      el.errorToast.classList.remove(
        "show"
      );
    },
    3500
  );
}


// =========================================================
// 21. ERROR VIEW
// =========================================================

function renderError() {
  const el = getElements();

  if (el.categoryList) {
    el.categoryList.innerHTML = `
      <div class="empty-state">

        <span class="material-symbols-rounded">
          cloud_off
        </span>

        <strong>
          データを取得できませんでした
        </strong>

        <p>
          画面を更新して、
          もう一度お試しください。
        </p>

      </div>
    `;
  }

  if (el.recentList) {
    el.recentList.innerHTML = `
      <div class="empty-state">

        <span class="material-symbols-rounded">
          cloud_off
        </span>

        <strong>
          読み込みに失敗しました
        </strong>

      </div>
    `;
  }

  if (el.aiAdvice) {
    el.aiAdvice.textContent =
      "家計データを取得できませんでした。";
  }

  if (el.lastUpdated) {
    el.lastUpdated.textContent =
      "更新に失敗しました";
  }
}


// =========================================================
// 22. NAVIGATION
// =========================================================

function setupNavigation() {
  const buttons =
    document.querySelectorAll(
      ".nav-button"
    );

  buttons.forEach(button => {
    button.addEventListener(
      "click",
      () => {
        const page =
          button.dataset.page;

        if (page !== "home") {
          showError(
            "このページは現在準備中です"
          );

          return;
        }

        buttons.forEach(item => {
          item.classList.remove(
            "active"
          );
        });

        button.classList.add(
          "active"
        );
      }
    );
  });
}


// =========================================================
// 23. DETAIL BUTTONS
// =========================================================

function setupButtons() {
  const category =
    document.getElementById(
      "categoryDetailButton"
    );

  const receipt =
    document.getElementById(
      "receiptDetailButton"
    );

  const notification =
    document.getElementById(
      "notificationButton"
    );

  if (category) {
    category.addEventListener(
      "click",
      () => {
        showError(
          "カテゴリ詳細は現在準備中です"
        );
      }
    );
  }

  if (receipt) {
    receipt.addEventListener(
      "click",
      () => {
        showError(
          "レシート一覧は現在準備中です"
        );
      }
    );
  }

  if (notification) {
    notification.addEventListener(
      "click",
      () => {
        showError(
          "お知らせ機能は現在準備中です"
        );
      }
    );
  }
}


// =========================================================
// 24. AUTO REFRESH
// =========================================================

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(
      refreshTimer
    );
  }

  refreshTimer =
    setInterval(
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          loadDashboard({
            silent: true
          });
        }
      },
      SETTINGS.refreshInterval
    );
}


// =========================================================
// 25. VISIBILITY REFRESH
// =========================================================

function setupVisibilityRefresh() {
  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        loadDashboard({
          silent: true
        });
      }
    }
  );
}


// =========================================================
// 26. START
// =========================================================

async function initializeApp() {
  setHeaderDate();

  setupNavigation();

  setupButtons();

  setupVisibilityRefresh();

  await loadDashboard();

  startAutoRefresh();
}


document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);
