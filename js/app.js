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
// AIアドバイス修正版：家賃は判定から外すが、文章には書かない
renderAdvice = function() {
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
      ? dashboardData.categories.slice()
      : [];

  const amountNumber =
    function(value) {
      if (
        typeof value === "number"
      ) {
        return Number.isFinite(value)
          ? value
          : 0;
      }

      const result =
        Number(
          String(value || "")
            .replace(/,/g, "")
            .replace(/[¥￥円]/g, "")
            .replace(/\s/g, "")
        );

      return Number.isFinite(result)
        ? result
        : 0;
    };

  const top =
    categories
      .filter(
        function(category) {
          const name =
            String(
              category.name || ""
            );

          const isRent =
            name.indexOf("家賃") !== -1 ||
            name.indexOf("賃料") !== -1;

          return (
            !isRent &&
            amountNumber(
              category.amount
            ) > 0
          );
        }
      )
      .sort(
        function(a, b) {
          return (
            amountNumber(
              b.amount
            ) -
            amountNumber(
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
          amountNumber(
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
        amountNumber(
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
};
// =========================================================
// 購入明細ページ＋AIアドバイス 最終修正版
// app.jsの一番最後に追加
// =========================================================


// ---------------------------------------------------------
// 購入明細を取得
// ---------------------------------------------------------

loadReceiptsFor =
  async function(
    year,
    month
  ) {
    try {
      const data =
        await fetchJson(
          API_BASE +
          "?mode=purchaseItems" +
          "&year=" +
          encodeURIComponent(year) +
          "&month=" +
          encodeURIComponent(month)
        );

      if (
        data &&
        Array.isArray(
          data.items
        )
      ) {
        receiptData =
          data.items;
      }
      else if (
        Array.isArray(data)
      ) {
        receiptData =
          data;
      }
      else if (
        data &&
        Array.isArray(
          data.data
        )
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
        "Purchase Items Error:",
        error
      );

      receiptData = [];

      showToast(
        "購入明細を取得できませんでした"
      );

      return [];
    }
  };


// ---------------------------------------------------------
// 金額変換
// ---------------------------------------------------------

function purchaseItemAmount_(value) {
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


// ---------------------------------------------------------
// 購入明細の商品名
// C列「商品名」を優先
// ---------------------------------------------------------

function purchaseItemName_(item) {
  return String(
    item.productName ||
    item.name ||
    item.itemName ||
    "商品名未設定"
  ).trim();
}


// ---------------------------------------------------------
// 購入明細の分類
// D列「分類」を表示
// ---------------------------------------------------------

function purchaseItemClassification_(
  item
) {
  const productName =
    purchaseItemName_(
      item
    );

  const candidates = [
    item.classification,
    item.subCategory,
    item.subcategory,
    item.detailCategory,
    item.normalizedName
  ];

  for (
    let i = 0;
    i < candidates.length;
    i++
  ) {
    const value =
      String(
        candidates[i] || ""
      ).trim();

    if (
      value &&
      value !== productName
    ) {
      return value;
    }
  }

  return "";
}


// ---------------------------------------------------------
// 同じ商品を最近買っているか確認
// ---------------------------------------------------------

function purchaseItemDuplicateText_(
  item,
  items
) {
  const currentName =
    purchaseItemName_(item)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s/g, "");

  if (
    !currentName ||
    currentName ===
      "商品名未設定"
  ) {
    return "";
  }

  const currentDate =
    parseDateValue(
      item.date
    );

  if (!currentDate) {
    return "";
  }

  const duplicate =
    items.find(
      function(other) {
        if (
          other === item
        ) {
          return false;
        }

        const otherName =
          purchaseItemName_(other)
            .normalize("NFKC")
            .toLowerCase()
            .replace(/\s/g, "");

        if (
          currentName !==
          otherName
        ) {
          return false;
        }

        const otherDate =
          parseDateValue(
            other.date
          );

        if (!otherDate) {
          return false;
        }

        const difference =
          Math.abs(
            currentDate.getTime() -
            otherDate.getTime()
          );

        const days =
          difference /
          (
            1000 *
            60 *
            60 *
            24
          );

        return (
          days > 0 &&
          days <= 14
        );
      }
    );

  if (!duplicate) {
    return "";
  }

  return (
    "最近も購入：" +
    formatShortDate(
      duplicate.date
    )
  );
}


// ---------------------------------------------------------
// 購入明細一覧表示
// ---------------------------------------------------------

renderReceiptList =
  function(
    container,
    receipts,
    limit
  ) {
    if (!container) {
      return;
    }

    const source =
      Array.isArray(receipts)
        ? receipts
        : [];

    const sorted =
      source
        .slice()
        .sort(
          function(a, b) {
            const dateA =
              parseDateValue(
                a.date
              );

            const dateB =
              parseDateValue(
                b.date
              );

            const timeA =
              dateA
                ? dateA.getTime()
                : 0;

            const timeB =
              dateB
                ? dateB.getTime()
                : 0;

            if (
              timeA !== timeB
            ) {
              return (
                timeB -
                timeA
              );
            }

            return (
              purchaseItemAmount_(
                b.amount
              ) -
              purchaseItemAmount_(
                a.amount
              )
            );
          }
        );

    const items =
      limit
        ? sorted.slice(
            0,
            limit
          )
        : sorted;

    if (
      items.length === 0
    ) {
      container.innerHTML =
        createEmptyState(
          "shopping_cart",
          "購入明細はありません",
          "レシートの商品がここに表示されます"
        );

      return;
    }

    container.innerHTML =
      items
        .map(
          function(item) {
            const productName =
              purchaseItemName_(
                item
              );

            const classification =
              purchaseItemClassification_(
                item
              );

            const shop =
              String(
                item.shop ||
                "店名未設定"
              ).trim();

            const category =
              String(
                item.category || ""
              ).trim();

            const payer =
              String(
                item.payer || ""
              ).trim();

            const quantity =
              Number(
                item.quantity || 1
              ) || 1;

            const unitPrice =
              purchaseItemAmount_(
                item.unitPrice
              );

            const amount =
              purchaseItemAmount_(
                item.amount
              );

            const duplicateText =
              purchaseItemDuplicateText_(
                item,
                source
              );

            return `
              <div class="receipt-item">

                <div class="receipt-icon">
                  <span class="material-symbols-rounded">
                    shopping_bag
                  </span>
                </div>

                <div class="receipt-main">

                  <strong class="receipt-shop">
                    ${escapeHTML(productName)}
                  </strong>

                  <div class="receipt-meta">

                    ${
                      classification
                        ? `
                          <span>
                            ${escapeHTML(classification)}
                          </span>
                        `
                        : ""
                    }

                    ${
                      category
                        ? `
                          <span>
                            ${escapeHTML(category)}
                          </span>
                        `
                        : ""
                    }

                    <span>
                      ${escapeHTML(formatShortDate(item.date))}
                    </span>

                  </div>

                  <small>
                    ${escapeHTML(shop)}
                  </small>

                  ${
                    quantity > 1 ||
                    unitPrice > 0
                      ? `
                        <small>
                          数量 ${escapeHTML(quantity)}
                          ${
                            unitPrice > 0
                              ? "・単価 " +
                                escapeHTML(
                                  yen(unitPrice)
                                )
                              : ""
                          }
                        </small>
                      `
                      : ""
                  }

                  ${
                    payer
                      ? `
                        <small>
                          支払者：
                          ${escapeHTML(payer)}
                        </small>
                      `
                      : ""
                  }

                  ${
                    duplicateText
                      ? `
                        <small
                          style="
                            color:#ff9500;
                            font-weight:700;
                          "
                        >
                          ⚠️ ${escapeHTML(duplicateText)}
                        </small>
                      `
                      : ""
                  }

                </div>

                <strong class="receipt-price">
                  ${yen(amount)}
                </strong>

              </div>
            `;
          }
        )
        .join("");
  };


// ---------------------------------------------------------
// 購入明細ページ更新
// ---------------------------------------------------------

refreshReceiptPage =
  async function() {
    const year =
      receiptDate.getFullYear();

    const month =
      receiptDate.getMonth() + 1;

    const monthLabel =
      document.getElementById(
        "receiptMonthLabel"
      );

    if (monthLabel) {
      monthLabel.textContent =
        year +
        "年" +
        month +
        "月";
    }

    await loadReceiptsFor(
      year,
      month
    );

    const filtered =
      receiptData
        .filter(
          function(item) {
            const date =
              parseDateValue(
                item.date
              );

            if (!date) {
              return false;
            }

            return (
              date.getFullYear() ===
                year &&
              date.getMonth() + 1 ===
                month
            );
          }
        )
        .sort(
          function(a, b) {
            const dateA =
              parseDateValue(
                a.date
              );

            const dateB =
              parseDateValue(
                b.date
              );

            const timeA =
              dateA
                ? dateA.getTime()
                : 0;

            const timeB =
              dateB
                ? dateB.getTime()
                : 0;

            if (
              timeA !== timeB
            ) {
              return (
                timeB -
                timeA
              );
            }

            return (
              purchaseItemAmount_(
                b.amount
              ) -
              purchaseItemAmount_(
                a.amount
              )
            );
          }
        );

    const total =
      filtered.reduce(
        function(sum, item) {
          return (
            sum +
            purchaseItemAmount_(
              item.amount
            )
          );
        },
        0
      );

    const totalTarget =
      document.getElementById(
        "receiptMonthTotal"
      );

    if (totalTarget) {
      totalTarget.textContent =
        yen(total);
    }

    const countTarget =
      document.getElementById(
        "receiptCount"
      );

    if (countTarget) {
      countTarget.textContent =
        filtered.length +
        "件";
    }

    renderReceiptList(
      document.getElementById(
        "receiptFullList"
      ),
      filtered
    );
  };


// ---------------------------------------------------------
// レシート画面の見出しを購入明細へ変更
// ---------------------------------------------------------

const updatePageHeaderBeforePurchaseFix =
  updatePageHeader;

updatePageHeader =
  function() {
    updatePageHeaderBeforePurchaseFix();

    if (
      currentPage !==
      "receipt"
    ) {
      return;
    }

    const title =
      document.getElementById(
        "pageTitle"
      );

    const kicker =
      document.getElementById(
        "pageKicker"
      );

    if (title) {
      title.textContent =
        "購入明細";
    }

    if (kicker) {
      kicker.textContent =
        "🛒 PURCHASE ITEMS";
    }
  };


// ---------------------------------------------------------
// AIアドバイス
// 家賃を判定対象から除外するが、文章には書かない
// ---------------------------------------------------------

renderAdvice =
  function() {
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
        ? dashboardData.categories.slice()
        : [];

    const top =
      categories
        .filter(
          function(category) {
            const name =
              String(
                category.name || ""
              );

            const amount =
              purchaseItemAmount_(
                category.amount
              );

            const isRent =
              name.indexOf("家賃") !== -1 ||
              name.indexOf("賃料") !== -1;

            return (
              !isRent &&
              amount > 0
            );
          }
        )
        .sort(
          function(a, b) {
            return (
              purchaseItemAmount_(
                b.amount
              ) -
              purchaseItemAmount_(
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
            purchaseItemAmount_(
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
          purchaseItemAmount_(
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
  };
// =========================================================
// 購入明細 最終表示設定
//
// 対象：
// ・スーパー
// ・ドラッグストア
// ・コンビニ
// ・食品、冷蔵庫に入れる商品、医薬品
//
// 除外：
// ・家賃
// ・外食
// ・洋服
// ・水道光熱費
// ・交通費
// ・税金
//
// 表示項目：
// ・日付
// ・店名
// ・商品名
// ・数量
// ・分類
// =========================================================


// ---------------------------------------------------------
// 文字を検索用に整える
// ---------------------------------------------------------

function purchaseSearchText_(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");
}


// ---------------------------------------------------------
// 購入明細に表示する商品か判定
// ---------------------------------------------------------

function isPurchaseManagementItem_(
  item
) {
  const shop =
    purchaseSearchText_(
      item.shop
    );

  const productName =
    purchaseSearchText_(
      item.productName ||
      item.name ||
      item.itemName
    );

  const classification =
    purchaseSearchText_(
      item.classification ||
      item.subCategory ||
      item.subcategory ||
      item.detailCategory ||
      item.normalizedName
    );

  const category =
    purchaseSearchText_(
      item.category
    );

  const text =
    [
      shop,
      productName,
      classification,
      category
    ].join("");


  // -------------------------------------------------------
  // 必ず除外するもの
  // -------------------------------------------------------

  const excludedWords = [
    "家賃",
    "賃料",
    "住宅",
    "外食",
    "ガスト",
    "サイゼリヤ",
    "サイゼ",
    "マクドナルド",
    "マック",
    "すき家",
    "松屋",
    "吉野家",
    "ケンタッキー",
    "モスバーガー",
    "レストラン",
    "食堂",
    "カフェ",
    "ドリンクバー",
    "定食",
    "ハンバーグ",
    "洋服",
    "衣類",
    "靴下",
    "ズボン",
    "上着",
    "下着",
    "シャツ",
    "カットソー",
    "スニーカー",
    "靴",
    "水道料金",
    "電気料金",
    "ガス料金",
    "税金",
    "交通費"
  ];

  for (
    let i = 0;
    i < excludedWords.length;
    i++
  ) {
    if (
      text.indexOf(
        purchaseSearchText_(
          excludedWords[i]
        )
      ) !== -1
    ) {
      return false;
    }
  }


  // -------------------------------------------------------
  // 医薬品は店名に関係なく表示
  // -------------------------------------------------------

  const medicineWords = [
    "医療",
    "医薬品",
    "薬",
    "風邪薬",
    "かぜ薬",
    "頭痛薬",
    "鎮痛剤",
    "解熱剤",
    "胃薬",
    "整腸薬",
    "便秘薬",
    "目薬",
    "点眼",
    "湿布",
    "絆創膏",
    "ばんそうこう",
    "消毒液",
    "体温計",
    "マスク",
    "花粉",
    "鼻炎",
    "のど飴",
    "ビタミン",
    "サプリメント"
  ];

  for (
    let i = 0;
    i < medicineWords.length;
    i++
  ) {
    if (
      text.indexOf(
        purchaseSearchText_(
          medicineWords[i]
        )
      ) !== -1
    ) {
      return true;
    }
  }


  // -------------------------------------------------------
  // 食品・冷蔵庫関連商品
  // -------------------------------------------------------

  const foodWords = [
    "食費",
    "食品",
    "野菜",
    "果物",
    "肉",
    "魚",
    "卵",
    "乳製品",
    "牛乳",
    "ヨーグルト",
    "チーズ",
    "バター",
    "豆腐",
    "納豆",
    "油揚げ",
    "厚揚げ",
    "ハム",
    "ベーコン",
    "ウインナー",
    "ソーセージ",
    "パン",
    "食パン",
    "米",
    "麺",
    "うどん",
    "そば",
    "ラーメン",
    "パスタ",
    "調味料",
    "醤油",
    "味噌",
    "砂糖",
    "塩",
    "酢",
    "油",
    "ソース",
    "ケチャップ",
    "マヨネーズ",
    "ドレッシング",
    "飲料",
    "お茶",
    "コーヒー",
    "ジュース",
    "お菓子",
    "冷凍食品",
    "惣菜",
    "弁当",
    "おにぎり",
    "デザート",
    "アイス",
    "プリン",
    "ゼリー"
  ];

  let isFood = false;

  for (
    let i = 0;
    i < foodWords.length;
    i++
  ) {
    if (
      text.indexOf(
        purchaseSearchText_(
          foodWords[i]
        )
      ) !== -1
    ) {
      isFood = true;
      break;
    }
  }

  if (!isFood) {
    return false;
  }


  // -------------------------------------------------------
  // 対象店舗
  // -------------------------------------------------------

  const targetStores = [
    "マルエツ",
    "イオン",
    "ライフ",
    "西友",
    "イトーヨーカドー",
    "ヨーク",
    "オーケーストア",
    "okストア",
    "業務スーパー",
    "ベルク",
    "ヤオコー",
    "サミット",
    "東武ストア",
    "まいばすけっと",
    "成城石井",
    "コープ",
    "ダイエー",
    "アコレ",
    "マツキヨ",
    "マツモトキヨシ",
    "matsukiyo",
    "matsukiyolab",
    "ウエルシア",
    "ウェルシア",
    "サンドラッグ",
    "スギ薬局",
    "ツルハ",
    "ココカラファイン",
    "クリエイト",
    "ぱぱす",
    "セブンイレブン",
    "セブン-イレブン",
    "ファミリーマート",
    "ファミマ",
    "ローソン",
    "ミニストップ",
    "デイリーヤマザキ"
  ];

  for (
    let i = 0;
    i < targetStores.length;
    i++
  ) {
    if (
      shop.indexOf(
        purchaseSearchText_(
          targetStores[i]
        )
      ) !== -1
    ) {
      return true;
    }
  }


  // 食費カテゴリなら、未登録店舗でも表示
  if (
    category.indexOf("食費") !== -1
  ) {
    return true;
  }

  return false;
}


// ---------------------------------------------------------
// 日付表示
// ---------------------------------------------------------

function simplePurchaseDate_(value) {
  const date =
    parseDateValue(
      value
    );

  if (!date) {
    return "";
  }

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

  return (
    year +
    "/" +
    month +
    "/" +
    day
  );
}


// ---------------------------------------------------------
// 表示用商品名
// ---------------------------------------------------------

function simplePurchaseName_(
  item
) {
  return String(
    item.productName ||
    item.name ||
    item.itemName ||
    "商品名未設定"
  ).trim();
}


// ---------------------------------------------------------
// 表示用分類
// ---------------------------------------------------------

function simplePurchaseClassification_(
  item
) {
  const productName =
    simplePurchaseName_(
      item
    );

  const candidates = [
    item.classification,
    item.subCategory,
    item.subcategory,
    item.detailCategory,
    item.normalizedName
  ];

  for (
    let i = 0;
    i < candidates.length;
    i++
  ) {
    const value =
      String(
        candidates[i] || ""
      ).trim();

    if (
      value &&
      purchaseSearchText_(value) !==
        purchaseSearchText_(productName)
    ) {
      return value;
    }
  }

  return "未分類";
}


// ---------------------------------------------------------
// シンプル表示用CSS
// ---------------------------------------------------------

function addSimplePurchaseStyles_() {
  if (
    document.getElementById(
      "simplePurchaseStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "simplePurchaseStyles";

  style.textContent = `
    .simple-purchase-list {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .simple-purchase-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 48px;
      gap: 12px;
      align-items: center;
      padding: 0 3px 11px;
      border-bottom: 1px solid #e6ebe7;
      color: #89918c;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .simple-purchase-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 48px;
      gap: 12px;
      align-items: center;
      padding: 16px 3px;
      border-bottom: 1px solid #edf0ee;
    }

    .simple-purchase-item:last-child {
      border-bottom: 0;
    }

    .simple-purchase-main {
      min-width: 0;
    }

    .simple-purchase-product {
      display: block;
      margin: 0 0 7px;
      color: #171a18;
      font-size: 15px;
      font-weight: 750;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .simple-purchase-details {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px 8px;
      color: #838b86;
      font-size: 11px;
      line-height: 1.5;
    }

    .simple-purchase-date {
      white-space: nowrap;
    }

    .simple-purchase-shop {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .simple-purchase-classification {
      display: inline-flex;
      align-items: center;
      min-height: 23px;
      padding: 2px 9px;
      border-radius: 999px;
      background: #edf9f0;
      color: #249a49;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.3;
    }

    .simple-purchase-quantity {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 45px;
      min-height: 45px;
      padding: 5px;
      border-radius: 13px;
      background: #f3f6f4;
      color: #202421;
    }

    .simple-purchase-quantity strong {
      font-size: 16px;
      line-height: 1.1;
    }

    .simple-purchase-quantity small {
      margin-top: 3px;
      color: #929994;
      font-size: 9px;
      font-weight: 700;
    }

    @media (max-width: 420px) {
      .simple-purchase-item {
        gap: 9px;
        padding: 14px 2px;
      }

      .simple-purchase-product {
        font-size: 14px;
      }

      .simple-purchase-details {
        font-size: 10px;
      }

      .simple-purchase-quantity {
        min-width: 42px;
        min-height: 42px;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


// ---------------------------------------------------------
// 購入明細一覧をシンプル表示
// ---------------------------------------------------------

renderReceiptList =
  function(
    container,
    receipts,
    limit
  ) {
    if (!container) {
      return;
    }

    addSimplePurchaseStyles_();

    const source =
      Array.isArray(receipts)
        ? receipts
        : [];

    const sorted =
      source
        .slice()
        .sort(
          function(a, b) {
            const dateA =
              parseDateValue(
                a.date
              );

            const dateB =
              parseDateValue(
                b.date
              );

            const timeA =
              dateA
                ? dateA.getTime()
                : 0;

            const timeB =
              dateB
                ? dateB.getTime()
                : 0;

            if (
              timeA !== timeB
            ) {
              return (
                timeB -
                timeA
              );
            }

            return String(
              a.shop || ""
            ).localeCompare(
              String(
                b.shop || ""
              ),
              "ja"
            );
          }
        );

    const items =
      limit
        ? sorted.slice(
            0,
            limit
          )
        : sorted;

    if (
      items.length === 0
    ) {
      container.innerHTML =
        createEmptyState(
          "shopping_cart",
          "購入明細はありません",
          "食品や医薬品を購入すると、ここに表示されます"
        );

      return;
    }

    container.innerHTML = `
      <div class="simple-purchase-list">

        <div class="simple-purchase-header">
          <span>購入明細</span>
          <span>数量</span>
        </div>

        ${
          items
            .map(
              function(item) {
                const productName =
                  simplePurchaseName_(
                    item
                  );

                const shop =
                  String(
                    item.shop ||
                    "店名未設定"
                  ).trim();

                const classification =
                  simplePurchaseClassification_(
                    item
                  );

                const quantity =
                  Number(
                    item.quantity || 1
                  ) || 1;

                const date =
                  simplePurchaseDate_(
                    item.date
                  );

                return `
                  <div class="simple-purchase-item">

                    <div class="simple-purchase-main">

                      <strong class="simple-purchase-product">
                        ${escapeHTML(productName)}
                      </strong>

                      <div class="simple-purchase-details">

                        <span class="simple-purchase-date">
                          ${escapeHTML(date)}
                        </span>

                        <span aria-hidden="true">
                          ・
                        </span>

                        <span class="simple-purchase-shop">
                          ${escapeHTML(shop)}
                        </span>

                        <span class="simple-purchase-classification">
                          ${escapeHTML(classification)}
                        </span>

                      </div>

                    </div>

                    <div class="simple-purchase-quantity">

                      <strong>
                        ${escapeHTML(quantity)}
                      </strong>

                      <small>
                        数量
                      </small>

                    </div>

                  </div>
                `;
              }
            )
            .join("")
        }

      </div>
    `;
  };


// ---------------------------------------------------------
// レシート表記を購入明細へ変更
// ---------------------------------------------------------

function updatePurchaseLabels_() {
  const replacements = {
    "レシート": "購入明細",
    "支出・レシート": "購入明細",
    "RECEIPTS": "PURCHASE ITEMS",
    "支出一覧": "購入明細一覧",
    "この月の支出": "この月の購入額",
    "支出はありません": "購入明細はありません",
    "登録した支出がここに表示されます":
      "食品や医薬品を購入すると、ここに表示されます"
  };

  document
    .querySelectorAll(
      "h1, h2, h3, h4, p, span, strong, small"
    )
    .forEach(
      function(element) {
        if (
          element.children.length > 0
        ) {
          return;
        }

        const current =
          String(
            element.textContent || ""
          ).trim();

        if (
          Object.prototype.hasOwnProperty.call(
            replacements,
            current
          )
        ) {
          element.textContent =
            replacements[current];
        }
      }
    );

  const pageTitle =
    document.getElementById(
      "pageTitle"
    );

  if (
    pageTitle &&
    currentPage === "receipt"
  ) {
    pageTitle.textContent =
      "購入明細";
  }

  const pageKicker =
    document.getElementById(
      "pageKicker"
    );

  if (
    pageKicker &&
    currentPage === "receipt"
  ) {
    pageKicker.textContent =
      "🛒 PURCHASE ITEMS";
  }
}


// ---------------------------------------------------------
// 購入明細ページ更新
// ---------------------------------------------------------

refreshReceiptPage =
  async function() {
    const year =
      receiptDate.getFullYear();

    const month =
      receiptDate.getMonth() + 1;

    const monthLabel =
      document.getElementById(
        "receiptMonthLabel"
      );

    if (monthLabel) {
      monthLabel.textContent =
        year +
        "年" +
        month +
        "月";
    }

    await loadReceiptsFor(
      year,
      month
    );

    const filtered =
      receiptData
        .filter(
          function(item) {
            const date =
              parseDateValue(
                item.date
              );

            if (!date) {
              return false;
            }

            const sameMonth =
              date.getFullYear() ===
                year &&
              date.getMonth() + 1 ===
                month;

            return (
              sameMonth &&
              isPurchaseManagementItem_(
                item
              )
            );
          }
        )
        .sort(
          function(a, b) {
            const dateA =
              parseDateValue(
                a.date
              );

            const dateB =
              parseDateValue(
                b.date
              );

            const timeA =
              dateA
                ? dateA.getTime()
                : 0;

            const timeB =
              dateB
                ? dateB.getTime()
                : 0;

            if (
              timeA !== timeB
            ) {
              return (
                timeB -
                timeA
              );
            }

            return String(
              a.shop || ""
            ).localeCompare(
              String(
                b.shop || ""
              ),
              "ja"
            );
          }
        );

    const total =
      filtered.reduce(
        function(sum, item) {
          return (
            sum +
            purchaseItemAmount_(
              item.amount
            )
          );
        },
        0
      );

    const totalTarget =
      document.getElementById(
        "receiptMonthTotal"
      );

    if (totalTarget) {
      totalTarget.textContent =
        yen(total);
    }

    const countTarget =
      document.getElementById(
        "receiptCount"
      );

    if (countTarget) {
      countTarget.textContent =
        filtered.length +
        "件";
    }

    renderReceiptList(
      document.getElementById(
        "receiptFullList"
      ),
      filtered
    );

    updatePurchaseLabels_();
  };
// =========================================================
// ホーム画面も購入明細の商品データを表示
// =========================================================


// 商品名が取れない場合の表示
simplePurchaseName_ =
  function(item) {
    return String(
      item.productName ||
      item.name ||
      item.itemName ||
      item.memo ||
      "商品名"
    ).trim();
  };


// 分類が取れない場合は大カテゴリを使用
simplePurchaseClassification_ =
  function(item) {
    const productName =
      simplePurchaseName_(
        item
      );

    const candidates = [
      item.classification,
      item.subCategory,
      item.subcategory,
      item.detailCategory,
      item.normalizedName,
      item.category
    ];

    for (
      let i = 0;
      i < candidates.length;
      i++
    ) {
      const value =
        String(
          candidates[i] || ""
        ).trim();

      if (
        value &&
        purchaseSearchText_(value) !==
          purchaseSearchText_(productName)
      ) {
        return value;
      }
    }

    return "分類";
  };


// 購入明細の見出しを「商品名」に変更
var renderReceiptListBeforeProductNameFix_ =
  renderReceiptList;

renderReceiptList =
  function(
    container,
    receipts,
    limit
  ) {
    renderReceiptListBeforeProductNameFix_(
      container,
      receipts,
      limit
    );

    if (!container) {
      return;
    }

    const heading =
      container.querySelector(
        ".simple-purchase-header span:first-child"
      );

    if (heading) {
      heading.textContent =
        "商品名";
    }
  };


// ホーム画面用に購入明細も取得
loadDashboard =
  async function() {
    try {
      const currentDate =
        new Date();

      const year =
        currentDate.getFullYear();

      const month =
        currentDate.getMonth() + 1;

      const results =
        await Promise.all([
          fetchJson(
            API_BASE +
            "?mode=dashboard"
          ),
          fetchJson(
            API_BASE +
            "?mode=purchaseItems" +
            "&year=" +
            encodeURIComponent(year) +
            "&month=" +
            encodeURIComponent(month)
          )
        ]);

      dashboardData =
        results[0];

      const purchaseResult =
        results[1];

      let purchaseItems = [];

      if (
        purchaseResult &&
        Array.isArray(
          purchaseResult.items
        )
      ) {
        purchaseItems =
          purchaseResult.items;
      }
      else if (
        Array.isArray(
          purchaseResult
        )
      ) {
        purchaseItems =
          purchaseResult;
      }
      else if (
        purchaseResult &&
        Array.isArray(
          purchaseResult.data
        )
      ) {
        purchaseItems =
          purchaseResult.data;
      }

      const recentPurchaseItems =
        purchaseItems
          .filter(
            function(item) {
              return (
                isPurchaseManagementItem_(
                  item
                )
              );
            }
          )
          .sort(
            function(a, b) {
              const dateA =
                parseDateValue(
                  a.date
                );

              const dateB =
                parseDateValue(
                  b.date
                );

              const timeA =
                dateA
                  ? dateA.getTime()
                  : 0;

              const timeB =
                dateB
                  ? dateB.getTime()
                  : 0;

              if (
                timeA !== timeB
              ) {
                return (
                  timeB -
                  timeA
                );
              }

              return (
                purchaseItemAmount_(
                  b.amount
                ) -
                purchaseItemAmount_(
                  a.amount
                )
              );
            }
          );

      dashboardData.recent =
        recentPurchaseItems;

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
  };
// =========================================================
// 購入明細：スマホ向け2段表示＋手動編集
// app.js の一番最後に追加してください。
// =========================================================

(function () {
  "use strict";

  let purchaseEditingItem_ = null;

  function purchaseNumber_(value) {
    const number = Number(
      String(value ?? "")
        .replace(/[^0-9.-]/g, "")
    );

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function purchaseText_(value, fallback) {
    const text = String(value ?? "").trim();

    return text || fallback || "";
  }

  function purchaseNameForEdit_(item) {
    return purchaseText_(
      item.productName ||
      item.name ||
      item.itemName ||
      item.memo,
      "商品名"
    );
  }

  function purchaseClassForEdit_(item) {
    return purchaseText_(
      item.classification ||
      item.subCategory ||
      item.subcategory ||
      item.detailCategory ||
      item.normalizedName ||
      item.category,
      "分類"
    );
  }

  function purchaseDateCompact_(value) {
    const date =
      typeof parseDateValue === "function"
        ? parseDateValue(value)
        : new Date(value);

    if (
      !date ||
      Number.isNaN(date.getTime())
    ) {
      return "";
    }

    return (
      (date.getMonth() + 1) +
      "/" +
      date.getDate()
    );
  }

  function purchaseUnitPrice_(item) {
    const saved =
      purchaseNumber_(
        item.unitPrice
      );

    if (saved > 0) {
      return Math.round(saved);
    }

    const quantity =
      Math.max(
        1,
        purchaseNumber_(
          item.quantity
        ) || 1
      );

    const amount =
      purchaseNumber_(
        item.amount
      );

    return amount > 0
      ? Math.round(
          amount / quantity
        )
      : 0;
  }

  function purchaseYenCompact_(value) {
    const amount =
      purchaseNumber_(value);

    return amount > 0
      ? "¥" +
          Math.round(amount)
            .toLocaleString("ja-JP")
      : "単価なし";
  }

  function addPurchaseMobileStyles_() {
    if (
      document.getElementById(
        "purchaseMobileEditStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "purchaseMobileEditStyles";

    style.textContent = `
      .purchase-compact-list {
        display: flex;
        flex-direction: column;
        width: 100%;
        overflow: hidden;
      }

      .purchase-compact-head {
        padding: 0 2px 9px;
        border-bottom: 1px solid #e7ebe8;
        color: #8a918d;
        font-size: 10px;
        font-weight: 750;
        letter-spacing: 0.05em;
      }

      .purchase-compact-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-rows: auto auto;
        column-gap: 8px;
        row-gap: 5px;
        align-items: center;
        min-width: 0;
        padding: 12px 2px;
        border-bottom: 1px solid #edf0ee;
      }

      .purchase-compact-item:last-child {
        border-bottom: 0;
      }

      .purchase-compact-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #171a18;
        font-size: 14px;
        font-weight: 760;
        line-height: 1.35;
      }

      .purchase-compact-actions {
        display: flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
      }

      .purchase-compact-price {
        color: #188b40;
        font-size: 12px;
        font-weight: 800;
      }

      .purchase-compact-edit {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: 9px;
        background: #f2f5f3;
        color: #59625d;
        cursor: pointer;
      }

      .purchase-compact-edit
      .material-symbols-rounded {
        font-size: 17px;
      }

      .purchase-compact-meta {
        display: flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
        overflow: hidden;
        color: #858c88;
        font-size: 10px;
        line-height: 1.25;
        white-space: nowrap;
      }

      .purchase-compact-date {
        flex: 0 0 auto;
      }

      .purchase-compact-shop {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .purchase-compact-class {
        flex: 0 1 auto;
        max-width: 34%;
        overflow: hidden;
        padding: 2px 7px;
        border-radius: 999px;
        background: #edf9f0;
        color: #249a49;
        font-weight: 700;
        text-overflow: ellipsis;
      }

      .purchase-compact-quantity {
        justify-self: end;
        color: #555e59;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
      }

      .purchase-manual-mark {
        color: #249a49;
        font-size: 9px;
      }

      .purchase-edit-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9998;
        display: none;
        background: rgba(20, 25, 22, 0.34);
      }

      .purchase-edit-backdrop.is-open {
        display: block;
      }

      .purchase-edit-sheet {
        position: fixed;
        left: 50%;
        bottom: 0;
        z-index: 9999;
        width: min(100%, 480px);
        max-height: 88vh;
        overflow: auto;
        transform: translate(-50%, 105%);
        transition: transform 0.2s ease;
        padding:
          10px
          16px
          calc(16px + env(safe-area-inset-bottom));
        border-radius: 22px 22px 0 0;
        background: #ffffff;
        box-shadow:
          0 -10px 40px
          rgba(0, 0, 0, 0.16);
      }

      .purchase-edit-sheet.is-open {
        transform: translate(-50%, 0);
      }

      .purchase-edit-handle {
        width: 38px;
        height: 4px;
        margin: 0 auto 10px;
        border-radius: 9px;
        background: #d9ddda;
      }

      .purchase-edit-title {
        margin: 0 0 12px;
        color: #171a18;
        font-size: 16px;
        font-weight: 800;
      }

      .purchase-edit-grid {
        display: grid;
        grid-template-columns: 1fr 88px;
        gap: 9px;
      }

      .purchase-edit-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .purchase-edit-field.is-wide {
        grid-column: 1 / -1;
      }

      .purchase-edit-field label {
        color: #78807b;
        font-size: 10px;
        font-weight: 700;
      }

      .purchase-edit-field input {
        box-sizing: border-box;
        width: 100%;
        height: 39px;
        padding: 0 11px;
        border: 1px solid #dfe5e1;
        border-radius: 10px;
        outline: none;
        background: #fafcfb;
        color: #171a18;
        font-size: 14px;
      }

      .purchase-edit-field input:focus {
        border-color: #36b65f;
        box-shadow:
          0 0 0 3px
          rgba(54, 182, 95, 0.10);
      }

      .purchase-edit-total {
        grid-column: 1 / -1;
        margin-top: 1px;
        color: #77807a;
        font-size: 11px;
        text-align: right;
      }

      .purchase-edit-buttons {
        display: grid;
        grid-template-columns: 1fr 1.6fr;
        gap: 9px;
        margin-top: 13px;
      }

      .purchase-edit-buttons button {
        height: 42px;
        border: 0;
        border-radius: 11px;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
      }

      .purchase-edit-cancel {
        background: #f1f4f2;
        color: #646d68;
      }

      .purchase-edit-save {
        background: #2db857;
        color: #ffffff;
      }

      .purchase-edit-save:disabled {
        opacity: 0.55;
      }

      body.purchase-edit-lock {
        overflow: hidden;
      }
    `;

    document.head.appendChild(style);
  }

  function ensurePurchaseEditSheet_() {
    addPurchaseMobileStyles_();

    if (
      document.getElementById(
        "purchaseEditSheet"
      )
    ) {
      return;
    }

    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div
          class="purchase-edit-backdrop"
          id="purchaseEditBackdrop">
        </div>

        <section
          class="purchase-edit-sheet"
          id="purchaseEditSheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchaseEditTitle">

          <div class="purchase-edit-handle">
          </div>

          <h3
            class="purchase-edit-title"
            id="purchaseEditTitle">
            購入明細を編集
          </h3>

          <div class="purchase-edit-grid">

            <div class="purchase-edit-field is-wide">
              <label for="purchaseEditName">
                商品名
              </label>
              <input
                id="purchaseEditName"
                autocomplete="off">
            </div>

            <div class="purchase-edit-field is-wide">
              <label for="purchaseEditShop">
                店名
              </label>
              <input
                id="purchaseEditShop"
                autocomplete="off">
            </div>

            <div class="purchase-edit-field">
              <label for="purchaseEditClass">
                分類
              </label>
              <input
                id="purchaseEditClass"
                autocomplete="off">
            </div>

            <div class="purchase-edit-field">
              <label for="purchaseEditQuantity">
                数量
              </label>
              <input
                id="purchaseEditQuantity"
                type="number"
                min="0.01"
                step="0.01"
                inputmode="decimal">
            </div>

            <div class="purchase-edit-field is-wide">
              <label for="purchaseEditUnitPrice">
                単価（円）
              </label>
              <input
                id="purchaseEditUnitPrice"
                type="number"
                min="0"
                step="1"
                inputmode="numeric">
            </div>

            <div
              class="purchase-edit-total"
              id="purchaseEditTotal">
              合計 ¥0
            </div>

          </div>

          <div class="purchase-edit-buttons">

            <button
              type="button"
              class="purchase-edit-cancel"
              id="purchaseEditCancel">
              キャンセル
            </button>

            <button
              type="button"
              class="purchase-edit-save"
              id="purchaseEditSave">
              保存
            </button>

          </div>

        </section>
      `
    );

    document
      .getElementById(
        "purchaseEditBackdrop"
      )
      .addEventListener(
        "click",
        closePurchaseEditor_
      );

    document
      .getElementById(
        "purchaseEditCancel"
      )
      .addEventListener(
        "click",
        closePurchaseEditor_
      );

    document
      .getElementById(
        "purchaseEditSave"
      )
      .addEventListener(
        "click",
        savePurchaseEditor_
      );

    document
      .getElementById(
        "purchaseEditQuantity"
      )
      .addEventListener(
        "input",
        updatePurchaseEditTotal_
      );

    document
      .getElementById(
        "purchaseEditUnitPrice"
      )
      .addEventListener(
        "input",
        updatePurchaseEditTotal_
      );
  }

  function updatePurchaseEditTotal_() {
    const quantity =
      purchaseNumber_(
        document
          .getElementById(
            "purchaseEditQuantity"
          )
          .value
      );

    const unitPrice =
      purchaseNumber_(
        document
          .getElementById(
            "purchaseEditUnitPrice"
          )
          .value
      );

    document
      .getElementById(
        "purchaseEditTotal"
      )
      .textContent =
        "合計 " +
        purchaseYenCompact_(
          Math.round(
            quantity * unitPrice
          )
        );
  }

  function openPurchaseEditor_(item) {
    ensurePurchaseEditSheet_();

    if (
      !Number.isInteger(
        Number(item.row)
      ) ||
      Number(item.row) < 2
    ) {
      if (
        typeof showToast === "function"
      ) {
        showToast(
          "この明細は行番号を取得できないため編集できません"
        );
      }

      return;
    }

    purchaseEditingItem_ = item;

    document
      .getElementById(
        "purchaseEditName"
      )
      .value =
        purchaseNameForEdit_(item);

    document
      .getElementById(
        "purchaseEditShop"
      )
      .value =
        purchaseText_(
          item.shop,
          ""
        );

    document
      .getElementById(
        "purchaseEditClass"
      )
      .value =
        purchaseClassForEdit_(item);

    document
      .getElementById(
        "purchaseEditQuantity"
      )
      .value =
        purchaseNumber_(
          item.quantity
        ) || 1;

    document
      .getElementById(
        "purchaseEditUnitPrice"
      )
      .value =
        purchaseUnitPrice_(item) || "";

    updatePurchaseEditTotal_();

    document
      .getElementById(
        "purchaseEditBackdrop"
      )
      .classList.add(
        "is-open"
      );

    document
      .getElementById(
        "purchaseEditSheet"
      )
      .classList.add(
        "is-open"
      );

    document.body.classList.add(
      "purchase-edit-lock"
    );

    setTimeout(
      function() {
        document
          .getElementById(
            "purchaseEditName"
          )
          .focus();
      },
      220
    );
  }

  function closePurchaseEditor_() {
    const backdrop =
      document.getElementById(
        "purchaseEditBackdrop"
      );

    const sheet =
      document.getElementById(
        "purchaseEditSheet"
      );

    if (backdrop) {
      backdrop.classList.remove(
        "is-open"
      );
    }

    if (sheet) {
      sheet.classList.remove(
        "is-open"
      );
    }

    document.body.classList.remove(
      "purchase-edit-lock"
    );

    purchaseEditingItem_ = null;
  }

  async function savePurchaseEditor_() {
    if (!purchaseEditingItem_) {
      return;
    }

    const productName =
      purchaseText_(
        document
          .getElementById(
            "purchaseEditName"
          )
          .value
      );

    const shop =
      purchaseText_(
        document
          .getElementById(
            "purchaseEditShop"
          )
          .value
      );

    const normalizedName =
      purchaseText_(
        document
          .getElementById(
            "purchaseEditClass"
          )
          .value
      );

    const quantity =
      purchaseNumber_(
        document
          .getElementById(
            "purchaseEditQuantity"
          )
          .value
      );

    const unitPrice =
      purchaseNumber_(
        document
          .getElementById(
            "purchaseEditUnitPrice"
          )
          .value
      );

    if (
      !productName ||
      !shop ||
      !normalizedName ||
      quantity <= 0 ||
      unitPrice < 0
    ) {
      if (
        typeof showToast === "function"
      ) {
        showToast(
          "商品名・店名・分類・数量を確認してください"
        );
      }

      return;
    }

    const saveButton =
      document.getElementById(
        "purchaseEditSave"
      );

    saveButton.disabled = true;
    saveButton.textContent =
      "保存中…";

    try {
      const response =
        await fetch(
          API_BASE,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
              action:
                "updatePurchaseItem",
              row:
                Number(
                  purchaseEditingItem_.row
                ),
              shop:
                shop,
              productName:
                productName,
              normalizedName:
                normalizedName,
              quantity:
                quantity,
              unitPrice:
                unitPrice,
              amount:
                Math.round(
                  quantity *
                  unitPrice
                )
            })
          }
        );

      if (!response.ok) {
        throw new Error(
          "HTTP " +
          response.status
        );
      }

      const result =
        await response.json();

      if (
        !result ||
        result.success !== true
      ) {
        throw new Error(
          result?.error ||
          "保存できませんでした"
        );
      }

      closePurchaseEditor_();

      if (
        typeof showToast === "function"
      ) {
        showToast(
          "購入明細を修正しました"
        );
      }

      if (
        typeof refreshReceiptPage ===
        "function"
      ) {
        await refreshReceiptPage();
      }

      if (
        typeof loadDashboard ===
        "function"
      ) {
        loadDashboard();
      }
    }
    catch (error) {
      console.error(
        "Purchase item update error:",
        error
      );

      if (
        typeof showToast === "function"
      ) {
        showToast(
          "保存できませんでした：" +
          (
            error.message ||
            error
          )
        );
      }
    }
    finally {
      saveButton.disabled = false;
      saveButton.textContent =
        "保存";
    }
  }

  // ---------------------------------------------------------
  // 購入明細一覧をスマホ向け2段表示に変更
  // ---------------------------------------------------------

  renderReceiptList =
    function(
      container,
      receipts,
      limit
    ) {
      if (!container) {
        return;
      }

      ensurePurchaseEditSheet_();

      const source =
        Array.isArray(receipts)
          ? receipts.slice()
          : [];

      source.sort(
        function(a, b) {
          const dateA =
            typeof parseDateValue ===
            "function"
              ? parseDateValue(a.date)
              : new Date(a.date);

          const dateB =
            typeof parseDateValue ===
            "function"
              ? parseDateValue(b.date)
              : new Date(b.date);

          const timeA =
            dateA &&
            typeof dateA.getTime ===
              "function"
              ? dateA.getTime()
              : 0;

          const timeB =
            dateB &&
            typeof dateB.getTime ===
              "function"
              ? dateB.getTime()
              : 0;

          return timeB - timeA;
        }
      );

      const items =
        limit
          ? source.slice(
              0,
              limit
            )
          : source;

      if (!items.length) {
        container.innerHTML =
          typeof createEmptyState ===
          "function"
            ? createEmptyState(
                "shopping_cart",
                "購入明細はありません",
                "食品や医薬品を購入すると、ここに表示されます"
              )
            : "<p>購入明細はありません</p>";

        return;
      }

      container.innerHTML = `
        <div class="purchase-compact-list">

          <div class="purchase-compact-head">
            商品名・単価
          </div>

          ${
            items
              .map(
                function(item, index) {
                  const name =
                    purchaseNameForEdit_(
                      item
                    );

                  const shop =
                    purchaseText_(
                      item.shop,
                      "店名"
                    );

                  const classification =
                    purchaseClassForEdit_(
                      item
                    );

                  const quantity =
                    purchaseNumber_(
                      item.quantity
                    ) || 1;

                  const unitPrice =
                    purchaseUnitPrice_(
                      item
                    );

                  const manualMark =
                    item.manualCorrection
                      ? `
                        <span class="purchase-manual-mark">
                          修正済
                        </span>
                      `
                      : "";

                  return `
                    <article class="purchase-compact-item">

                      <strong
                        class="purchase-compact-name"
                        title="${escapeHTML(name)}">
                        ${escapeHTML(name)}
                      </strong>

                      <div class="purchase-compact-actions">

                        <span class="purchase-compact-price">
                          ${
                            escapeHTML(
                              purchaseYenCompact_(
                                unitPrice
                              )
                            )
                          }/個
                        </span>

                        <button
                          type="button"
                          class="purchase-compact-edit"
                          data-purchase-index="${index}"
                          aria-label="${escapeHTML(name)}を編集">

                          <span class="material-symbols-rounded">
                            edit
                          </span>

                        </button>

                      </div>

                      <div class="purchase-compact-meta">

                        <span class="purchase-compact-date">
                          ${
                            escapeHTML(
                              purchaseDateCompact_(
                                item.date
                              )
                            )
                          }
                        </span>

                        <span
                          class="purchase-compact-shop"
                          title="${escapeHTML(shop)}">
                          ${escapeHTML(shop)}
                        </span>

                        <span
                          class="purchase-compact-class"
                          title="${escapeHTML(classification)}">
                          ${escapeHTML(classification)}
                        </span>

                        ${manualMark}

                      </div>

                      <span class="purchase-compact-quantity">
                        ×${escapeHTML(quantity)}
                      </span>

                    </article>
                  `;
                }
              )
              .join("")
          }

        </div>
      `;

      container
        .querySelectorAll(
          "[data-purchase-index]"
        )
        .forEach(
          function(button) {
            button.addEventListener(
              "click",
              function() {
                openPurchaseEditor_(
                  items[
                    Number(
                      button.dataset
                        .purchaseIndex
                    )
                  ]
                );
              }
            );
          }
        );
    };
})();
// =========================================================
// レポート：カテゴリ別購入履歴＋共通データ編集
// app.js の一番最後に追加してください。
// =========================================================

(function () {
  "use strict";

  let reportPurchaseItems_ = [];
  let reportSelectedCategory_ = "";
  let reportEditingItem_ = null;
  let reportLoadSerial_ = 0;

  const originalRenderReport_ =
    renderReport;

  const originalRenderCategoryList_ =
    renderCategoryList;

  function rpText_(value, fallback) {
    const text =
      String(value ?? "").trim();

    return text || fallback || "";
  }

  function rpNumber_(value) {
    const number =
      Number(
        String(value ?? "")
          .replace(
            /[^0-9.-]/g,
            ""
          )
      );

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function rpCategoryKey_(value) {
    return rpText_(
      value,
      "その他"
    )
      .normalize("NFKC")
      .replace(
        /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu,
        ""
      )
      .replace(/\s+/g, "")
      .replace(/費$/g, "")
      .toLowerCase();
  }

  function rpCategoryName_(item) {
    const raw =
      rpText_(
        item.category,
        "その他"
      );

    const key =
      rpCategoryKey_(raw);

    if (
      key.includes("外食")
    ) {
      return "🍽 外食";
    }

    if (
      key.includes("日用品") ||
      key.includes("生活用品")
    ) {
      return "🧻 日用品";
    }

    if (
      key.includes("医療") ||
      key.includes("医薬")
    ) {
      return "🏥 医療";
    }

    if (
      key.includes("食")
    ) {
      return "🍎 食費";
    }

    return raw === "その他"
      ? "🧾 その他"
      : raw;
  }

  function rpProductName_(item) {
    return rpText_(
      item.productName ||
      item.name ||
      item.itemName ||
      item.memo,
      "商品名"
    );
  }

  function rpClassification_(item) {
    return rpText_(
      item.classification ||
      item.normalizedName ||
      item.subCategory ||
      item.subcategory,
      "未分類"
    );
  }

  function rpUnitPrice_(item) {
    const unitPrice =
      rpNumber_(
        item.unitPrice
      );

    if (unitPrice > 0) {
      return Math.round(
        unitPrice
      );
    }

    const quantity =
      Math.max(
        1,
        rpNumber_(
          item.quantity
        ) || 1
      );

    return Math.round(
      rpNumber_(
        item.amount
      ) / quantity
    );
  }

  function rpDate_(value) {
    const date =
      typeof parseDateValue ===
      "function"
        ? parseDateValue(value)
        : new Date(value);

    if (
      !date ||
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return (
      date.getFullYear() +
      "/" +
      String(
        date.getMonth() + 1
      ).padStart(
        2,
        "0"
      ) +
      "/" +
      String(
        date.getDate()
      ).padStart(
        2,
        "0"
      )
    );
  }

  function rpYen_(value) {
    return (
      "¥" +
      Math.round(
        rpNumber_(value)
      ).toLocaleString(
        "ja-JP"
      )
    );
  }

  function addReportPurchaseStyles_() {
    if (
      document.getElementById(
        "reportPurchaseHistoryStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "reportPurchaseHistoryStyles";

    style.textContent = `
      .category-item.is-report-link {
        cursor: pointer;
        border-radius: 12px;
        transition: background 0.15s ease;
      }

      .category-item.is-report-link:active {
        background: #f3f7f4;
      }

      .category-item.is-report-link
      .category-top::after {
        content: "›";
        margin-left: 7px;
        color: #2db857;
        font-size: 18px;
        font-weight: 800;
      }

      .report-purchase-intro {
        margin: 0 0 12px;
        color: #7e8781;
        font-size: 11px;
        line-height: 1.5;
      }

      .report-history-group {
        margin-bottom: 10px;
        overflow: hidden;
        border: 1px solid #e8ede9;
        border-radius: 16px;
        background: #ffffff;
      }

      .report-history-summary {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          auto
          auto;
        gap: 8px;
        align-items: center;
        width: 100%;
        padding: 13px 14px;
        border: 0;
        background: #ffffff;
        color: #171a18;
        text-align: left;
        cursor: pointer;
      }

      .report-history-title {
        min-width: 0;
        overflow: hidden;
        font-size: 14px;
        font-weight: 800;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .report-history-total {
        color: #188b40;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
      }

      .report-history-count {
        color: #8a928d;
        font-size: 10px;
        white-space: nowrap;
      }

      .report-history-chevron {
        display: inline-block;
        margin-left: 4px;
        transition: transform 0.18s ease;
      }

      .report-history-group.is-open
      .report-history-chevron {
        transform: rotate(90deg);
      }

      .report-history-body {
        display: none;
        padding: 0 12px;
        border-top: 1px solid #edf0ee;
      }

      .report-history-group.is-open
      .report-history-body {
        display: block;
      }

      .report-history-item {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          auto;
        grid-template-rows:
          auto
          auto;
        gap: 4px 7px;
        align-items: center;
        min-width: 0;
        padding: 11px 0;
        border-bottom: 1px solid #eef1ef;
      }

      .report-history-item:last-child {
        border-bottom: 0;
      }

      .report-history-name {
        min-width: 0;
        overflow: hidden;
        color: #202421;
        font-size: 13px;
        font-weight: 760;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .report-history-actions {
        display: flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
      }

      .report-history-price {
        color: #188b40;
        font-size: 11px;
        font-weight: 800;
      }

      .report-history-quantity {
        color: #606862;
        font-size: 10px;
        font-weight: 800;
      }

      .report-history-edit {
        display: grid;
        place-items: center;
        width: 27px;
        height: 27px;
        padding: 0;
        border: 0;
        border-radius: 8px;
        background: #f1f5f2;
        color: #5c655f;
        cursor: pointer;
      }

      .report-history-edit
      .material-symbols-rounded {
        font-size: 16px;
      }

      .report-history-meta {
        display: flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
        overflow: hidden;
        color: #89908c;
        font-size: 9px;
        white-space: nowrap;
      }

      .report-history-shop {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .report-history-class {
        flex: 0 1 auto;
        max-width: 38%;
        overflow: hidden;
        padding: 2px 6px;
        border-radius: 999px;
        background: #edf9f0;
        color: #249a49;
        font-weight: 700;
        text-overflow: ellipsis;
      }

      .report-history-corrected {
        color: #249a49;
        font-size: 8px;
      }

      .report-history-empty {
        padding: 25px 10px;
        color: #89908c;
        font-size: 12px;
        text-align: center;
      }

      .rp-edit-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10008;
        display: none;
        background:
          rgba(
            20,
            25,
            22,
            0.34
          );
      }

      .rp-edit-backdrop.is-open {
        display: block;
      }

      .rp-edit-sheet {
        position: fixed;
        left: 50%;
        bottom: 0;
        z-index: 10009;
        box-sizing: border-box;
        width: min(100%, 480px);
        max-height: 90vh;
        overflow: auto;
        transform:
          translate(
            -50%,
            105%
          );
        transition:
          transform
          0.2s ease;
        padding:
          10px
          15px
          calc(
            15px +
            env(safe-area-inset-bottom)
          );
        border-radius:
          22px
          22px
          0
          0;
        background: #ffffff;
        box-shadow:
          0 -10px 40px
          rgba(
            0,
            0,
            0,
            0.16
          );
      }

      .rp-edit-sheet.is-open {
        transform:
          translate(
            -50%,
            0
          );
      }

      .rp-edit-handle {
        width: 38px;
        height: 4px;
        margin: 0 auto 9px;
        border-radius: 9px;
        background: #d9ddda;
      }

      .rp-edit-title {
        margin: 0 0 11px;
        font-size: 16px;
        font-weight: 800;
      }

      .rp-edit-grid {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          82px;
        gap: 8px;
      }

      .rp-edit-field {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }

      .rp-edit-wide {
        grid-column:
          1 /
          -1;
      }

      .rp-edit-field label {
        color: #7c847f;
        font-size: 9px;
        font-weight: 700;
      }

      .rp-edit-field input,
      .rp-edit-field select {
        box-sizing: border-box;
        width: 100%;
        height: 38px;
        padding: 0 10px;
        border: 1px solid #dfe5e1;
        border-radius: 10px;
        outline: none;
        background: #fafcfb;
        color: #171a18;
        font-size: 13px;
      }

      .rp-edit-total {
        grid-column:
          1 /
          -1;
        color: #707a73;
        font-size: 10px;
        text-align: right;
      }

      .rp-edit-buttons {
        display: grid;
        grid-template-columns:
          1fr
          1.6fr;
        gap: 8px;
        margin-top: 12px;
      }

      .rp-edit-buttons button {
        height: 41px;
        border: 0;
        border-radius: 11px;
        font-size: 12px;
        font-weight: 800;
      }

      .rp-edit-cancel {
        background: #f1f4f2;
        color: #646d68;
      }

      .rp-edit-save {
        background: #2db857;
        color: #ffffff;
      }

      .rp-edit-save:disabled {
        opacity: 0.55;
      }

      body.rp-edit-lock {
        overflow: hidden;
      }
    `;

    document.head.appendChild(
      style
    );
  }

  async function fetchAllPurchaseItems_() {
    const result =
      await fetchJson(
        API_BASE +
        "?mode=purchaseItems"
      );

    if (
      result &&
      Array.isArray(
        result.items
      )
    ) {
      return result.items;
    }

    if (
      Array.isArray(result)
    ) {
      return result;
    }

    if (
      result &&
      Array.isArray(
        result.data
      )
    ) {
      return result.data;
    }

    return [];
  }

  function groupedPurchaseItems_() {
    const groups =
      new Map();

    reportPurchaseItems_
      .forEach(
        function(item) {
          const name =
            rpCategoryName_(
              item
            );

          const key =
            rpCategoryKey_(
              name
            );

          if (
            !groups.has(key)
          ) {
            groups.set(
              key,
              {
                key:
                  key,
                name:
                  name,
                items:
                  [],
                total:
                  0
              }
            );
          }

          const group =
            groups.get(key);

          group.items.push(
            item
          );

          group.total +=
            rpNumber_(
              item.amount
            ) ||
            (
              rpUnitPrice_(item) *
              (
                rpNumber_(
                  item.quantity
                ) || 1
              )
            );
        }
      );

    return [
      ...groups.values()
    ]
      .map(
        function(group) {
          group.items.sort(
            function(a, b) {
              const dateA =
                typeof parseDateValue ===
                "function"
                  ? parseDateValue(
                      a.date
                    )
                  : new Date(
                      a.date
                    );

              const dateB =
                typeof parseDateValue ===
                "function"
                  ? parseDateValue(
                      b.date
                    )
                  : new Date(
                      b.date
                    );

              const timeA =
                dateA &&
                typeof dateA.getTime ===
                  "function"
                  ? dateA.getTime()
                  : 0;

              const timeB =
                dateB &&
                typeof dateB.getTime ===
                  "function"
                  ? dateB.getTime()
                  : 0;

              return (
                timeB -
                timeA
              );
            }
          );

          return group;
        }
      )
      .sort(
        function(a, b) {
          return (
            b.total -
            a.total
          );
        }
      );
  }

  function renderReportPurchaseHistory_() {
    const container =
      el(
        "reportCategoryList"
      );

    if (!container) {
      return;
    }

    const groups =
      groupedPurchaseItems_();

    if (
      !groups.length
    ) {
      container.innerHTML = `
        <div class="report-history-empty">
          購入履歴はまだありません
        </div>
      `;

      return;
    }

    container.innerHTML = `
      <p class="report-purchase-intro">
        カテゴリを押すと、これまで購入した商品を確認できます。
      </p>

      ${
        groups
          .map(
            function(group) {
              const open =
                reportSelectedCategory_ &&
                rpCategoryKey_(
                  reportSelectedCategory_
                ) ===
                group.key;

              return `
                <section
                  class="
                    report-history-group
                    ${open ? "is-open" : ""}
                  "
                  data-report-group="${escapeHTML(group.key)}">

                  <button
                    type="button"
                    class="report-history-summary"
                    data-report-toggle="${escapeHTML(group.key)}">

                    <span class="report-history-title">
                      ${escapeHTML(group.name)}
                    </span>

                    <span class="report-history-total">
                      ${escapeHTML(rpYen_(group.total))}
                    </span>

                    <span class="report-history-count">
                      ${group.items.length}件
                      <span class="report-history-chevron">
                        ›
                      </span>
                    </span>

                  </button>

                  <div class="report-history-body">

                    ${
                      group.items
                        .map(
                          function(item) {
                            const quantity =
                              rpNumber_(
                                item.quantity
                              ) || 1;

                            return `
                              <article class="report-history-item">

                                <strong
                                  class="report-history-name"
                                  title="${escapeHTML(rpProductName_(item))}">
                                  ${escapeHTML(rpProductName_(item))}
                                </strong>

                                <div class="report-history-actions">

                                  <span class="report-history-price">
                                    ${escapeHTML(rpYen_(rpUnitPrice_(item)))}/個
                                  </span>

                                  <span class="report-history-quantity">
                                    ×${escapeHTML(quantity)}
                                  </span>

                                  <button
                                    type="button"
                                    class="report-history-edit"
                                    data-report-edit-row="${escapeHTML(item.row)}"
                                    aria-label="編集">

                                    <span class="material-symbols-rounded">
                                      edit
                                    </span>

                                  </button>

                                </div>

                                <div class="report-history-meta">

                                  <span>
                                    ${escapeHTML(rpDate_(item.date))}
                                  </span>

                                  <span
                                    class="report-history-shop"
                                    title="${escapeHTML(rpText_(item.shop, "店名"))}">
                                    ${escapeHTML(rpText_(item.shop, "店名"))}
                                  </span>

                                  <span class="report-history-class">
                                    ${escapeHTML(rpClassification_(item))}
                                  </span>

                                  ${
                                    item.manualCorrection
                                      ? `
                                        <span class="report-history-corrected">
                                          修正済
                                        </span>
                                      `
                                      : ""
                                  }

                                </div>

                              </article>
                            `;
                          }
                        )
                        .join("")
                    }

                  </div>

                </section>
              `;
            }
          )
          .join("")
      }
    `;

    container
      .querySelectorAll(
        "[data-report-toggle]"
      )
      .forEach(
        function(button) {
          button.addEventListener(
            "click",
            function() {
              const group =
                button.closest(
                  ".report-history-group"
                );

              const willOpen =
                !group.classList.contains(
                  "is-open"
                );

              container
                .querySelectorAll(
                  ".report-history-group"
                )
                .forEach(
                  function(node) {
                    node.classList.remove(
                      "is-open"
                    );
                  }
                );

              if (willOpen) {
                group.classList.add(
                  "is-open"
                );

                reportSelectedCategory_ =
                  button.dataset
                    .reportToggle;
              }
              else {
                reportSelectedCategory_ =
                  "";
              }
            }
          );
        }
      );

    container
      .querySelectorAll(
        "[data-report-edit-row]"
      )
      .forEach(
        function(button) {
          button.addEventListener(
            "click",
            function() {
              const row =
                Number(
                  button.dataset
                    .reportEditRow
                );

              const item =
                reportPurchaseItems_
                  .find(
                    function(entry) {
                      return (
                        Number(
                          entry.row
                        ) === row
                      );
                    }
                  );

              if (item) {
                openReportPurchaseEditor_(
                  item
                );
              }
            }
          );
        }
      );
  }

  async function loadReportPurchaseHistory_() {
    const serial =
      ++reportLoadSerial_;

    const container =
      el(
        "reportCategoryList"
      );

    if (container) {
      container.innerHTML = `
        <div class="report-history-empty">
          購入履歴を読み込んでいます…
        </div>
      `;
    }

    try {
      const items =
        await fetchAllPurchaseItems_();

      if (
        serial !==
        reportLoadSerial_
      ) {
        return;
      }

      reportPurchaseItems_ =
        items;

      renderReportPurchaseHistory_();
    }
    catch (error) {
      console.error(
        "Report purchase history error:",
        error
      );

      if (container) {
        container.innerHTML = `
          <div class="report-history-empty">
            購入履歴を取得できませんでした
          </div>
        `;
      }
    }
  }

  renderReport =
    function() {
      originalRenderReport_();

      addReportPurchaseStyles_();

      loadReportPurchaseHistory_();
    };

  renderCategoryList =
    function(
      container,
      categories
    ) {
      originalRenderCategoryList_(
        container,
        categories
      );

      if (
        !container ||
        container.id !==
          "categoryList"
      ) {
        return;
      }

      container
        .querySelectorAll(
          ".category-item"
        )
        .forEach(
          function(node) {
            const label =
              node
                .querySelector(
                  ".category-name"
                )
                ?.textContent ||
              "";

            node.classList.add(
              "is-report-link"
            );

            node.setAttribute(
              "role",
              "button"
            );

            node.setAttribute(
              "tabindex",
              "0"
            );

            node.dataset
              .reportCategory =
                label;
          }
        );
    };

  document.addEventListener(
    "click",
    function(event) {
      const row =
        event.target.closest(
          "#categoryList .category-item[data-report-category]"
        );

      if (!row) {
        return;
      }

      reportSelectedCategory_ =
        row.dataset
          .reportCategory ||
        "";

      switchPage(
        "report"
      );
    }
  );

  document.addEventListener(
    "keydown",
    function(event) {
      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }

      const row =
        event.target.closest(
          "#categoryList .category-item[data-report-category]"
        );

      if (!row) {
        return;
      }

      event.preventDefault();

      reportSelectedCategory_ =
        row.dataset
          .reportCategory ||
        "";

      switchPage(
        "report"
      );
    }
  );

  function ensureReportPurchaseEditor_() {
    addReportPurchaseStyles_();

    if (
      document.getElementById(
        "rpEditSheet"
      )
    ) {
      return;
    }

    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div
          class="rp-edit-backdrop"
          id="rpEditBackdrop">
        </div>

        <section
          class="rp-edit-sheet"
          id="rpEditSheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rpEditTitle">

          <div class="rp-edit-handle">
          </div>

          <h3
            class="rp-edit-title"
            id="rpEditTitle">
            購入履歴を編集
          </h3>

          <div class="rp-edit-grid">

            <div class="rp-edit-field rp-edit-wide">
              <label for="rpEditName">
                商品名
              </label>
              <input
                id="rpEditName"
                autocomplete="off">
            </div>

            <div class="rp-edit-field rp-edit-wide">
              <label for="rpEditShop">
                店名
              </label>
              <input
                id="rpEditShop"
                autocomplete="off">
            </div>

            <div class="rp-edit-field">
              <label for="rpEditDate">
                購入日
              </label>
              <input
                id="rpEditDate"
                type="date">
            </div>

            <div class="rp-edit-field">
              <label for="rpEditQuantity">
                数量
              </label>
              <input
                id="rpEditQuantity"
                type="number"
                min="0.01"
                step="0.01"
                inputmode="decimal">
            </div>

            <div class="rp-edit-field rp-edit-wide">
              <label for="rpEditClass">
                分類
              </label>
              <input
                id="rpEditClass"
                autocomplete="off">
            </div>

            <div class="rp-edit-field">
              <label for="rpEditCategory">
                大カテゴリ
              </label>

              <select id="rpEditCategory">
                <option value="🍎 食費">
                  食費
                </option>
                <option value="🧻 日用品">
                  日用品
                </option>
                <option value="🍽 外食">
                  外食
                </option>
                <option value="🏥 医療">
                  医療
                </option>
                <option value="🧾 その他">
                  その他
                </option>
              </select>
            </div>

            <div class="rp-edit-field">
              <label for="rpEditUnitPrice">
                単価（円）
              </label>
              <input
                id="rpEditUnitPrice"
                type="number"
                min="0"
                step="1"
                inputmode="numeric">
            </div>

            <div
              class="rp-edit-total"
              id="rpEditTotal">
              合計 ¥0
            </div>

          </div>

          <div class="rp-edit-buttons">

            <button
              type="button"
              class="rp-edit-cancel"
              id="rpEditCancel">
              キャンセル
            </button>

            <button
              type="button"
              class="rp-edit-save"
              id="rpEditSave">
              保存
            </button>

          </div>

        </section>
      `
    );

    el("rpEditBackdrop")
      .addEventListener(
        "click",
        closeReportPurchaseEditor_
      );

    el("rpEditCancel")
      .addEventListener(
        "click",
        closeReportPurchaseEditor_
      );

    el("rpEditSave")
      .addEventListener(
        "click",
        saveReportPurchaseEditor_
      );

    el("rpEditQuantity")
      .addEventListener(
        "input",
        updateReportEditTotal_
      );

    el("rpEditUnitPrice")
      .addEventListener(
        "input",
        updateReportEditTotal_
      );
  }

  function updateReportEditTotal_() {
    const quantity =
      rpNumber_(
        el(
          "rpEditQuantity"
        ).value
      );

    const unitPrice =
      rpNumber_(
        el(
          "rpEditUnitPrice"
        ).value
      );

    el(
      "rpEditTotal"
    ).textContent =
      "合計 " +
      rpYen_(
        quantity *
        unitPrice
      );
  }

  function openReportPurchaseEditor_(item) {
    ensureReportPurchaseEditor_();

    reportEditingItem_ =
      item;

    el("rpEditName").value =
      rpProductName_(item);

    el("rpEditShop").value =
      rpText_(item.shop);

    el("rpEditDate").value =
      rpDate_(item.date)
        .replaceAll(
          "/",
          "-"
        );

    el("rpEditQuantity").value =
      rpNumber_(
        item.quantity
      ) || 1;

    el("rpEditClass").value =
      rpClassification_(item);

    const category =
      rpCategoryName_(item);

    const select =
      el(
        "rpEditCategory"
      );

    const categoryExists =
      [
        ...select.options
      ].some(
        function(option) {
          return (
            option.value ===
            category
          );
        }
      );

    if (!categoryExists) {
      select.add(
        new Option(
          category,
          category
        )
      );
    }

    select.value =
      category;

    el("rpEditUnitPrice").value =
      rpUnitPrice_(item) || "";

    updateReportEditTotal_();

    el("rpEditBackdrop")
      .classList.add(
        "is-open"
      );

    el("rpEditSheet")
      .classList.add(
        "is-open"
      );

    document.body.classList.add(
      "rp-edit-lock"
    );
  }

  function closeReportPurchaseEditor_() {
    el("rpEditBackdrop")
      ?.classList.remove(
        "is-open"
      );

    el("rpEditSheet")
      ?.classList.remove(
        "is-open"
      );

    document.body.classList.remove(
      "rp-edit-lock"
    );

    reportEditingItem_ =
      null;
  }

  async function saveReportPurchaseEditor_() {
    if (!reportEditingItem_) {
      return;
    }

    const productName =
      rpText_(
        el(
          "rpEditName"
        ).value
      );

    const shop =
      rpText_(
        el(
          "rpEditShop"
        ).value
      );

    const date =
      rpText_(
        el(
          "rpEditDate"
        ).value
      );

    const normalizedName =
      rpText_(
        el(
          "rpEditClass"
        ).value
      );

    const category =
      rpText_(
        el(
          "rpEditCategory"
        ).value
      );

    const quantity =
      rpNumber_(
        el(
          "rpEditQuantity"
        ).value
      );

    const unitPrice =
      rpNumber_(
        el(
          "rpEditUnitPrice"
        ).value
      );

    if (
      !productName ||
      !shop ||
      !date ||
      !normalizedName ||
      !category ||
      quantity <= 0 ||
      unitPrice < 0
    ) {
      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          "入力内容を確認してください"
        );
      }

      return;
    }

    const button =
      el(
        "rpEditSave"
      );

    button.disabled = true;
    button.textContent =
      "保存中…";

    try {
      const response =
        await fetch(
          API_BASE,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "text/plain;charset=utf-8"
            },
            body:
              JSON.stringify({
                action:
                  "updatePurchaseItem",
                row:
                  Number(
                    reportEditingItem_.row
                  ),
                date:
                  date,
                shop:
                  shop,
                productName:
                  productName,
                normalizedName:
                  normalizedName,
                category:
                  category,
                quantity:
                  quantity,
                unitPrice:
                  unitPrice,
                amount:
                  Math.round(
                    quantity *
                    unitPrice
                  )
              })
          }
        );

      if (!response.ok) {
        throw new Error(
          "HTTP " +
          response.status
        );
      }

      const result =
        await response.json();

      if (
        !result ||
        result.success !== true
      ) {
        throw new Error(
          result?.error ||
          "保存できませんでした"
        );
      }

      reportSelectedCategory_ =
        category;

      closeReportPurchaseEditor_();

      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          "全画面の購入データを更新しました"
        );
      }

      await loadReportPurchaseHistory_();

      if (
        typeof refreshReceiptPage ===
        "function"
      ) {
        await refreshReceiptPage();
      }

      if (
        typeof loadDashboard ===
        "function"
      ) {
        await loadDashboard();
      }
    }
    catch (error) {
      console.error(
        "Report purchase update error:",
        error
      );

      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          "保存できませんでした：" +
          (
            error.message ||
            error
          )
        );
      }
    }
    finally {
      button.disabled = false;
      button.textContent =
        "保存";
    }
  }
})();
// =========================================================
// 編集画面：保存ボタンを押したらすぐ閉じる
// =========================================================

(function () {
  "use strict";

  if (
    window.purchaseEditorImmediateCloseAdded_
  ) {
    return;
  }

  window.purchaseEditorImmediateCloseAdded_ =
    true;

  function editorValue_(id) {
    const target =
      document.getElementById(id);

    return target
      ? String(
          target.value || ""
        ).trim()
      : "";
  }

  function editorNumber_(id) {
    const value =
      Number(
        editorValue_(id)
      );

    return Number.isFinite(value)
      ? value
      : 0;
  }

  function closeReportEditorVisually_() {
    document
      .getElementById(
        "rpEditBackdrop"
      )
      ?.classList.remove(
        "is-open"
      );

    document
      .getElementById(
        "rpEditSheet"
      )
      ?.classList.remove(
        "is-open"
      );

    document.body.classList.remove(
      "rp-edit-lock"
    );
  }

  function closePurchaseEditorVisually_() {
    document
      .getElementById(
        "purchaseEditBackdrop"
      )
      ?.classList.remove(
        "is-open"
      );

    document
      .getElementById(
        "purchaseEditSheet"
      )
      ?.classList.remove(
        "is-open"
      );

    document.body.classList.remove(
      "purchase-edit-lock"
    );
  }

  document.addEventListener(
    "click",
    function(event) {
      const reportSaveButton =
        event.target.closest(
          "#rpEditSave"
        );

      if (reportSaveButton) {
        const valid =
          editorValue_(
            "rpEditName"
          ) &&
          editorValue_(
            "rpEditShop"
          ) &&
          editorValue_(
            "rpEditDate"
          ) &&
          editorValue_(
            "rpEditClass"
          ) &&
          editorValue_(
            "rpEditCategory"
          ) &&
          editorNumber_(
            "rpEditQuantity"
          ) > 0 &&
          editorNumber_(
            "rpEditUnitPrice"
          ) >= 0;

        if (!valid) {
          return;
        }

        closeReportEditorVisually_();

        if (
          typeof showToast ===
          "function"
        ) {
          showToast(
            "保存しています…"
          );
        }

        return;
      }

      const purchaseSaveButton =
        event.target.closest(
          "#purchaseEditSave"
        );

      if (purchaseSaveButton) {
        const valid =
          editorValue_(
            "purchaseEditName"
          ) &&
          editorValue_(
            "purchaseEditShop"
          ) &&
          editorValue_(
            "purchaseEditClass"
          ) &&
          editorNumber_(
            "purchaseEditQuantity"
          ) > 0 &&
          editorNumber_(
            "purchaseEditUnitPrice"
          ) >= 0;

        if (!valid) {
          return;
        }

        closePurchaseEditorVisually_();

        if (
          typeof showToast ===
          "function"
        ) {
          showToast(
            "保存しています…"
          );
        }
      }
    }
  );
})();
// =========================================================
// 編集画面：保存ボタンを押したらすぐ閉じる
// =========================================================

(function () {
  "use strict";

  if (
    window.purchaseEditorImmediateCloseAdded_
  ) {
    return;
  }

  window.purchaseEditorImmediateCloseAdded_ =
    true;

  function editorValue_(id) {
    const target =
      document.getElementById(id);

    return target
      ? String(
          target.value || ""
        ).trim()
      : "";
  }

  function editorNumber_(id) {
    const value =
      Number(
        editorValue_(id)
      );

    return Number.isFinite(value)
      ? value
      : 0;
  }

  function closeReportEditorVisually_() {
    document
      .getElementById(
        "rpEditBackdrop"
      )
      ?.classList.remove(
        "is-open"
      );

    document
      .getElementById(
        "rpEditSheet"
      )
      ?.classList.remove(
        "is-open"
      );

    document.body.classList.remove(
      "rp-edit-lock"
    );
  }

  function closePurchaseEditorVisually_() {
    document
      .getElementById(
        "purchaseEditBackdrop"
      )
      ?.classList.remove(
        "is-open"
      );

    document
      .getElementById(
        "purchaseEditSheet"
      )
      ?.classList.remove(
        "is-open"
      );

    document.body.classList.remove(
      "purchase-edit-lock"
    );
  }

  document.addEventListener(
    "click",
    function(event) {
      const reportSaveButton =
        event.target.closest(
          "#rpEditSave"
        );

      if (reportSaveButton) {
        const valid =
          editorValue_(
            "rpEditName"
          ) &&
          editorValue_(
            "rpEditShop"
          ) &&
          editorValue_(
            "rpEditDate"
          ) &&
          editorValue_(
            "rpEditClass"
          ) &&
          editorValue_(
            "rpEditCategory"
          ) &&
          editorNumber_(
            "rpEditQuantity"
          ) > 0 &&
          editorNumber_(
            "rpEditUnitPrice"
          ) >= 0;

        if (!valid) {
          return;
        }

        closeReportEditorVisually_();

        if (
          typeof showToast ===
          "function"
        ) {
          showToast(
            "保存しています…"
          );
        }

        return;
      }

      const purchaseSaveButton =
        event.target.closest(
          "#purchaseEditSave"
        );

      if (purchaseSaveButton) {
        const valid =
          editorValue_(
            "purchaseEditName"
          ) &&
          editorValue_(
            "purchaseEditShop"
          ) &&
          editorValue_(
            "purchaseEditClass"
          ) &&
          editorNumber_(
            "purchaseEditQuantity"
          ) > 0 &&
          editorNumber_(
            "purchaseEditUnitPrice"
          ) >= 0;

        if (!valid) {
          return;
        }

        closePurchaseEditorVisually_();

        if (
          typeof showToast ===
          "function"
        ) {
          showToast(
            "保存しています…"
          );
        }
      }
    }
  );
})();
// =========================================================
// 編集画面の大カテゴリをホームと同じ全カテゴリにする
// =========================================================

(function () {
  "use strict";

  if (
    window.purchaseFullCategoryFixAdded_
  ) {
    return;
  }

  window.purchaseFullCategoryFixAdded_ =
    true;

  function categoryFixText_(value) {
    return String(
      value || ""
    ).trim();
  }

  function categoryFixKey_(value) {
    return categoryFixText_(
      value
    )
      .normalize("NFKC")
      .replace(
        /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu,
        ""
      )
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function collectAllCategories_(
    currentValue
  ) {
    const categoryMap =
      new Map();

    function addCategory_(value) {
      const name =
        categoryFixText_(
          value
        );

      if (!name) {
        return;
      }

      const key =
        categoryFixKey_(
          name
        );

      if (
        !categoryMap.has(key)
      ) {
        categoryMap.set(
          key,
          name
        );
      }
    }

    // 現在の商品に設定されているカテゴリ
    addCategory_(
      currentValue
    );

    // ホーム画面で使用している全カテゴリ
    if (
      typeof dashboardData !==
        "undefined" &&
      dashboardData &&
      Array.isArray(
        dashboardData.categories
      )
    ) {
      dashboardData.categories
        .forEach(
          function(category) {
            addCategory_(
              category.name ||
              category.category ||
              category.label
            );
          }
        );
    }

    // 基本カテゴリ
    [
      "🏠 家賃",
      "🍎 食費",
      "🍽 外食",
      "🧻 日用品",
      "👕 洋服",
      "💧 水道",
      "💡 電気",
      "🔥 ガス",
      "🏥 医療",
      "🚃 交通",
      "📱 通信",
      "🎮 娯楽",
      "👶 子育て",
      "💄 美容",
      "🎁 特別費",
      "🧾 その他"
    ].forEach(
      addCategory_
    );

    return [
      ...categoryMap.values()
    ];
  }

  function restoreAllCategoryOptions_() {
    const select =
      document.getElementById(
        "rpEditCategory"
      );

    if (!select) {
      return;
    }

    const currentValue =
      categoryFixText_(
        select.value
      );

    const categories =
      collectAllCategories_(
        currentValue
      );

    select.innerHTML = "";

    categories.forEach(
      function(category) {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          category;

        option.textContent =
          category;

        select.appendChild(
          option
        );
      }
    );

    const currentKey =
      categoryFixKey_(
        currentValue
      );

    const matchingOption =
      [
        ...select.options
      ].find(
        function(option) {
          return (
            categoryFixKey_(
              option.value
            ) ===
            currentKey
          );
        }
      );

    if (matchingOption) {
      select.value =
        matchingOption.value;
    }
  }

  // 鉛筆ボタンで編集画面を開いた直後に
  // ホームと同じ全カテゴリへ戻す
  document.addEventListener(
    "click",
    function(event) {
      const editButton =
        event.target.closest(
          ".report-history-edit"
        );

      if (!editButton) {
        return;
      }

      setTimeout(
        restoreAllCategoryOptions_,
        0
      );
    }
  );

  // 編集画面内で大カテゴリを押した場合も確認
  document.addEventListener(
    "focusin",
    function(event) {
      if (
        event.target &&
        event.target.id ===
          "rpEditCategory"
      ) {
        restoreAllCategoryOptions_();
      }
    }
  );
})();
// =========================================================
// 古い購入履歴のレシートID不足を自動補完
// =========================================================

(function () {
  "use strict";

  if (
    window.purchaseReceiptIdFixAdded_
  ) {
    return;
  }

  window.purchaseReceiptIdFixAdded_ =
    true;

  const originalPurchaseFetch_ =
    window.fetch.bind(window);

  window.fetch =
    function(
      input,
      options
    ) {
      try {
        const requestOptions =
          options
            ? {
                ...options
              }
            : {};

        const method =
          String(
            requestOptions.method ||
            "GET"
          ).toUpperCase();

        if (
          method === "POST" &&
          typeof requestOptions.body ===
            "string"
        ) {
          const data =
            JSON.parse(
              requestOptions.body
            );

          if (
            data &&
            data.action ===
              "updatePurchaseItem"
          ) {
            const row =
              Number(
                data.row
              );

            if (
              !data.receiptId &&
              Number.isInteger(row) &&
              row >= 2
            ) {
              data.receiptId =
                "manual-purchase-row-" +
                row;
            }

            requestOptions.body =
              JSON.stringify(
                data
              );
          }
        }

        return originalPurchaseFetch_(
          input,
          requestOptions
        );
      }
      catch (error) {
        console.warn(
          "購入履歴ID補完:",
          error
        );

        return originalPurchaseFetch_(
          input,
          options
        );
      }
    };
})();
