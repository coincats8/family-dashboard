// =========================================================
// Family Dashboard
// app.js
// v0.8
//
// 生活費予算 250,000円
//      ↓
// 今月の支出を差し引く
//      ↓
// 残金 = 今月の貯蓄
//
// NISA / 投資機能なし
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


    // 貯蓄

    savingActual:
      document.getElementById("savingActual"),


    // 夫婦負担

    contributionTotal:
      document.getElementById("contributionTotal"),

    satoruContribution:
      document.getElementById("satoruContribution"),

    kanaContribution:
      document.getElementById("kanaContribution"),


    // カテゴリ

    categoryList:
      document.getElementById("categoryList"),


    // 最近の支出

    recentList:
      document.getElementById("recentList"),


    // AI

    aiAdvice:
      document.getElementById("aiAdvice"),


    // 更新

    lastUpdated:
      document.getElementById("lastUpdated"),


    // エラー

    errorToast:
      document.getElementById("errorToast"),

    errorMessage:
      document.getElementById("errorMessage")

  };

}


// =========================================================
// 5. MONEY FORMAT
// =========================================================

function yen(value) {

  const number =
    Number(value) || 0;


  return (
    "¥" +
    number.toLocaleString("ja-JP")
  );

}


// =========================================================
// 6. HTML ESCAPE
// =========================================================

function escapeHTML(value) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


// =========================================================
// 7. COLOR
// =========================================================

function safeColor(value) {

  const color =
    String(
      value || ""
    ).trim();


  if (
    /^#[0-9a-fA-F]{6}$/.test(
      color
    )
  ) {

    return color;

  }


  if (
    /^#[0-9a-fA-F]{3}$/.test(
      color
    )
  ) {

    return color;

  }


  return "#34C759";

}


// =========================================================
// 8. HEADER
// =========================================================

function setHeaderDate(data = null) {

  const el =
    getElements();


  const now =
    new Date();


  const year =
    Number(
      data?.year
    ) ||
    now.getFullYear();


  const month =
    Number(
      data?.month
    ) ||
    now.getMonth() + 1;


  if (el.currentMonth) {

    el.currentMonth.textContent =
      `${year}年${month}月`;

  }


  if (!el.greeting) {

    return;

  }


  const hour =
    now.getHours();


  let icon =
    "🌿";


  let greeting =
    "こんにちは";


  if (
    hour >= 5 &&
    hour < 11
  ) {

    icon =
      "☀️";


    greeting =
      "おはよう";

  }

  else if (
    hour >= 18 ||
    hour < 5
  ) {

    icon =
      "🌙";


    greeting =
      "こんばんは";

  }


  el.greeting.textContent =
    `${icon} ${greeting}、市川さん`;

}


// =========================================================
// 9. DATE FORMAT
// =========================================================

function formatDate(value) {

  if (!value) {

    return "";

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(
      value
    );

  }


  return (
    `${date.getMonth() + 1}/${date.getDate()}`
  );

}


// =========================================================
// 10. IMAGE URL
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

  }

  catch (error) {

    return "";

  }


  return "";

}


// =========================================================
// 11. LOADING
// =========================================================

function setLoading() {

  const el =
    getElements();


  if (el.lastUpdated) {

    el.lastUpdated.textContent =
      "データを取得しています";

  }

}


// =========================================================
// 12. LOAD API
// =========================================================

async function loadDashboard(options = {}) {

  const silent =
    Boolean(
      options.silent
    );


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
      await fetch(
        requestUrl,
        {
          method: "GET",
          cache: "no-store",
          redirect: "follow"
        }
      );


    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }


    const data =
      await response.json();


    validateData(
      data
    );


    dashboardData =
      data;


    renderDashboard(
      data
    );


    setUpdatedTime();


    console.log(
      "Family Dashboard:",
      data
    );

  }

  catch (error) {

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
// 13. VALIDATE
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
// 14. RENDER ALL
// =========================================================

function renderDashboard(data) {

  setHeaderDate(
    data
  );


  renderLiving(
    data
  );


  renderSaving(
    data
  );


  renderContributions(
    data
  );


  renderCategories(
    Array.isArray(
      data.categories
    )
      ? data.categories
      : []
  );


  renderRecent(
    Array.isArray(
      data.recent
    )
      ? data.recent
      : []
  );


  renderAdvice(
    data
  );

}


// =========================================================
// 15. LIVING EXPENSE
// =========================================================

function renderLiving(data) {

  const el =
    getElements();


  const living =
    (
      data.living &&
      typeof data.living === "object"
    )
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
      (
        budget -
        expense
      )
    ) || 0;


  let rate =
    Number(
      living.rate
    );


  if (
    !Number.isFinite(
      rate
    )
  ) {

    rate =
      budget > 0
        ? (
            expense /
            budget
          ) * 100
        : 0;

  }


  // -------------------------------------------------------
  // 今月の支出
  // -------------------------------------------------------

  if (el.totalMoney) {

    el.totalMoney.textContent =
      yen(
        expense
      );

  }


  // -------------------------------------------------------
  // 予算
  // -------------------------------------------------------

  if (el.budgetMoney) {

    el.budgetMoney.textContent =
      yen(
        budget
      );

  }


  // -------------------------------------------------------
  // 残り
  // -------------------------------------------------------

  if (el.balanceMoney) {

    el.balanceMoney.textContent =
      yen(
        remaining
      );


    el.balanceMoney.classList.remove(
      "is-warning",
      "is-danger"
    );


    if (
      remaining < 0
    ) {

      el.balanceMoney.classList.add(
        "is-danger"
      );

    }

    else if (
      rate >= 80
    ) {

      el.balanceMoney.classList.add(
        "is-warning"
      );

    }

  }


  // -------------------------------------------------------
  // 使用率
  // -------------------------------------------------------

  const roundedRate =
    Math.round(
      rate
    );


  if (
    el.budgetPercent
  ) {

    el.budgetPercent.textContent =
      `${roundedRate}%`;

  }


  if (
    el.budgetProgress
  ) {

    el.budgetProgress.setAttribute(
      "aria-valuenow",
      String(
        Math.min(
          100,
          Math.max(
            0,
            roundedRate
          )
        )
      )
    );

  }


  if (
    el.progressBar
  ) {

    const width =
      Math.min(
        100,
        Math.max(
          0,
          rate
        )
      );


    el.progressBar.style.width =
      `${width}%`;


    el.progressBar.classList.remove(
      "is-warning",
      "is-danger"
    );


    if (
      rate >= 100
    ) {

      el.progressBar.classList.add(
        "is-danger"
      );

    }

    else if (
      rate >= 80
    ) {

      el.progressBar.classList.add(
        "is-warning"
      );

    }

  }

}


// =========================================================
// 16. SAVING
//
// 生活費の残金 = 貯蓄
// =========================================================

function renderSaving(data) {

  const el =
    getElements();


  if (
    !el.savingActual
  ) {

    return;

  }


  const living =
    data.living || {};


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


  // APIのsaving.actualを優先
  // 無ければ自動計算

  let saving =
    Number(
      data.saving?.actual
    );


  if (
    !Number.isFinite(
      saving
    )
  ) {

    saving =
      Math.max(
        0,
        budget -
        expense
      );

  }


  el.savingActual.textContent =
    yen(
      saving
    );

}


// =========================================================
// 17. CONTRIBUTIONS
// =========================================================

function renderContributions(data) {

  const el =
    getElements();


  const contributions =
    (
      data.contributions &&
      typeof data.contributions === "object"
    )
      ? data.contributions
      : {};


  const satoru =
    Number(
      contributions.satoru
    ) || 0;


  const kana =
    Number(
      contributions.kana
    ) || 0;


  const total =
    Number(
      contributions.total
    ) ||
    (
      satoru +
      kana
    );


  if (
    el.satoruContribution
  ) {

    el.satoruContribution.textContent =
      yen(
        satoru
      );

  }


  if (
    el.kanaContribution
  ) {

    el.kanaContribution.textContent =
      yen(
        kana
      );

  }


  if (
    el.contributionTotal
  ) {

    el.contributionTotal.textContent =
      yen(
        total
      );

  }

}


// =========================================================
// 18. CATEGORIES
// =========================================================

function renderCategories(categories) {

  const el =
    getElements();


  if (
    !el.categoryList
  ) {

    return;

  }


  const livingCategories =
    categories
      .filter(
        category =>
          !category.group ||
          category.group === "生活費"
      )
      .slice(
        0,
        SETTINGS.categoryLimit
      );


  if (
    livingCategories.length === 0
  ) {

    el.categoryList.innerHTML = `

      <div class="empty-state">

        <span class="material-symbols-rounded">
          pie_chart
        </span>

        <strong>
          カテゴリがありません
        </strong>

        <p>
          設定シートの生活費カテゴリが
          ここに表示されます。
        </p>

      </div>

    `;


    return;

  }


  el.categoryList.innerHTML =
    livingCategories
      .map(
        category => {

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
              (
                budget -
                amount
              )
            ) || 0;


          const color =
            safeColor(
              category.color
            );


          let rate =
            0;


          if (
            budget > 0
          ) {

            rate =
              (
                amount /
                budget
              ) *
              100;

          }

          else if (
            amount > 0
          ) {

            rate =
              100;

          }


          const visualRate =
            Math.min(
              100,
              Math.max(
                0,
                rate
              )
            );


          const amountText =
            budget > 0
              ? `${yen(amount)} / ${yen(budget)}`
              : yen(amount);


          let remainingText =
            "予算未設定";


          let remainingColor =
            "#8e8e93";


          if (
            budget > 0
          ) {

            if (
              remaining >= 0
            ) {

              remainingText =
                `残り ${yen(remaining)}`;

            }

            else {

              remainingText =
                `${yen(Math.abs(remaining))} オーバー`;


              remainingColor =
                "#ff3b30";

            }

          }


          return `

            <div class="category-item">

              <div class="category-top">

                <span class="category-name">
                  ${name}
                </span>


                <strong class="category-amount">
                  ${amountText}
                </strong>

              </div>


              <div class="category-progress">

                <div
                  class="category-progress-bar"
                  style="
                    width:${visualRate}%;
                    background:${color};
                  "
                ></div>

              </div>


              <div
                style="
                  margin-top:6px;
                  text-align:right;
                  font-size:11px;
                  color:${remainingColor};
                "
              >
                ${remainingText}
              </div>

            </div>

          `;

        }
      )
      .join("");

}


// =========================================================
// 19. RECENT
// =========================================================

function renderRecent(recent) {

  const el =
    getElements();


  if (
    !el.recentList
  ) {

    return;

  }


  const livingRecent =
    recent
      .filter(
        item =>
          !item.group ||
          item.group === "生活費"
      )
      .slice(
        0,
        SETTINGS.recentLimit
      );


  if (
    livingRecent.length === 0
  ) {

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
    livingRecent
      .map(
        item => {

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

        }
      )
      .join("");

}


// =========================================================
// 20. AI ADVICE
// =========================================================

function renderAdvice(data) {

  const el =
    getElements();


  if (
    !el.aiAdvice
  ) {

    return;

  }


  const living =
    data.living || {};


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
      (
        budget -
        expense
      )
    ) || 0;


  const saving =
    Math.max(
      0,
      Number(
        data.saving?.actual ??
        remaining
      ) || 0
    );


  const rate =
    budget > 0
      ? (
          expense /
          budget
        ) *
        100
      : 0;


  const categories =
    Array.isArray(
      data.categories
    )
      ? data.categories
      : [];


  // -------------------------------------------------------
  // 予算オーバー
  // -------------------------------------------------------

  if (
    remaining < 0
  ) {

    el.aiAdvice.textContent =
      `生活費予算を${yen(Math.abs(remaining))}超えています。カテゴリ別の支出を確認してみましょう。`;


    return;

  }


  // -------------------------------------------------------
  // 80%以上
  // -------------------------------------------------------

  if (
    rate >= 80
  ) {

    el.aiAdvice.textContent =
      `生活費予算の${Math.round(rate)}%を使っています。現在の残りは${yen(remaining)}です。`;


    return;

  }


  // -------------------------------------------------------
  // 一番大きな支出
  // -------------------------------------------------------

  const topCategory =
    [...categories]
      .filter(
        item =>
          !item.group ||
          item.group === "生活費"
      )
      .filter(
        item =>
          Number(
            item.amount
          ) > 0
      )
      .sort(
        (a, b) =>
          (
            Number(
              b.amount
            ) || 0
          ) -
          (
            Number(
              a.amount
            ) || 0
          )
      )[0];


  if (
    topCategory
  ) {

    el.aiAdvice.textContent =
      `今月は「${topCategory.name}」の支出が最も多く${yen(topCategory.amount)}です。今のままなら${yen(saving)}が貯蓄に回ります。`;


    return;

  }


  // -------------------------------------------------------
  // 支出なし
  // -------------------------------------------------------

  if (
    expense === 0
  ) {

    el.aiAdvice.textContent =
      `今月の生活費予算は${yen(budget)}です。使わなかった分はそのまま貯蓄になります。`;


    return;

  }


  // -------------------------------------------------------
  // 通常
  // -------------------------------------------------------

  el.aiAdvice.textContent =
    `今月は${yen(expense)}使っています。現在の残り${yen(remaining)}が貯蓄に回る予定です。`;

}


// =========================================================
// 21. UPDATED TIME
// =========================================================

function setUpdatedTime() {

  const el =
    getElements();


  if (
    !el.lastUpdated
  ) {

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
// 22. ERROR TOAST
// =========================================================

function showError(message) {

  const el =
    getElements();


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
// 23. ERROR VIEW
// =========================================================

function renderError() {

  const el =
    getElements();


  if (
    el.categoryList
  ) {

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


  if (
    el.recentList
  ) {

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


  if (
    el.aiAdvice
  ) {

    el.aiAdvice.textContent =
      "家計データを取得できませんでした。";

  }


  if (
    el.lastUpdated
  ) {

    el.lastUpdated.textContent =
      "更新に失敗しました";

  }

}


// =========================================================
// 24. NAVIGATION
// =========================================================

function setupNavigation() {

  const buttons =
    document.querySelectorAll(
      ".nav-button"
    );


  buttons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;


          if (
            page !== "home"
          ) {

            showError(
              "このページは現在準備中です"
            );


            return;

          }


          buttons.forEach(
            item => {

              item.classList.remove(
                "active"
              );

            }
          );


          button.classList.add(
            "active"
          );

        }
      );

    }
  );

}


// =========================================================
// 25. BUTTONS
// =========================================================

function setupButtons() {

  const categoryButton =
    document.getElementById(
      "categoryDetailButton"
    );


  const receiptButton =
    document.getElementById(
      "receiptDetailButton"
    );


  const notificationButton =
    document.getElementById(
      "notificationButton"
    );


  if (
    categoryButton
  ) {

    categoryButton.addEventListener(
      "click",
      () => {

        showError(
          "カテゴリ詳細は現在準備中です"
        );

      }
    );

  }


  if (
    receiptButton
  ) {

    receiptButton.addEventListener(
      "click",
      () => {

        showError(
          "レシート一覧は現在準備中です"
        );

      }
    );

  }


  if (
    notificationButton
  ) {

    notificationButton.addEventListener(
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
// 26. AUTO REFRESH
// =========================================================

function startAutoRefresh() {

  if (
    refreshTimer
  ) {

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
// 27. VISIBILITY REFRESH
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
// 28. START
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
