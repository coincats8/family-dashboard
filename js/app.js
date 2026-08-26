// =========================================================
// Family Dashboard
// app.js
// v4.0
//
// ・5画面完全分離
// ・ホーム
// ・今日のGoogleカレンダー予定
// ・レシート
// ・レポート
// ・Google夫婦共有カレンダー
// ・設定
// ・予定追加 / 編集 / 削除
// ・日別支出表示
// =========================================================


// =========================================================
// API
// =========================================================

const API_BASE =
  "https://script.google.com/macros/s/AKfycbxfmSB9YZCQ5aWsU5yyl3DB2dB6egoz5Y5noF0zGM2cc7ID3jl0DuMh0uNWlguM67s/exec";


// =========================================================
// SETTINGS
// =========================================================

const SETTINGS = {

  monthlyBudget: 250000,

  startYear: 2026,

  startMonth: 8,

  refreshInterval: 60000

};


const DASHBOARD_CACHE_KEY =
  "family-kakeibo-dashboard-v1";


// =========================================================
// STATE
// =========================================================

let dashboardData = null;

let receiptData = [];

let scheduleData = [];

let todayScheduleData = [];

let currentPage = "home";


const now = new Date();


let receiptDate =
  new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );


let calendarDate =
  new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );


let selectedCalendarDate = null;

let refreshTimer = null;


// =========================================================
// ELEMENT
// =========================================================

function el(id) {

  return document.getElementById(id);

}


// =========================================================
// MONEY
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
// ESCAPE
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
// COLOR
// =========================================================

function safeColor(value) {

  const color =
    String(value || "").trim();


  if (
    /^#[0-9a-fA-F]{6}$/.test(color) ||
    /^#[0-9a-fA-F]{3}$/.test(color)
  ) {

    return color;

  }


  return "#34C759";

}


// =========================================================
// LOCAL DATE
// =========================================================

function localDateKey(date) {

  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;

}


// =========================================================
// PARSE DATE
// =========================================================

function parseDateValue(value) {

  if (!value) {

    return null;

  }


  if (
    value instanceof Date
  ) {

    return value;

  }


  const text =
    String(value).trim();


  const match =
    text.match(
      /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/
    );


  if (match) {

    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );

  }


  const date =
    new Date(text);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  return date;

}


// =========================================================
// SHORT DATE
// =========================================================

function formatShortDate(value) {

  const date =
    parseDateValue(value);


  if (!date) {

    return "";

  }


  return (
    `${date.getMonth() + 1}/${date.getDate()}`
  );

}


// =========================================================
// JAPANESE DATE
// =========================================================

function formatJapaneseDate(value) {

  const date =
    parseDateValue(value);


  if (!date) {

    return "";

  }


  const weekdays = [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土"
  ];


  return (
    `${date.getMonth() + 1}月` +
    `${date.getDate()}日` +
    `（${weekdays[date.getDay()]}）`
  );

}


// =========================================================
// FULL JAPANESE DATE
// =========================================================

function formatFullJapaneseDate(date) {

  const weekdays = [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土"
  ];


  return (
    `${date.getFullYear()}年` +
    `${date.getMonth() + 1}月` +
    `${date.getDate()}日` +
    `（${weekdays[date.getDay()]}）`
  );

}


// =========================================================
// FETCH JSON
// =========================================================

async function fetchJson(url) {

  const separator =
    url.includes("?")
      ? "&"
      : "?";


  const requestUrl =
    `${url}${separator}_=${Date.now()}`;


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


  const text =
    await response.text();


  const trimmed =
    String(text || "").trim();


  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html")
  ) {

    throw new Error(
      "APIからHTMLが返されました"
    );

  }


  return JSON.parse(trimmed);

}


// =========================================================
// DASHBOARD LOAD
// =========================================================

async function loadDashboard() {

  try {

    dashboardData =
      await fetchJson(
        `${API_BASE}?mode=dashboard`
      );


    saveDashboardCache();


    renderHome();

    renderReport();

    updateLastUpdated();

  }

  catch (error) {

    console.error(
      "Dashboard Error:",
      error
    );


    showToast(
      "家計データを取得できませんでした"
    );

  }

}


// =========================================================
// DASHBOARD CACHE
//
// 前回表示した家計簿を先に描画し、通信完了後に最新値へ更新する。
// =========================================================

function saveDashboardCache() {

  if (!dashboardData) {

    return;

  }


  try {

    localStorage.setItem(
      DASHBOARD_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        data: dashboardData
      })
    );

  }

  catch (error) {

    console.warn(
      "Dashboard cache save error:",
      error
    );

  }

}


function restoreDashboardCache() {

  try {

    const raw = localStorage.getItem(
      DASHBOARD_CACHE_KEY
    );


    if (!raw) {

      return false;

    }


    const cached = JSON.parse(raw);


    if (!cached || !cached.data) {

      return false;

    }


    dashboardData = cached.data;

    renderHome();

    renderReport();


    return true;

  }

  catch (error) {

    console.warn(
      "Dashboard cache restore error:",
      error
    );


    return false;

  }

}


// =========================================================
// RECEIPTS
// =========================================================

async function loadReceiptsFor(
  year,
  month
) {

  try {

    const data =
      await fetchJson(
        `${API_BASE}?mode=receipts&year=${year}&month=${month}`
      );


    if (
      Array.isArray(data)
    ) {

      receiptData = data;

    }

    else if (
      Array.isArray(data.receipts)
    ) {

      receiptData =
        data.receipts;

    }

    else if (
      Array.isArray(data.data)
    ) {

      receiptData =
        data.data;

    }

    else {

      receiptData = [];

    }


    return receiptData;

  }

  catch (error) {

    console.error(
      "Receipt Error:",
      error
    );


    receiptData = [];

    return [];

  }

}


// =========================================================
// GOOGLE MONTH SCHEDULES
// =========================================================

async function loadSchedulesFor(
  year,
  month
) {

  try {

    const data =
      await fetchJson(
        `${API_BASE}?mode=googleSchedules&year=${year}&month=${month}`
      );


    if (
      data.success !== true
    ) {

      throw new Error(
        data.error ||
        "Googleカレンダーを取得できません"
      );

    }


    scheduleData =
      Array.isArray(data.schedules)
        ? data.schedules
        : [];


    return scheduleData;

  }

  catch (error) {

    console.error(
      "Google Schedule Error:",
      error
    );


    scheduleData = [];

    return [];

  }

}


// =========================================================
// TODAY GOOGLE SCHEDULES
// =========================================================

async function loadTodaySchedules() {

  try {

    const data =
      await fetchJson(
        `${API_BASE}?mode=todaySchedules`
      );


    if (
      data.success !== true
    ) {

      throw new Error(
        data.error ||
        "今日の予定を取得できません"
      );

    }


    todayScheduleData =
      Array.isArray(data.schedules)
        ? data.schedules
        : [];


    renderTodaySchedules();


    return todayScheduleData;

  }

  catch (error) {

    console.error(
      "Today Schedule Error:",
      error
    );


    todayScheduleData = [];


    const container =
      el("todayScheduleList");


    if (container) {

      container.innerHTML = `

        <div class="today-schedule-error">

          <span class="material-symbols-rounded">
            cloud_off
          </span>

          <div>

            <strong>
              予定を取得できませんでした
            </strong>

            <small>
              Googleカレンダーとの接続を確認してください
            </small>

          </div>

        </div>

      `;

    }


    return [];

  }

}


// =========================================================
// TARGET ICON
// =========================================================

function getTargetIcon(target) {

  if (
    target === "さとる"
  ) {

    return "🌿";

  }


  if (
    target === "かな"
  ) {

    return "🌸";

  }


  return "👫";

}


// =========================================================
// TODAY SCHEDULE RENDER
// =========================================================

function renderTodaySchedules() {

  const container =
    el("todayScheduleList");


  if (!container) {

    return;

  }


  if (
    !Array.isArray(todayScheduleData) ||
    todayScheduleData.length === 0
  ) {

    container.innerHTML = `

      <div class="today-empty">

        <div class="today-empty-icon">

          <span class="material-symbols-rounded">
            event_available
          </span>

        </div>

        <div>

          <strong>
            今日は予定がありません
          </strong>

          <small>
            ふたりでゆっくり過ごせそうです
          </small>

        </div>

      </div>

    `;


    return;

  }


  container.innerHTML =
    todayScheduleData
      .map(
        schedule => {

          const icon =
            getTargetIcon(
              schedule.target
            );


          const time =
            schedule.allDay
              ? "終日"
              : (
                  schedule.start
                    ? schedule.start
                    : "時間未設定"
                );


          return `

            <button
              class="today-schedule-item"
              type="button"
              data-today-schedule-id="${escapeHTML(schedule.id || "")}"
            >

              <span class="today-person">
                ${icon}
              </span>


              <span class="today-time">
                ${escapeHTML(time)}
              </span>


              <span class="today-event">

                <strong>
                  ${escapeHTML(schedule.title || "予定")}
                </strong>

                <small>
                  ${escapeHTML(schedule.target || "ふたり")}
                </small>

              </span>


              <span class="material-symbols-rounded today-arrow">
                chevron_right
              </span>

            </button>

          `;

        }
      )
      .join("");


  container
    .querySelectorAll(
      "[data-today-schedule-id]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          async () => {

            const id =
              button.dataset.todayScheduleId;


            const schedule =
              todayScheduleData.find(
                item =>
                  String(item.id) ===
                  String(id)
              );


            if (!schedule) {

              return;

            }


            calendarDate =
              new Date();


            selectedCalendarDate =
              localDateKey(
                new Date()
              );


            await switchPage(
              "calendar"
            );


            const latest =
              scheduleData.find(
                item =>
                  String(item.id) ===
                  String(id)
              ) ||
              schedule;


            openScheduleModal(
              latest
            );

          }
        );

      }
    );

}


// =========================================================
// HEADER
// =========================================================

function updatePageHeader() {

  const kicker =
    el("pageKicker");


  const title =
    el("pageTitle");


  const month =
    el("currentMonth");


  const configs = {

    home: {

      kicker:
        "🌿 FAMILY HOUSEHOLD",

      title:
        "ふたりの家計簿"

    },

    receipt: {

      kicker:
        "🧾 HISTORY",

      title:
        "レシート"

    },

    report: {

      kicker:
        "📊 ANALYSIS",

      title:
        "レポート"

    },

    calendar: {

      kicker:
        "👫 GOOGLE CALENDAR",

      title:
        "ふたりの予定"

    },

    settings: {

      kicker:
        "⚙️ MANAGE",

      title:
        "設定"

    }

  };


  const config =
    configs[currentPage] ||
    configs.home;


  if (kicker) {

    kicker.textContent =
      config.kicker;

  }


  if (title) {

    title.textContent =
      config.title;

  }


  if (!month) {

    return;

  }


  if (
    currentPage === "home"
  ) {

    month.textContent =
      formatFullJapaneseDate(
        new Date()
      );


    return;

  }


  let targetDate =
    new Date();


  if (
    currentPage === "receipt"
  ) {

    targetDate =
      receiptDate;

  }


  if (
    currentPage === "calendar"
  ) {

    targetDate =
      calendarDate;

  }


  month.textContent =
    `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月`;

}


// =========================================================
// PAGE SWITCH
// =========================================================

async function switchPage(page) {

  const validPages = [
    "home",
    "receipt",
    "report",
    "calendar",
    "settings"
  ];


  if (
    !validPages.includes(page)
  ) {

    page = "home";

  }


  currentPage = page;


  document
    .querySelectorAll(
      "[data-page-panel]"
    )
    .forEach(
      panel => {

        panel.hidden = true;

        panel.classList.remove(
          "is-active"
        );

      }
    );


  const activePanel =
    document.querySelector(
      `[data-page-panel="${page}"]`
    );


  if (activePanel) {

    activePanel.hidden = false;

    activePanel.classList.add(
      "is-active"
    );

  }


  document
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(
      button => {

        const active =
          button.dataset.page === page;


        button.classList.toggle(
          "active",
          active
        );


        button.setAttribute(
          "aria-current",
          active
            ? "page"
            : "false"
        );

      }
    );


  updatePageHeader();


  window.scrollTo(
    0,
    0
  );


  document.documentElement.scrollTop = 0;

  document.body.scrollTop = 0;


  if (
    page === "home"
  ) {

    renderHome();

    // ホーム画面の表示をカレンダー通信で待たせない
    void loadTodaySchedules();

  }


  if (
    page === "receipt"
  ) {

    await refreshReceiptPage();

  }


  if (
    page === "report"
  ) {

    renderReport();

  }


  if (
    page === "calendar"
  ) {

    await refreshCalendarPage();

  }


  if (
    history.replaceState
  ) {

    history.replaceState(
      null,
      "",
      `#${page}`
    );

  }

}


// =========================================================
// HOME
// =========================================================

function renderHome() {

  if (!dashboardData) {

    return;

  }


  const living =
    dashboardData.living || {};


  const budget =
    Number(
      living.budget ??
      dashboardData.budget ??
      SETTINGS.monthlyBudget
    ) ||
    SETTINGS.monthlyBudget;


  const expense =
    Number(
      living.expense ??
      dashboardData.expense ??
      0
    ) || 0;


  const remaining =
    Number(
      living.remaining ??
      dashboardData.balance ??
      (
        budget -
        expense
      )
    );


  const rate =
    budget > 0
      ? (
          expense /
          budget
        ) * 100
      : 0;


  if (
    el("totalMoney")
  ) {

    el("totalMoney").textContent =
      yen(expense);

  }


  if (
    el("budgetMoney")
  ) {

    el("budgetMoney").textContent =
      yen(budget);

  }


  if (
    el("balanceMoney")
  ) {

    el("balanceMoney").textContent =
      yen(remaining);


    el("balanceMoney")
      .classList.toggle(
        "is-danger",
        remaining < 0
      );

  }


  const percentage =
    Math.round(rate);


  if (
    el("budgetPercent")
  ) {

    el("budgetPercent").textContent =
      `${percentage}%`;

  }


  if (
    el("progressBar")
  ) {

    el("progressBar").style.width =
      `${Math.min(
        100,
        Math.max(
          0,
          rate
        )
      )}%`;

  }


  if (
    el("budgetProgress")
  ) {

    el("budgetProgress")
      .setAttribute(
        "aria-valuenow",
        String(
          Math.min(
            100,
            Math.max(
              0,
              percentage
            )
          )
        )
      );

  }


  const saving =
    Number(
      dashboardData.saving?.current ??
      dashboardData.saving?.actual ??
      0
    ) || 0;


  if (
    el("savingActual")
  ) {

    el("savingActual").textContent =
      yen(saving);

  }


  renderCategoryList(
    el("categoryList"),
    Array.isArray(
      dashboardData.categories
    )
      ? dashboardData.categories
      : []
  );


  renderReceiptList(
    el("recentList"),
    Array.isArray(
      dashboardData.recent
    )
      ? dashboardData.recent
      : [],
    5
  );


  renderAdvice();

}


// =========================================================
// CATEGORY
// =========================================================

function renderCategoryList(
  container,
  categories
) {

  if (!container) {

    return;

  }


  if (
    !Array.isArray(categories) ||
    categories.length === 0
  ) {

    container.innerHTML =
      createEmptyState(
        "pie_chart",
        "カテゴリデータがありません",
        ""
      );


    return;

  }


  const toNumber =
    value => {

      const direct =
        Number(value);


      if (
        !Number.isNaN(direct)
      ) {

        return direct;

      }


      return (
        Number(
          String(value || "")
            .replace(
              /[^\d.-]/g,
              ""
            )
        ) || 0
      );

    };


  const sortedCategories =
    categories
      .map(
        (
          category,
          index
        ) => ({

          category,

          index,

          amount:
            toNumber(
              category.amount
            )

        })
      )
      .sort(
        (a, b) => {

          const aHasAmount =
            a.amount > 0;


          const bHasAmount =
            b.amount > 0;


          if (
            aHasAmount &&
            !bHasAmount
          ) {

            return -1;

          }


          if (
            !aHasAmount &&
            bHasAmount
          ) {

            return 1;

          }


          if (
            aHasAmount &&
            bHasAmount
          ) {

            return (
              b.amount -
              a.amount
            );

          }


          return (
            a.index -
            b.index
          );

        }
      )
      .map(
        item =>
          item.category
      );


  container.innerHTML =
    sortedCategories
      .map(
        category => {

          const budget =
            toNumber(
              category.budget
            );


          const amount =
            toNumber(
              category.amount
            );


          const remaining =
            budget -
            amount;


          let rate = 0;


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

            rate = 100;

          }


          const remainingText =
            budget <= 0
              ? "予算未設定"
              : (
                  remaining >= 0
                    ? `残り ${yen(remaining)}`
                    : `${yen(Math.abs(remaining))} オーバー`
                );


          return `

            <div class="category-item">

              <div class="category-top">

                <span class="category-name">
                  ${escapeHTML(category.name || "🧾 雑費")}
                </span>

                <strong class="category-amount">

                  ${
                    budget > 0
                      ? `${yen(amount)} / ${yen(budget)}`
                      : yen(amount)
                  }

                </strong>

              </div>


              <div class="category-progress">

                <div
                  class="category-progress-bar"
                  style="
                    width:${Math.min(100, Math.max(0, rate))}%;
                    background:${safeColor(category.color)};
                  "
                ></div>

              </div>


              <div
                class="
                  category-remaining
                  ${remaining < 0 ? "is-danger" : ""}
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
// RECEIPT LIST
// =========================================================

function renderReceiptList(
  container,
  receipts,
  limit = null
) {

  if (!container) {

    return;

  }


  const source =
    Array.isArray(receipts)
      ? receipts
      : [];


  const items =
    limit
      ? source.slice(
          0,
          limit
        )
      : source;


  if (
    items.length === 0
  ) {

    container.innerHTML =
      createEmptyState(
        "receipt_long",
        "支出はありません",
        "登録した支出がここに表示されます"
      );


    return;

  }


  container.innerHTML =
    items
      .map(
        item => {

          const payer =
            String(
              item.payer || ""
            ).trim();


          return `

            <article class="receipt-item">

              <div class="receipt-thumbnail">

                <span class="material-symbols-rounded">
                  receipt_long
                </span>

              </div>


              <div class="receipt-info">

                <div class="receipt-shop">
                  ${escapeHTML(item.shop || "支出")}
                </div>


                <div class="receipt-meta">

                  <span>
                    ${escapeHTML(item.category || "🧾 雑費")}
                  </span>

                  <span>
                    ${escapeHTML(formatShortDate(item.date))}
                  </span>

                  ${
                    payer
                      ? `
                        <span class="payer-chip">
                          ${escapeHTML(payer)}
                        </span>
                      `
                      : ""
                  }

                </div>

              </div>


              <strong class="receipt-amount">
                ${yen(item.amount)}
              </strong>

            </article>

          `;

        }
      )
      .join("");

}


// =========================================================
// AI ADVICE
// =========================================================

function renderAdvice() {

  const target =
    el("aiAdvice");


  if (
    !target ||
    !dashboardData
  ) {

    return;

  }


  const living =
    dashboardData.living || {};


  const budget =
    Number(
      living.budget ||
      SETTINGS.monthlyBudget
    );


  const expense =
    Number(
      living.expense ||
      0
    );


  const remaining =
    Number(
      living.remaining ??
      (
        budget -
        expense
      )
    );


  if (
    remaining < 0
  ) {

    target.textContent =
      `今月は生活費予算を${yen(Math.abs(remaining))}超えています。カテゴリ別の支出を確認してみましょう。`;


    return;

  }


  const categories =
    Array.isArray(
      dashboardData.categories
    )
      ? [...dashboardData.categories]
      : [];


  const top =
    categories
      .filter(
        item =>
          Number(
            item.amount
          ) > 0
      )
      .sort(
        (a, b) =>
          Number(
            b.amount
          ) -
          Number(
            a.amount
          )
      )[0];


  if (top) {

    target.textContent =
      `今月は「${top.name}」が最も多く${yen(top.amount)}です。生活費はあと${yen(remaining)}残っています。`;


    return;

  }


  target.textContent =
    `今月の生活費は${yen(budget)}からスタートです。`;

}


// =========================================================
// RECEIPT PAGE
// =========================================================

async function refreshReceiptPage() {

  const year =
    receiptDate.getFullYear();


  const month =
    receiptDate.getMonth() + 1;


  if (
    el("receiptMonthLabel")
  ) {

    el("receiptMonthLabel").textContent =
      `${year}年${month}月`;

  }


  await loadReceiptsFor(
    year,
    month
  );


  renderReceiptPage();

}


function renderReceiptPage() {

  const year =
    receiptDate.getFullYear();


  const month =
    receiptDate.getMonth() + 1;


  const filtered =
    receiptData
      .filter(
        item => {

          const date =
            parseDateValue(
              item.date
            );


          if (!date) {

            return false;

          }


          return (
            date.getFullYear() === year &&
            date.getMonth() + 1 === month
          );

        }
      )
      .sort(
        (a, b) => {

          const aDate =
            parseDateValue(
              a.date
            );


          const bDate =
            parseDateValue(
              b.date
            );


          return (
            (
              bDate?.getTime() ||
              0
            ) -
            (
              aDate?.getTime() ||
              0
            )
          );

        }
      );


  const total =
    filtered.reduce(
      (
        sum,
        item
      ) =>
        sum +
        (
          Number(
            item.amount
          ) ||
          0
        ),
      0
    );


  if (
    el("receiptMonthTotal")
  ) {

    el("receiptMonthTotal").textContent =
      yen(total);

  }


  if (
    el("receiptCount")
  ) {

    el("receiptCount").textContent =
      `${filtered.length}件`;

  }


  renderReceiptList(
    el("receiptFullList"),
    filtered
  );

}


// =========================================================
// REPORT
// =========================================================

function renderReport() {

  if (!dashboardData) {

    return;

  }


  const living =
    dashboardData.living || {};


  const budget =
    Number(
      living.budget ??
      SETTINGS.monthlyBudget
    ) ||
    SETTINGS.monthlyBudget;


  const expense =
    Number(
      living.expense ??
      0
    ) || 0;


  const remaining =
    Number(
      living.remaining ??
      (
        budget -
        expense
      )
    );


  const rate =
    budget > 0
      ? (
          expense /
          budget
        ) * 100
      : 0;


  const saving =
    Number(
      dashboardData.saving?.current ??
      dashboardData.saving?.actual ??
      0
    ) || 0;


  if (
    el("reportExpense")
  ) {

    el("reportExpense").textContent =
      yen(expense);

  }


  if (
    el("reportBudget")
  ) {

    el("reportBudget").textContent =
      yen(budget);

  }


  if (
    el("reportRemaining")
  ) {

    el("reportRemaining").textContent =
      yen(remaining);

  }


  if (
    el("reportRate")
  ) {

    el("reportRate").textContent =
      `${Math.round(rate)}%`;

  }


  if (
    el("reportSaving")
  ) {

    el("reportSaving").textContent =
      yen(saving);

  }


  if (
    el("reportHeroCaption")
  ) {

    el("reportHeroCaption").textContent =
      `生活費予算 ${yen(budget)} ・ 残り ${yen(remaining)}`;

  }


  const categories =
    Array.isArray(
      dashboardData.categories
    )
      ? [...dashboardData.categories]
      : [];


  categories.sort(
    (a, b) =>
      Number(
        b.amount
      ) -
      Number(
        a.amount
      )
  );


  renderCategoryList(
    el("reportCategoryList"),
    categories
  );

}


// =========================================================
// CALENDAR REFRESH
// =========================================================

async function refreshCalendarPage() {

  const year =
    calendarDate.getFullYear();


  const month =
    calendarDate.getMonth() + 1;


  if (
    el("calendarMonthLabel")
  ) {

    el("calendarMonthLabel").textContent =
      `${year}年${month}月`;

  }


  await Promise.all([

    loadReceiptsFor(
      year,
      month
    ),

    loadSchedulesFor(
      year,
      month
    )

  ]);


  if (
    !selectedCalendarDate ||
    !selectedCalendarDate.startsWith(
      `${year}-${String(month).padStart(2, "0")}`
    )
  ) {

    const today =
      new Date();


    if (
      today.getFullYear() === year &&
      today.getMonth() + 1 === month
    ) {

      selectedCalendarDate =
        localDateKey(today);

    }

    else {

      selectedCalendarDate =
        localDateKey(
          new Date(
            year,
            month - 1,
            1
          )
        );

    }

  }


  renderCalendar();

  renderSelectedDay();

}


// =========================================================
// CALENDAR
// =========================================================

function renderCalendar() {

  const grid =
    el("calendarGrid");


  if (!grid) {

    return;

  }


  const year =
    calendarDate.getFullYear();


  const monthIndex =
    calendarDate.getMonth();


  const firstDay =
    new Date(
      year,
      monthIndex,
      1
    );


  const lastDay =
    new Date(
      year,
      monthIndex + 1,
      0
    );


  const firstWeekday =
    firstDay.getDay();


  const daysInMonth =
    lastDay.getDate();


  const todayKey =
    localDateKey(
      new Date()
    );


  let html = "";


  for (
    let i = 0;
    i < firstWeekday;
    i++
  ) {

    html +=
      `<div class="calendar-day calendar-day-empty"></div>`;

  }


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const date =
      new Date(
        year,
        monthIndex,
        day
      );


    const key =
      localDateKey(date);


    const schedules =
      getSchedulesForDate(key);


    const expenses =
      getExpensesForDate(key);


    const hasSatoru =
      schedules.some(
        item =>
          item.target ===
          "さとる"
      );


    const hasKana =
      schedules.some(
        item =>
          item.target ===
          "かな"
      );


    const hasTogether =
      schedules.some(
        item =>
          item.target ===
          "ふたり"
      );


    const hasExpense =
      expenses.length > 0;


    const isToday =
      key === todayKey;


    const isSelected =
      key ===
      selectedCalendarDate;


    const weekday =
      date.getDay();


    html += `

      <button
        type="button"
        class="
          calendar-day
          ${isToday ? "is-today" : ""}
          ${isSelected ? "is-selected" : ""}
          ${weekday === 0 ? "is-sunday" : ""}
          ${weekday === 6 ? "is-saturday" : ""}
        "
        data-calendar-date="${key}"
      >

        <span class="calendar-day-number">
          ${day}
        </span>


        <span class="calendar-event-markers">

          ${
            hasSatoru
              ? `<i class="marker marker-satoru"></i>`
              : ""
          }

          ${
            hasKana
              ? `<i class="marker marker-kana"></i>`
              : ""
          }

          ${
            hasTogether
              ? `<i class="marker marker-together"></i>`
              : ""
          }

          ${
            hasExpense
              ? `<i class="marker-expense">¥</i>`
              : ""
          }

        </span>

      </button>

    `;

  }


  grid.innerHTML = html;


  grid
    .querySelectorAll(
      "[data-calendar-date]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            selectedCalendarDate =
              button.dataset.calendarDate;


            renderCalendar();

            renderSelectedDay();


            document
              .querySelector(
                ".selected-date-section"
              )
              ?.scrollIntoView({

                behavior:
                  "smooth",

                block:
                  "start"

              });

          }
        );

      }
    );

}


// =========================================================
// EXPENSES FOR DATE
// =========================================================

function getExpensesForDate(
  dateKey
) {

  return receiptData.filter(
    item => {

      const date =
        parseDateValue(
          item.date
        );


      if (!date) {

        return false;

      }


      return (
        localDateKey(date) ===
        dateKey
      );

    }
  );

}


// =========================================================
// SCHEDULES FOR DATE
// =========================================================

function getSchedulesForDate(
  dateKey
) {

  return scheduleData
    .filter(
      item =>
        String(
          item.date || ""
        ).slice(
          0,
          10
        ) ===
        dateKey
    )
    .sort(
      (a, b) => {

        if (
          a.allDay &&
          !b.allDay
        ) {

          return -1;

        }


        if (
          !a.allDay &&
          b.allDay
        ) {

          return 1;

        }


        return String(
          a.start || ""
        ).localeCompare(
          String(
            b.start || ""
          )
        );

      }
    );

}


// =========================================================
// SELECTED DAY
// =========================================================

function renderSelectedDay() {

  if (
    !selectedCalendarDate
  ) {

    return;

  }


  const schedules =
    getSchedulesForDate(
      selectedCalendarDate
    );


  const expenses =
    getExpensesForDate(
      selectedCalendarDate
    );


  const expenseTotal =
    expenses.reduce(
      (
        sum,
        item
      ) =>
        sum +
        (
          Number(
            item.amount
          ) ||
          0
        ),
      0
    );


  if (
    el("selectedDateTitle")
  ) {

    el("selectedDateTitle").textContent =
      formatJapaneseDate(
        selectedCalendarDate
      );

  }


  if (
    el("selectedDateTotal")
  ) {

    el("selectedDateTotal").textContent =
      expenseTotal > 0
        ? yen(expenseTotal)
        : "支出なし";

  }


  const container =
    el("selectedDayList");


  if (!container) {

    return;

  }


  let html = `

    <div class="day-detail-block">

      <div class="day-detail-heading">

        <span class="material-symbols-rounded">
          event
        </span>

        <strong>
          Googleカレンダー
        </strong>

        <small>
          ${schedules.length}件
        </small>

      </div>

  `;


  if (
    schedules.length === 0
  ) {

    html += `

      <div class="day-empty-row">
        この日の予定はありません
      </div>

    `;

  }

  else {

    schedules.forEach(
      schedule => {

        const icon =
          getTargetIcon(
            schedule.target
          );


        const time =
          schedule.allDay
            ? "終日"
            : (
                schedule.start
                  ? (
                      schedule.end
                        ? `${schedule.start}〜${schedule.end}`
                        : schedule.start
                    )
                  : "時間未設定"
              );


        html += `

          <button
            type="button"
            class="schedule-detail-row"
            data-schedule-id="${escapeHTML(schedule.id)}"
          >

            <span class="schedule-person-icon">
              ${icon}
            </span>


            <div class="schedule-detail-main">

              <strong>
                ${escapeHTML(schedule.title || "予定")}
              </strong>

              <span>
                ${escapeHTML(time)}
                ・
                ${escapeHTML(schedule.target || "ふたり")}
              </span>

              ${
                schedule.memo
                  ? `
                    <small>
                      ${escapeHTML(schedule.memo)}
                    </small>
                  `
                  : ""
              }

            </div>


            <span class="material-symbols-rounded schedule-chevron">
              chevron_right
            </span>

          </button>

        `;

      }
    );

  }


  html +=
    `</div>`;


  html += `

    <div class="day-detail-block">

      <div class="day-detail-heading">

        <span class="material-symbols-rounded">
          payments
        </span>

        <strong>
          この日の支出
        </strong>

        <small>
          ${expenses.length}件
        </small>

      </div>

  `;


  if (
    expenses.length === 0
  ) {

    html += `

      <div class="day-empty-row">
        この日の支出はありません
      </div>

    `;

  }

  else {

    expenses.forEach(
      expense => {

        html += `

          <div class="day-expense-row">

            <div class="day-expense-main">

              <strong>
                ${escapeHTML(expense.shop || "支出")}
              </strong>

              <span>

                ${escapeHTML(expense.category || "🧾 雑費")}

                ${
                  expense.payer
                    ? ` ・ ${escapeHTML(expense.payer)}`
                    : ""
                }

              </span>

            </div>


            <strong class="day-expense-price">
              ${yen(expense.amount)}
            </strong>

          </div>

        `;

      }
    );


    html += `

      <div class="day-expense-total">

        <span>
          合計
        </span>

        <strong>
          ${yen(expenseTotal)}
        </strong>

      </div>

    `;

  }


  html +=
    `</div>`;


  container.innerHTML = html;


  container
    .querySelectorAll(
      "[data-schedule-id]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const id =
              button.dataset.scheduleId;


            const schedule =
              scheduleData.find(
                item =>
                  String(item.id) ===
                  String(id)
              );


            if (schedule) {

              openScheduleModal(
                schedule
              );

            }

          }
        );

      }
    );

}


// =========================================================
// TARGET
// =========================================================

function syncTargetSelector(
  target
) {

  const value =
    [
      "さとる",
      "かな",
      "ふたり"
    ].includes(target)
      ? target
      : "ふたり";


  if (
    el("scheduleTarget")
  ) {

    el("scheduleTarget").value =
      value;

  }


  document
    .querySelectorAll(
      'input[name="scheduleTargetRadio"]'
    )
    .forEach(
      radio => {

        radio.checked =
          radio.value ===
          value;

      }
    );

}


// =========================================================
// MODAL
// =========================================================

function openScheduleModal(
  schedule = null
) {

  const modal =
    el("scheduleModal");


  if (!modal) {

    return;

  }


  modal.hidden = false;


  requestAnimationFrame(
    () => {

      modal.classList.add(
        "show"
      );

    }
  );


  document.body.classList.add(
    "modal-open"
  );


  if (schedule) {

    el("scheduleModalTitle").textContent =
      "予定を編集";


    el("scheduleId").value =
      schedule.id || "";


    el("scheduleDate").value =
      String(
        schedule.date || ""
      ).slice(
        0,
        10
      );


    el("scheduleStart").value =
      schedule.start || "";


    el("scheduleEnd").value =
      schedule.end || "";


    el("scheduleTitle").value =
      schedule.title || "";


    el("scheduleMemo").value =
      schedule.memo || "";


    syncTargetSelector(
      schedule.target
    );


    el("deleteScheduleButton").hidden =
      false;

  }

  else {

    el("scheduleModalTitle").textContent =
      "予定を追加";


    el("scheduleId").value = "";


    el("scheduleDate").value =
      selectedCalendarDate ||
      localDateKey(
        new Date()
      );


    el("scheduleStart").value = "";

    el("scheduleEnd").value = "";

    el("scheduleTitle").value = "";

    el("scheduleMemo").value = "";


    syncTargetSelector(
      "ふたり"
    );


    el("deleteScheduleButton").hidden =
      true;

  }

}


function closeScheduleModal() {

  const modal =
    el("scheduleModal");


  if (!modal) {

    return;

  }


  modal.classList.remove(
    "show"
  );


  document.body.classList.remove(
    "modal-open"
  );


  window.setTimeout(
    () => {

      modal.hidden = true;

    },
    220
  );

}


// =========================================================
// SAVE GOOGLE SCHEDULE
// =========================================================

async function saveSchedule() {

  const id =
    String(
      el("scheduleId").value ||
      ""
    ).trim();


  const date =
    el("scheduleDate").value;


  const start =
    el("scheduleStart").value;


  const end =
    el("scheduleEnd").value;


  const title =
    String(
      el("scheduleTitle").value ||
      ""
    ).trim();


  const target =
    el("scheduleTarget").value;


  const memo =
    String(
      el("scheduleMemo").value ||
      ""
    ).trim();


  if (!date) {

    showToast(
      "日付を選択してください"
    );

    return;

  }


  if (!title) {

    showToast(
      "予定を入力してください"
    );

    return;

  }


  const params =
    new URLSearchParams();


  params.set(
    "action",
    id
      ? "updateGoogleSchedule"
      : "addGoogleSchedule"
  );


  if (id) {

    params.set(
      "id",
      id
    );

  }


  params.set(
    "date",
    date
  );


  params.set(
    "start",
    start
  );


  params.set(
    "end",
    end
  );


  params.set(
    "title",
    title
  );


  params.set(
    "target",
    target
  );


  params.set(
    "memo",
    memo
  );


  const saveButton =
    el("saveScheduleButton");


  const oldText =
    saveButton.textContent;


  saveButton.disabled = true;

  saveButton.textContent =
    "Googleカレンダーへ保存中...";


  try {

    const result =
      await fetchJson(
        `${API_BASE}?${params.toString()}`
      );


    if (
      result.success !== true
    ) {

      throw new Error(
        result.error ||
        "保存に失敗しました"
      );

    }


    selectedCalendarDate = date;


    calendarDate =
      new Date(
        `${date}T00:00:00`
      );


    closeScheduleModal();


    await refreshCalendarPage();

    await loadTodaySchedules();


    showToast(
      id
        ? "Googleカレンダーの予定を変更しました"
        : "Googleカレンダーへ予定を追加しました"
    );

  }

  catch (error) {

    console.error(
      "Save Google Schedule Error:",
      error
    );


    showToast(
      "予定を保存できませんでした"
    );

  }

  finally {

    saveButton.disabled = false;

    saveButton.textContent =
      oldText;

  }

}


// =========================================================
// DELETE GOOGLE SCHEDULE
// =========================================================

async function deleteSchedule() {

  const id =
    String(
      el("scheduleId").value ||
      ""
    ).trim();


  if (!id) {

    return;

  }


  const confirmed =
    window.confirm(
      "Googleカレンダーからこの予定を削除しますか？"
    );


  if (!confirmed) {

    return;

  }


  try {

    const result =
      await fetchJson(
        `${API_BASE}?action=deleteGoogleSchedule&id=${encodeURIComponent(id)}`
      );


    if (
      result.success !== true
    ) {

      throw new Error(
        result.error ||
        "削除に失敗しました"
      );

    }


    closeScheduleModal();


    await refreshCalendarPage();

    await loadTodaySchedules();


    showToast(
      "Googleカレンダーから予定を削除しました"
    );

  }

  catch (error) {

    console.error(
      "Delete Google Schedule Error:",
      error
    );


    showToast(
      "予定を削除できませんでした"
    );

  }

}


// =========================================================
// EMPTY
// =========================================================

function createEmptyState(
  icon,
  title,
  description
) {

  return `

    <div class="empty-state">

      <span class="material-symbols-rounded">
        ${escapeHTML(icon)}
      </span>

      <strong>
        ${escapeHTML(title)}
      </strong>

      ${
        description
          ? `
            <p>
              ${escapeHTML(description)}
            </p>
          `
          : ""
      }

    </div>

  `;

}


// =========================================================
// TOAST
// =========================================================

let toastTimer = null;


function showToast(message) {

  const toast =
    el("errorToast");


  const text =
    el("errorMessage");


  if (
    !toast ||
    !text
  ) {

    return;

  }


  text.textContent =
    message;


  toast.classList.add(
    "show"
  );


  if (toastTimer) {

    clearTimeout(
      toastTimer
    );

  }


  toastTimer =
    window.setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      2600
    );

}


// =========================================================
// UPDATED
// =========================================================

function updateLastUpdated() {

  const target =
    el("lastUpdated");


  if (!target) {

    return;

  }


  const current =
    new Date();


  target.textContent =
    `${current.toLocaleTimeString(
      "ja-JP",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    )} 更新`;

}


// =========================================================
// EVENTS
// =========================================================

function setupEvents() {

  // NAV

  document
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          async () => {

            await switchPage(
              button.dataset.page
            );

          }
        );

      }
    );


  // HOME → CALENDAR

  el("todayCalendarButton")
    ?.addEventListener(
      "click",
      async () => {

        calendarDate =
          new Date();


        selectedCalendarDate =
          localDateKey(
            new Date()
          );


        await switchPage(
          "calendar"
        );

      }
    );


  // HOME ADD TODAY

  el("todayAddScheduleButton")
    ?.addEventListener(
      "click",
      () => {

        selectedCalendarDate =
          localDateKey(
            new Date()
          );


        openScheduleModal();

      }
    );


  // HOME → REPORT

  el("categoryDetailButton")
    ?.addEventListener(
      "click",
      () => {

        switchPage(
          "report"
        );

      }
    );


  // HOME → RECEIPT

  el("receiptDetailButton")
    ?.addEventListener(
      "click",
      () => {

        switchPage(
          "receipt"
        );

      }
    );


  // RECEIPT PREV

  el("receiptPrevMonth")
    ?.addEventListener(
      "click",
      async () => {

        receiptDate =
          new Date(
            receiptDate.getFullYear(),
            receiptDate.getMonth() - 1,
            1
          );


        updatePageHeader();

        await refreshReceiptPage();

      }
    );


  // RECEIPT NEXT

  el("receiptNextMonth")
    ?.addEventListener(
      "click",
      async () => {

        receiptDate =
          new Date(
            receiptDate.getFullYear(),
            receiptDate.getMonth() + 1,
            1
          );


        updatePageHeader();

        await refreshReceiptPage();

      }
    );


  // CALENDAR PREV

  el("calendarPrevMonth")
    ?.addEventListener(
      "click",
      async () => {

        calendarDate =
          new Date(
            calendarDate.getFullYear(),
            calendarDate.getMonth() - 1,
            1
          );


        selectedCalendarDate = null;

        updatePageHeader();

        await refreshCalendarPage();

      }
    );


  // CALENDAR NEXT

  el("calendarNextMonth")
    ?.addEventListener(
      "click",
      async () => {

        calendarDate =
          new Date(
            calendarDate.getFullYear(),
            calendarDate.getMonth() + 1,
            1
          );


        selectedCalendarDate = null;

        updatePageHeader();

        await refreshCalendarPage();

      }
    );


  // ADD SCHEDULE

  el("addScheduleButton")
    ?.addEventListener(
      "click",
      () => {

        openScheduleModal();

      }
    );


  // CLOSE

  el("scheduleModalClose")
    ?.addEventListener(
      "click",
      closeScheduleModal
    );


  el("scheduleModal")
    ?.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          el("scheduleModal")
        ) {

          closeScheduleModal();

        }

      }
    );


  // TARGET

  document
    .querySelectorAll(
      'input[name="scheduleTargetRadio"]'
    )
    .forEach(
      radio => {

        radio.addEventListener(
          "change",
          () => {

            if (
              radio.checked &&
              el("scheduleTarget")
            ) {

              el("scheduleTarget").value =
                radio.value;

            }

          }
        );

      }
    );


  // SAVE

  el("saveScheduleButton")
    ?.addEventListener(
      "click",
      saveSchedule
    );


  // DELETE

  el("deleteScheduleButton")
    ?.addEventListener(
      "click",
      deleteSchedule
    );


  // BELL

  el("notificationButton")
    ?.addEventListener(
      "click",
      () => {

        showToast(
          "現在、新しいお知らせはありません"
        );

      }
    );

}


// =========================================================
// AUTO REFRESH
// =========================================================

function startAutoRefresh() {

  if (refreshTimer) {

    clearInterval(
      refreshTimer
    );

  }


  refreshTimer =
    window.setInterval(
      async () => {

        if (
          document.visibilityState !==
          "visible"
        ) {

          return;

        }


        await loadDashboard();


        await loadTodaySchedules();


        if (
          currentPage === "receipt"
        ) {

          await refreshReceiptPage();

        }


        if (
          currentPage === "calendar"
        ) {

          await refreshCalendarPage();

        }

      },
      SETTINGS.refreshInterval
    );

}


// =========================================================
// VISIBILITY
// =========================================================

document.addEventListener(
  "visibilitychange",
  async () => {

    if (
      document.visibilityState !==
      "visible"
    ) {

      return;

    }


    await loadDashboard();

    await loadTodaySchedules();


    if (
      currentPage === "calendar"
    ) {

      await refreshCalendarPage();

    }

  }
);


// =========================================================
// INITIAL PAGE
// =========================================================

function getInitialPage() {

  const hash =
    window.location.hash
      .replace(
        "#",
        ""
      )
      .trim();


  const valid = [
    "home",
    "receipt",
    "report",
    "calendar",
    "settings"
  ];


  return valid.includes(hash)
    ? hash
    : "home";

}


// =========================================================
// INITIALIZE
// =========================================================

async function initializeApp() {

  document
    .querySelectorAll(
      "[data-page-panel]"
    )
    .forEach(
      panel => {

        panel.hidden = true;

      }
    );


  setupEvents();


  // 以前の家計簿があれば即表示する
  restoreDashboardCache();


  const initialPage =
    getInitialPage();


  await switchPage(
    initialPage
  );


  // 最新データは表示後に裏で更新する
  void loadDashboard();


  // ホーム以外ではカレンダー通信も画面初期表示を止めない
  // （ホームは switchPage 内で開始済み）
  if (initialPage !== "home") {
    void loadTodaySchedules();
  }


  startAutoRefresh();

}


// =========================================================
// START
// =========================================================

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp
  );
} else {
  initializeApp();
}
// =========================================================
// AIアドバイス修正版
// 家賃を「最も多い支出」の判定対象から除外
// =========================================================

function renderAdvice() {
  const target =
    document.getElementById(
      "aiAdvice"
    );

  if (
    !target ||
    !dashboardData
  ) {
    return;
  }

  const living =
    dashboardData.living || {};

  const budget =
    Number(
      living.budget ??
      SETTINGS.monthlyBudget ??
      250000
    ) || 250000;

  const expense =
    Number(
      living.expense ?? 0
    ) || 0;

  const remaining =
    Number(
      living.remaining ??
      (
        budget -
        expense
      )
    );

  const categories =
    Array.isArray(
      dashboardData.categories
    )
      ? [...dashboardData.categories]
      : [];

  function adviceAmountNumber_(value) {
    if (
      typeof value === "number"
    ) {
      return Number.isFinite(value)
        ? value
        : 0;
    }

    const number =
      Number(
        String(value || "")
          .replace(/,/g, "")
          .replace(/[¥￥円]/g, "")
          .replace(/\s/g, "")
      );

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function renderAdvice() {
  const target =
    document.getElementById(
      "aiAdvice"
    );

  if (
    !target ||
    !dashboardData
  ) {
    return;
  }

  const living =
    dashboardData.living || {};

  const budget =
    Number(
      living.budget ??
      SETTINGS.monthlyBudget ??
      250000
    ) || 250000;

  const expense =
    Number(
      living.expense ?? 0
    ) || 0;

  const remaining =
    Number(
      living.remaining ??
      (
        budget -
        expense
      )
    );

  const categories =
    Array.isArray(
      dashboardData.categories
    )
      ? [...dashboardData.categories]
      : [];

  function adviceAmountNumber_(value) {
    if (
      typeof value === "number"
    ) {
      return Number.isFinite(value)
        ? value
        : 0;
    }

    const number =
      Number(
        String(value || "")
          .replace(/,/g, "")
          .replace(/[¥￥円]/g, "")
          .replace(/\s/g, "")
      );

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function adviceIsRentCategory_(category) {
    const name =
      String(
        category &&
        category.name
          ? category.name
          : ""
      );

    return (
      name.indexOf("家賃") !== -1 ||
      name.indexOf("賃料") !== -1
    );
  }

  const top =
    categories
      .filter(
        function(category) {
          return (
            !adviceIsRentCategory_(
              category
            ) &&
            adviceAmountNumber_(
              category.amount
            ) > 0
          );
        }
      )
      .sort(
        function(a, b) {
          return (
            adviceAmountNumber_(
              b.amount
            ) -
            adviceAmountNumber_(
              a.amount
            )
          );
        }
      )[0];

  if (
    remaining < 0
  ) {
    if (top) {
      target.textContent =
        "今月は生活費予算を" +
        yen(
          Math.abs(
            remaining
          )
        ) +
        "超えています。「" +
        String(
          top.name || ""
        ) +
        "」の支出が最も多く" +
        yen(
          adviceAmountNumber_(
            top.amount
          )
        ) +
        "です。";
    }
    else {
      target.textContent =
        "今月は生活費予算を" +
        yen(
          Math.abs(
            remaining
          )
        ) +
        "超えています。";
    }

    return;
  }

  if (top) {
    target.textContent =
      "今月は「" +
      String(
        top.name || ""
      ) +
      "」の支出が最も多く" +
      yen(
        adviceAmountNumber_(
          top.amount
        )
      ) +
      "です。生活費はあと" +
      yen(
        remaining
      ) +
      "残っています。";

    return;
  }

  if (
    expense > 0
  ) {
    target.textContent =
      "今月の生活費はあと" +
      yen(
        remaining
      ) +
      "残っています。";

    return;
  }

  target.textContent =
    "今月の生活費は" +
    yen(
      budget
    ) +
    "からスタートです。";
}
