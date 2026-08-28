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
// 購入履歴保存：Failed to fetch対策
//
// 通常送信が失敗した場合だけ再送し、
// スプレッドシートの更新結果まで確認する。
// =========================================================

(function () {
  "use strict";

  if (
    window.purchaseSaveRetryAdded_
  ) {
    return;
  }

  window.purchaseSaveRetryAdded_ =
    true;

  const purchaseNativeFetch_ =
    window.fetch.bind(window);

  function waitPurchaseSave_(milliseconds) {
    return new Promise(
      function(resolve) {
        setTimeout(
          resolve,
          milliseconds
        );
      }
    );
  }

  async function verifyPurchaseSaved_(
    data
  ) {
    await waitPurchaseSave_(
      1200
    );

    const response =
      await purchaseNativeFetch_(
        API_BASE +
        "?mode=purchaseItems" +
        "&_=" +
        Date.now(),
        {
          method:
            "GET",
          cache:
            "no-store"
        }
      );

    if (!response.ok) {
      return false;
    }

    const result =
      await response.json();

    let items = [];

    if (
      result &&
      Array.isArray(
        result.items
      )
    ) {
      items =
        result.items;
    }
    else if (
      Array.isArray(result)
    ) {
      items =
        result;
    }
    else if (
      result &&
      Array.isArray(
        result.data
      )
    ) {
      items =
        result.data;
    }

    const savedItem =
      items.find(
        function(item) {
          return (
            Number(item.row) ===
            Number(data.row)
          );
        }
      );

    if (!savedItem) {
      return false;
    }

    const sameName =
      String(
        savedItem.productName || ""
      ).trim() ===
      String(
        data.productName || ""
      ).trim();

    const sameCategory =
      String(
        savedItem.category || ""
      )
        .replace(/\s+/g, "")
        .includes(
          String(
            data.category || ""
          )
            .replace(
              /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu,
              ""
            )
            .replace(/\s+/g, "")
        );

    const sameQuantity =
      Number(
        savedItem.quantity
      ) ===
      Number(
        data.quantity
      );

    return (
      sameName &&
      sameCategory &&
      sameQuantity
    );
  }

  window.fetch =
    async function(
      input,
      options
    ) {
      const requestOptions =
        options || {};

      const method =
        String(
          requestOptions.method ||
          "GET"
        ).toUpperCase();

      let updateData = null;

      if (
        method === "POST" &&
        typeof requestOptions.body ===
          "string"
      ) {
        try {
          const parsed =
            JSON.parse(
              requestOptions.body
            );

          if (
            parsed &&
            parsed.action ===
              "updatePurchaseItem"
          ) {
            updateData =
              parsed;
          }
        }
        catch (error) {
          updateData =
            null;
        }
      }

      // 購入明細の更新以外は通常通信
      if (!updateData) {
        return purchaseNativeFetch_(
          input,
          options
        );
      }

      try {
        // 最初は通常方式で保存
        return await purchaseNativeFetch_(
          input,
          options
        );
      }
      catch (firstError) {
        console.warn(
          "通常保存に失敗したため再送します:",
          firstError
        );

        // 応答が遮断される場合の再送
        await purchaseNativeFetch_(
          input,
          {
            method:
              "POST",
            mode:
              "no-cors",
            headers: {
              "Content-Type":
                "text/plain;charset=utf-8"
            },
            body:
              requestOptions.body
          }
        );

        const saved =
          await verifyPurchaseSaved_(
            updateData
          );

        if (!saved) {
          throw new Error(
            "スプレッドシートへの保存を確認できませんでした"
          );
        }

        // 元の保存処理へ成功結果を返す
        return {
          ok:
            true,
          status:
            200,
          json:
            async function() {
              return {
                success:
                  true,
                verified:
                  true
              };
            }
        };
      }
    };
})();
// =========================================================
// 購入履歴の保存をGET方式へ切り替える
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (
    window.purchaseGetSaveAdded_
  ) {
    return;
  }

  window.purchaseGetSaveAdded_ =
    true;

  const fetchBeforeGetSave_ =
    window.fetch.bind(window);

  window.fetch =
    function(
      input,
      options
    ) {
      const requestOptions =
        options || {};

      const method =
        String(
          requestOptions.method ||
          "GET"
        ).toUpperCase();

      // POST以外は通常通信
      if (
        method !== "POST" ||
        typeof requestOptions.body !==
          "string"
      ) {
        return fetchBeforeGetSave_(
          input,
          options
        );
      }

      let data;

      try {
        data =
          JSON.parse(
            requestOptions.body
          );
      }
      catch (error) {
        return fetchBeforeGetSave_(
          input,
          options
        );
      }

      // 購入明細の修正以外は通常通信
      if (
        !data ||
        data.action !==
          "updatePurchaseItem"
      ) {
        return fetchBeforeGetSave_(
          input,
          options
        );
      }

      const parameters =
        new URLSearchParams();

      parameters.set(
        "action",
        "updatePurchaseItem"
      );

      [
        "row",
        "date",
        "shop",
        "productName",
        "normalizedName",
        "category",
        "quantity",
        "unitPrice",
        "amount",
        "receiptId"
      ].forEach(
        function(key) {
          if (
            data[key] !==
              undefined &&
            data[key] !==
              null
          ) {
            parameters.set(
              key,
              String(
                data[key]
              )
            );
          }
        }
      );

      return fetchBeforeGetSave_(
        API_BASE +
        "?" +
        parameters.toString() +
        "&_=" +
        Date.now(),
        {
          method:
            "GET",
          cache:
            "no-store"
        }
      );
    };
})();
// =========================================================
// カレンダー：内容がない支出を店舗別に合算
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (
    window.calendarShopSummaryAdded_
  ) {
    return;
  }

  window.calendarShopSummaryAdded_ =
    true;

  const originalRenderSelectedDay_ =
    renderSelectedDay;

  renderSelectedDay =
    function () {
      originalRenderSelectedDay_();

      if (
        !selectedCalendarDate
      ) {
        return;
      }

      const expenses =
        getExpensesForDate(
          selectedCalendarDate
        );

      if (
        !Array.isArray(expenses) ||
        expenses.length === 0
      ) {
        return;
      }

      const container =
        document.getElementById(
          "selectedDayList"
        );

      if (!container) {
        return;
      }

      const blocks =
        Array.from(
          container.querySelectorAll(
            ".day-detail-block"
          )
        );

      const expenseBlock =
        blocks.find(
          function (block) {
            const heading =
              block.querySelector(
                ".day-detail-heading strong"
              );

            return (
              heading &&
              heading.textContent
                .trim() ===
                "この日の支出"
            );
          }
        );

      if (!expenseBlock) {
        return;
      }

      // 元の支出一覧と合計を削除
      expenseBlock
        .querySelectorAll(
          ".day-expense-row, .day-expense-total"
        )
        .forEach(
          function (element) {
            element.remove();
          }
        );

      const groupedByShop = {};
      const detailedExpenses = [];

      expenses.forEach(
        function (expense) {
          const content =
            String(
              expense.content ||
              expense.memo ||
              expense.description ||
              expense.productName ||
              expense.itemName ||
              ""
            ).trim();

          const shop =
            String(
              expense.shop ||
              "店舗不明"
            ).trim();

          const amount =
            Number(
              expense.amount
            ) || 0;

          // 内容があるものは個別表示
          if (content) {
            detailedExpenses.push({
              shop:
                shop,
              content:
                content,
              category:
                String(
                  expense.category ||
                  "🧾 雑費"
                ),
              payer:
                String(
                  expense.payer ||
                  ""
                ),
              amount:
                amount
            });

            return;
          }

          // 内容がないものは店舗別に合算
          if (!groupedByShop[shop]) {
            groupedByShop[shop] = {
              shop:
                shop,
              amount:
                0,
              count:
                0,
              categories:
                [],
              payers:
                []
            };
          }

          const group =
            groupedByShop[shop];

          group.amount +=
            amount;

          group.count++;

          const category =
            String(
              expense.category ||
              "🧾 雑費"
            ).trim();

          if (
            category &&
            !group.categories.includes(
              category
            )
          ) {
            group.categories.push(
              category
            );
          }

          const payer =
            String(
              expense.payer ||
              ""
            ).trim();

          if (
            payer &&
            !group.payers.includes(
              payer
            )
          ) {
            group.payers.push(
              payer
            );
          }
        }
      );

      const shopGroups =
        Object.values(
          groupedByShop
        ).sort(
          function (a, b) {
            return (
              b.amount -
              a.amount
            );
          }
        );

      let expenseHtml = "";

      shopGroups.forEach(
        function (group) {
          const details = [];

          if (
            group.categories.length
          ) {
            details.push(
              group.categories.join(
                "・"
              )
            );
          }

          if (
            group.payers.length
          ) {
            details.push(
              group.payers.join(
                "・"
              )
            );
          }

          details.push(
            group.count +
            "件を合算"
          );

          expenseHtml += `
            <div class="day-expense-row">

              <div class="day-expense-main">

                <strong>
                  ${escapeHTML(group.shop)}
                </strong>

                <span>
                  ${escapeHTML(details.join(" ・ "))}
                </span>

              </div>

              <strong class="day-expense-price">
                ${yen(group.amount)}
              </strong>

            </div>
          `;
        }
      );

      detailedExpenses.forEach(
        function (expense) {
          const details = [
            expense.shop,
            expense.category
          ];

          if (expense.payer) {
            details.push(
              expense.payer
            );
          }

          expenseHtml += `
            <div class="day-expense-row">

              <div class="day-expense-main">

                <strong>
                  ${escapeHTML(expense.content)}
                </strong>

                <span>
                  ${escapeHTML(details.join(" ・ "))}
                </span>

              </div>

              <strong class="day-expense-price">
                ${yen(expense.amount)}
              </strong>

            </div>
          `;
        }
      );

      const total =
        expenses.reduce(
          function (sum, expense) {
            return (
              sum +
              (
                Number(
                  expense.amount
                ) || 0
              )
            );
          },
          0
        );

      const displayedStoreCount =
        new Set(
          expenses.map(
            function (expense) {
              return String(
                expense.shop ||
                "店舗不明"
              ).trim();
            }
          )
        ).size;

      expenseHtml += `
        <div class="day-expense-total">

          <span>
            ${
              displayedStoreCount > 1
                ? "全店舗合計"
                : "合計"
            }
          </span>

          <strong>
            ${yen(total)}
          </strong>

        </div>
      `;

      expenseBlock.insertAdjacentHTML(
        "beforeend",
        expenseHtml
      );

      const countElement =
        expenseBlock.querySelector(
          ".day-detail-heading small"
        );

      if (countElement) {
        countElement.textContent =
          displayedStoreCount +
          "店舗・" +
          expenses.length +
          "件";
      }
    };
})();
// =========================================================
// 現在の貯蓄を手動修正
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (
    window.currentSavingsEditAdded_
  ) {
    return;
  }

  window.currentSavingsEditAdded_ =
    true;

  let savingsLoaded_ =
    false;

  let savingsLoading_ =
    false;

  function savingsYen_(
    amount
  ) {
    return (
      "¥" +
      Math.round(
        Number(amount) || 0
      ).toLocaleString(
        "ja-JP"
      )
    );
  }

  function updateSavingsDisplay_(
    amount
  ) {
    if (
      !dashboardData
    ) {
      return;
    }

    if (
      !dashboardData.saving
    ) {
      dashboardData.saving = {};
    }

    dashboardData.saving.current =
      amount;

    dashboardData.saving.actual =
      amount;

    const homeAmount =
      document.getElementById(
        "savingActual"
      );

    if (homeAmount) {
      homeAmount.textContent =
        savingsYen_(amount);
    }

    const reportAmount =
      document.getElementById(
        "reportSaving"
      );

    if (reportAmount) {
      reportAmount.textContent =
        savingsYen_(amount);
    }
  }

  async function loadCurrentSavings_() {
    if (
      savingsLoaded_ ||
      savingsLoading_
    ) {
      return;
    }

    savingsLoading_ =
      true;

    try {
      const response =
        await fetch(
          API_BASE +
          "?action=getCurrentSavings" +
          "&_=" +
          Date.now(),
          {
            method:
              "GET",
            cache:
              "no-store"
          }
        );

      const result =
        await response.json();

      if (
        result &&
        result.success === true &&
        result.hasManualValue === true
      ) {
        updateSavingsDisplay_(
          Number(result.amount) || 0
        );
      }

      savingsLoaded_ =
        true;
    }
    catch (error) {
      console.warn(
        "現在の貯蓄取得:",
        error
      );
    }
    finally {
      savingsLoading_ =
        false;
    }
  }

  async function editCurrentSavings_() {
    const currentAmount =
      Number(
        dashboardData?.saving?.current ??
        dashboardData?.saving?.actual ??
        0
      ) || 0;

    const input =
      window.prompt(
        "現在の貯蓄額を入力してください",
        String(currentAmount)
      );

    if (
      input === null
    ) {
      return;
    }

    const normalizedInput =
      String(input)
        .replace(/[¥￥,\s]/g, "");

    const amount =
      Number(
        normalizedInput
      );

    if (
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          "0円以上の金額を入力してください"
        );
      }

      return;
    }

    try {
      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          "貯蓄額を保存しています…"
        );
      }

      const response =
        await fetch(
          API_BASE +
          "?action=saveCurrentSavings" +
          "&amount=" +
          encodeURIComponent(
            Math.round(amount)
          ) +
          "&_=" +
          Date.now(),
          {
            method:
              "GET",
            cache:
              "no-store"
          }
        );

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

      updateSavingsDisplay_(
        Number(result.amount) || 0
      );

      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          "現在の貯蓄を修正しました"
        );
      }
    }
    catch (error) {
      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          "保存できませんでした：" +
          String(
            error.message ||
            error
          )
        );
      }
    }
  }

  function addSavingsEditButton_() {
    const amountElement =
      document.getElementById(
        "savingActual"
      );

    if (
      !amountElement ||
      document.getElementById(
        "currentSavingsEditButton"
      )
    ) {
      return;
    }

    const button =
      document.createElement(
        "button"
      );

    button.id =
      "currentSavingsEditButton";

    button.type =
      "button";

    button.title =
      "現在の貯蓄を修正";

    button.innerHTML =
      "✏️";

    button.style.cssText = `
      margin-left: 8px;
      padding: 4px 7px;
      border: 0;
      border-radius: 10px;
      background: #eef8f1;
      cursor: pointer;
      font-size: 13px;
      vertical-align: middle;
    `;

    button.addEventListener(
      "click",
      editCurrentSavings_
    );

    amountElement.insertAdjacentElement(
      "afterend",
      button
    );
  }

  const originalRenderHomeSavings_ =
    renderHome;

  renderHome =
    function () {
      originalRenderHomeSavings_();

      addSavingsEditButton_();
      loadCurrentSavings_();
    };

  const originalRenderReportSavings_ =
    renderReport;

  renderReport =
    function () {
      originalRenderReportSavings_();

      loadCurrentSavings_();
    };

  setTimeout(
    function () {
      addSavingsEditButton_();
      loadCurrentSavings_();
    },
    500
  );
})();
// =========================================================
// 現在の貯蓄：更新後に0円へ戻る問題を修正
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (
    window.savingsPersistenceV2Added_
  ) {
    return;
  }

  window.savingsPersistenceV2Added_ =
    true;

  let manualSavingsAmountV2_ =
    null;

  let savingsRequestRunningV2_ =
    false;

  function displaySavingsV2_(
    amount
  ) {
    const fixedAmount =
      Math.max(
        0,
        Math.round(
          Number(amount) || 0
        )
      );

    manualSavingsAmountV2_ =
      fixedAmount;

    if (
      typeof dashboardData !==
      "undefined" &&
      dashboardData
    ) {
      if (
        !dashboardData.saving
      ) {
        dashboardData.saving = {};
      }

      dashboardData.saving.current =
        fixedAmount;

      dashboardData.saving.actual =
        fixedAmount;
    }

    const formatted =
      "¥" +
      fixedAmount.toLocaleString(
        "ja-JP"
      );

    const homeAmount =
      document.getElementById(
        "savingActual"
      );

    if (homeAmount) {
      homeAmount.textContent =
        formatted;
    }

    const reportAmount =
      document.getElementById(
        "reportSaving"
      );

    if (reportAmount) {
      reportAmount.textContent =
        formatted;
    }
  }

  async function reloadSavingsV2_() {
    if (
      savingsRequestRunningV2_
    ) {
      return;
    }

    savingsRequestRunningV2_ =
      true;

    try {
      const response =
        await fetch(
          API_BASE +
          "?action=getCurrentSavings" +
          "&_=" +
          Date.now(),
          {
            method:
              "GET",
            cache:
              "no-store"
          }
        );

      const result =
        await response.json();

      if (
        result &&
        result.success === true &&
        result.hasManualValue === true
      ) {
        displaySavingsV2_(
          result.amount
        );
      }
    }
    catch (error) {
      console.warn(
        "貯蓄額の再取得:",
        error
      );
    }
    finally {
      savingsRequestRunningV2_ =
        false;
    }
  }

  // ホームが再表示されても手動金額を維持
  const renderHomeBeforeSavingsV2_ =
    renderHome;

  renderHome =
    function () {
      renderHomeBeforeSavingsV2_();

      if (
        manualSavingsAmountV2_ !==
        null
      ) {
        displaySavingsV2_(
          manualSavingsAmountV2_
        );
      }
      else {
        reloadSavingsV2_();
      }
    };

  // レポートでも同じ金額を維持
  const renderReportBeforeSavingsV2_ =
    renderReport;

  renderReport =
    function () {
      renderReportBeforeSavingsV2_();

      if (
        manualSavingsAmountV2_ !==
        null
      ) {
        displaySavingsV2_(
          manualSavingsAmountV2_
        );
      }
      else {
        reloadSavingsV2_();
      }
    };

  // 貯蓄の保存通信を監視して保存後の金額を保持
  const fetchBeforeSavingsV2_ =
    window.fetch.bind(
      window
    );

  window.fetch =
    async function(
      input,
      options
    ) {
      const response =
        await fetchBeforeSavingsV2_(
          input,
          options
        );

      const url =
        typeof input ===
        "string"
          ? input
          : String(
              input?.url || ""
            );

      if (
        url.includes(
          "action=saveCurrentSavings"
        )
      ) {
        try {
          const copy =
            response.clone();

          const result =
            await copy.json();

          if (
            result &&
            result.success === true
          ) {
            displaySavingsV2_(
              result.amount
            );
          }
        }
        catch (error) {
          console.warn(
            "貯蓄保存結果:",
            error
          );
        }
      }

      return response;
    };

  // 起動時とデータ読込後に再確認
  reloadSavingsV2_();

  setTimeout(
    reloadSavingsV2_,
    1500
  );

  setTimeout(
    reloadSavingsV2_,
    3500
  );
})();
// =========================================================
// 生活費内訳：金額を右寄せして位置を統一
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (
    document.getElementById(
      "categoryAmountAlignmentStyle"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "categoryAmountAlignmentStyle";

  style.textContent = `
    #categoryList .category-top {
      display: grid !important;
      grid-template-columns:
        minmax(0, 1fr)
        minmax(145px, auto)
        14px !important;
      column-gap: 7px !important;
      align-items: center !important;
      width: 100% !important;
    }

    #categoryList .category-name {
      min-width: 0 !important;
      text-align: left !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    #categoryList .category-amount {
      min-width: 145px !important;
      margin: 0 !important;
      text-align: right !important;
      justify-self: end !important;
      white-space: nowrap !important;
      font-variant-numeric:
        tabular-nums !important;
      letter-spacing: 0 !important;
    }

    #categoryList
    .category-item.is-report-link
    .category-top::after {
      display: block !important;
      width: 14px !important;
      margin: 0 !important;
      text-align: right !important;
      justify-self: end !important;
    }

    #categoryList .category-remaining {
      width: 100% !important;
      text-align: right !important;
      font-variant-numeric:
        tabular-nums !important;
    }

    @media (max-width: 390px) {
      #categoryList .category-top {
        grid-template-columns:
          minmax(0, 1fr)
          minmax(130px, auto)
          12px !important;
        column-gap: 5px !important;
      }

      #categoryList .category-amount {
        min-width: 130px !important;
        font-size: 12px !important;
      }
    }
  `;

  document.head.appendChild(
    style
  );
})();
// =========================================================
// レポート上部をホームと同じカードデザインに変更
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (
    window.reportHomeCardDesignAdded_
  ) {
    return;
  }

  window.reportHomeCardDesignAdded_ =
    true;

  function addReportHomeStyles_() {
    if (
      document.getElementById(
        "reportHomeCardStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "reportHomeCardStyles";

    style.textContent = `
      #page-report .report-home-budget-card {
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
        width: 100%;
        margin: 16px 0 18px;
        padding: 25px 24px 22px;
        border: 1px solid #edf1ee;
        border-radius: 27px;
        background:
          linear-gradient(
            135deg,
            #ffffff 0%,
            #fbfffc 65%,
            #f3fff6 100%
          ) !important;
        color: #171a18 !important;
        box-shadow:
          0 16px 34px
          rgba(39, 74, 51, 0.08);
      }

      #page-report
      .report-home-budget-card::after {
        content: "";
        position: absolute;
        top: -58px;
        right: -54px;
        width: 148px;
        height: 148px;
        border-radius: 50%;
        background:
          rgba(74, 211, 112, 0.10);
        pointer-events: none;
      }

      #page-report .report-home-budget-top {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 15px;
      }

      #page-report .report-home-budget-label {
        display: block;
        margin-bottom: 7px;
        color: #6f7772;
        font-size: 12px;
        font-weight: 700;
      }

      #page-report #reportExpense {
        display: block;
        color: #171a18 !important;
        font-size: clamp(38px, 11vw, 50px);
        font-weight: 900;
        line-height: 1;
        letter-spacing: -2px;
        font-variant-numeric: tabular-nums;
      }

      #page-report #reportRate {
        position: relative;
        z-index: 2;
        min-width: 58px;
        padding: 9px 13px;
        border-radius: 999px;
        background: #dcf8e4;
        color: #20a74c;
        font-size: 14px;
        font-weight: 800;
        text-align: center;
      }

      #page-report .report-home-progress {
        position: relative;
        z-index: 1;
        width: 100%;
        height: 11px;
        margin: 27px 0 19px;
        overflow: hidden;
        border-radius: 999px;
        background: #e8ebe9;
      }

      #page-report .report-home-progress-bar {
        width: 0;
        height: 100%;
        border-radius: inherit;
        background:
          linear-gradient(
            90deg,
            #26bd55,
            #58d47b
          );
        transition: width 0.35s ease;
      }

      #page-report .report-home-budget-bottom {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns:
          1fr 1fr;
        gap: 16px;
      }

      #page-report .report-home-budget-item {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      #page-report .report-home-budget-item:last-child {
        text-align: right;
      }

      #page-report .report-home-budget-item span {
        color: #929994;
        font-size: 11px;
      }

      #page-report .report-home-budget-item strong {
        color: #171a18;
        font-size: 16px;
        font-weight: 850;
        font-variant-numeric: tabular-nums;
      }

      #page-report .report-home-saving-card {
        box-sizing: border-box;
        display: grid;
        grid-template-columns:
          58px
          minmax(0, 1fr)
          auto;
        gap: 14px;
        align-items: center;
        width: 100%;
        margin: 0 0 18px;
        padding: 22px;
        border: 1px solid #edf1ee;
        border-radius: 27px;
        background:
          linear-gradient(
            135deg,
            #ffffff 0%,
            #f5fff7 100%
          );
        box-shadow:
          0 16px 34px
          rgba(39, 74, 51, 0.08);
      }

      #page-report .report-home-saving-icon {
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        border-radius: 20px;
        background: #dff8e6;
        color: #20be50;
      }

      #page-report
      .report-home-saving-icon
      .material-symbols-rounded {
        font-size: 29px;
      }

      #page-report .report-home-saving-content {
        min-width: 0;
      }

      #page-report .report-home-saving-content span {
        display: block;
        margin-bottom: 3px;
        color: #737b76;
        font-size: 11px;
      }

      #page-report #reportSaving {
        display: block;
        color: #171a18;
        font-size: 29px;
        font-weight: 900;
        line-height: 1.1;
        letter-spacing: -1px;
        font-variant-numeric: tabular-nums;
      }

      #page-report .report-home-saving-content p {
        margin: 8px 0 0;
        color: #9ba19d;
        font-size: 10px;
      }

      #page-report .report-saving-edit {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        padding: 0;
        border: 0;
        border-radius: 12px;
        background: #e8f8ec;
        cursor: pointer;
        font-size: 15px;
      }

      #page-report .report-grid-home-style {
        display: block !important;
        margin: 0 !important;
      }

      @media (max-width: 390px) {
        #page-report .report-home-budget-card {
          padding: 22px 20px 20px;
        }

        #page-report .report-home-saving-card {
          grid-template-columns:
            52px
            minmax(0, 1fr)
            32px;
          gap: 11px;
          padding: 19px;
        }

        #page-report .report-home-saving-icon {
          width: 52px;
          height: 52px;
        }

        #page-report #reportSaving {
          font-size: 25px;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function buildReportHomeCards_() {
    addReportHomeStyles_();

    const page =
      document.getElementById(
        "page-report"
      );

    if (!page) {
      return;
    }

    const hero =
      page.querySelector(
        ".report-hero"
      );

    const grid =
      page.querySelector(
        ".report-grid"
      );

    if (
      !hero ||
      !grid
    ) {
      return;
    }

    if (
      hero.dataset.homeDesign !==
      "true"
    ) {
      hero.dataset.homeDesign =
        "true";

      hero.className =
        "report-hero report-home-budget-card";

      hero.innerHTML = `
        <div class="report-home-budget-top">

          <div>
            <span class="report-home-budget-label">
              今月の生活費
            </span>

            <strong id="reportExpense">
              ¥0
            </strong>
          </div>

          <strong id="reportRate">
            0%
          </strong>

        </div>

        <div class="report-home-progress">

          <div
            class="report-home-progress-bar"
            id="reportHomeProgressBar"
          ></div>

        </div>

        <div class="report-home-budget-bottom">

          <div class="report-home-budget-item">
            <span>予算</span>

            <strong id="reportBudget">
              ¥250,000
            </strong>
          </div>

          <div class="report-home-budget-item">
            <span>残り</span>

            <strong id="reportRemaining">
              ¥250,000
            </strong>
          </div>

        </div>

        <small
          id="reportHeroCaption"
          hidden
        ></small>
      `;
    }

    if (
      grid.dataset.homeDesign !==
      "true"
    ) {
      grid.dataset.homeDesign =
        "true";

      grid.className =
        "report-grid report-grid-home-style";

      grid.innerHTML = `
        <section class="report-home-saving-card">

          <div class="report-home-saving-icon">
            <span class="material-symbols-rounded">
              savings
            </span>
          </div>

          <div class="report-home-saving-content">

            <span>
              現在の貯蓄
            </span>

            <strong id="reportSaving">
              ¥0
            </strong>

            <p>
              終了した月の残金を自動で貯蓄
            </p>

          </div>

          <button
            type="button"
            class="report-saving-edit"
            id="reportSavingsEditButton"
            title="現在の貯蓄を修正"
          >
            ✏️
          </button>

        </section>
      `;

      const editButton =
        document.getElementById(
          "reportSavingsEditButton"
        );

      if (editButton) {
        editButton.addEventListener(
          "click",
          function () {
            const homeEditButton =
              document.getElementById(
                "currentSavingsEditButton"
              );

            if (homeEditButton) {
              homeEditButton.click();
            }
          }
        );
      }
    }
  }

  function updateReportProgress_() {
    const rateElement =
      document.getElementById(
        "reportRate"
      );

    const progressBar =
      document.getElementById(
        "reportHomeProgressBar"
      );

    if (
      !rateElement ||
      !progressBar
    ) {
      return;
    }

    const rate =
      Number(
        String(
          rateElement.textContent ||
          "0"
        ).replace(
          /[^\d.-]/g,
          ""
        )
      ) || 0;

    progressBar.style.width =
      Math.min(
        100,
        Math.max(
          0,
          rate
        )
      ) +
      "%";
  }

  const renderReportBeforeHomeDesign_ =
    renderReport;

  renderReport =
    function () {
      buildReportHomeCards_();

      renderReportBeforeHomeDesign_();

      updateReportProgress_();
    };

  buildReportHomeCards_();

  setTimeout(
    function () {
      buildReportHomeCards_();

      if (
        typeof dashboardData !==
          "undefined" &&
        dashboardData
      ) {
        renderReport();
      }
    },
    500
  );
})();
// =========================================================
// レポート画面はカテゴリ別支出だけ表示
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (
    document.getElementById(
      "reportSimpleDisplayStyle"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "reportSimpleDisplayStyle";

  style.textContent = `
    /* 今月の分析 */
    #page-report .report-title,
    #page-report .page-section-title.report-title {
      display: none !important;
    }

    /* 今月の生活費 */
    #page-report .report-hero,
    #page-report .report-home-budget-card {
      display: none !important;
    }

    /* 予算・残り・使用率・現在の貯蓄 */
    #page-report .report-grid,
    #page-report .report-grid-home-style,
    #page-report .report-home-saving-card {
      display: none !important;
    }

    /* カテゴリ別支出を上へ移動 */
    #page-report > .card {
      margin-top: 8px !important;
    }
  `;

  document.head.appendChild(
    style
  );
})();
// =========================================================
// 設定画面を夫婦共有の買い物メモへ変更
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (
    window.shoppingMemoPageAdded_
  ) {
    return;
  }

  window.shoppingMemoPageAdded_ =
    true;

  let shoppingMemoItems_ = [];
  let shoppingMemoLoading_ = false;
  let shoppingMemoBuilt_ = false;

  function shoppingEscape_(
    value
  ) {
    return String(
      value || ""
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function addShoppingMemoStyles_() {
    if (
      document.getElementById(
        "shoppingMemoPageStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "shoppingMemoPageStyles";

    style.textContent = `
      #page-settings .shopping-memo-title {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 18px;
        padding-bottom: 16px;
        border-bottom: 1px solid #e4eae6;
      }

      #page-settings .shopping-memo-title-icon {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        flex: 0 0 48px;
        border-radius: 16px;
        background: #e1f9e8;
        color: #20bd50;
      }

      #page-settings .shopping-memo-title-icon span {
        font-size: 27px;
      }

      #page-settings .shopping-memo-title small {
        display: block;
        margin-bottom: 3px;
        color: #8b938e;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1.2px;
      }

      #page-settings .shopping-memo-title strong {
        display: block;
        color: #171a18;
        font-size: 18px;
      }

      #page-settings .shopping-input-card {
        box-sizing: border-box;
        margin-bottom: 16px;
        padding: 20px;
        border: 1px solid #e8ede9;
        border-radius: 25px;
        background:
          linear-gradient(
            135deg,
            #ffffff,
            #f5fff7
          );
        box-shadow:
          0 14px 30px
          rgba(39, 74, 51, 0.07);
      }

      #page-settings .shopping-input-card h3 {
        margin: 0 0 5px;
        color: #171a18;
        font-size: 17px;
      }

      #page-settings .shopping-input-card p {
        margin: 0 0 15px;
        color: #8d9690;
        font-size: 11px;
        line-height: 1.6;
      }

      #page-settings .shopping-input-row {
        display: grid;
        grid-template-columns:
          minmax(0, 1fr)
          auto;
        gap: 9px;
      }

      #page-settings #shoppingMemoInput {
        box-sizing: border-box;
        width: 100%;
        height: 49px;
        min-width: 0;
        padding: 0 15px;
        border: 1px solid #dfe7e1;
        border-radius: 15px;
        outline: none;
        background: #ffffff;
        color: #171a18;
        font-size: 16px;
      }

      #page-settings #shoppingMemoInput:focus {
        border-color: #38c866;
        box-shadow:
          0 0 0 3px
          rgba(56, 200, 102, 0.12);
      }

      #page-settings #shoppingMemoAddButton {
        height: 49px;
        padding: 0 18px;
        border: 0;
        border-radius: 15px;
        background:
          linear-gradient(
            135deg,
            #24bf55,
            #48d473
          );
        color: #ffffff;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
      }

      #page-settings #shoppingMemoAddButton:disabled {
        opacity: 0.55;
        cursor: wait;
      }

      #page-settings .shopping-list-card {
        overflow: hidden;
        border: 1px solid #e8ede9;
        border-radius: 25px;
        background: #ffffff;
        box-shadow:
          0 14px 30px
          rgba(39, 74, 51, 0.07);
      }

      #page-settings .shopping-list-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 17px 19px;
        border-bottom: 1px solid #edf1ee;
      }

      #page-settings .shopping-list-heading strong {
        color: #171a18;
        font-size: 15px;
      }

      #page-settings .shopping-list-heading span {
        padding: 5px 10px;
        border-radius: 999px;
        background: #e6f9eb;
        color: #22a94d;
        font-size: 11px;
        font-weight: 800;
      }

      #page-settings .shopping-empty {
        padding: 42px 20px;
        text-align: center;
        color: #929b95;
      }

      #page-settings .shopping-empty-icon {
        display: block;
        margin-bottom: 8px;
        font-size: 35px;
      }

      #page-settings .shopping-empty strong {
        display: block;
        margin-bottom: 5px;
        color: #59615c;
        font-size: 14px;
      }

      #page-settings .shopping-empty p {
        margin: 0;
        font-size: 11px;
      }

      #page-settings .shopping-item {
        display: grid;
        grid-template-columns:
          35px
          minmax(0, 1fr)
          34px;
        gap: 10px;
        align-items: center;
        min-height: 62px;
        padding: 9px 15px;
        border-bottom: 1px solid #edf1ee;
      }

      #page-settings .shopping-item:last-child {
        border-bottom: 0;
      }

      #page-settings .shopping-check {
        position: relative;
        display: grid;
        place-items: center;
        width: 31px;
        height: 31px;
        padding: 0;
        border: 2px solid #cfd8d1;
        border-radius: 11px;
        background: #ffffff;
        color: transparent;
        cursor: pointer;
      }

      #page-settings .shopping-check span {
        font-size: 20px;
      }

      #page-settings
      .shopping-item.is-completed
      .shopping-check {
        border-color: #2fc65e;
        background: #2fc65e;
        color: #ffffff;
      }

      #page-settings .shopping-item-text {
        min-width: 0;
        color: #171a18;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      #page-settings
      .shopping-item.is-completed
      .shopping-item-text {
        color: #9ba39e;
        text-decoration: line-through;
      }

      #page-settings .shopping-delete {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 0;
        border-radius: 11px;
        background: #f6f7f6;
        color: #9ba39e;
        cursor: pointer;
      }

      #page-settings .shopping-delete span {
        font-size: 19px;
      }

      #page-settings .shopping-completed-title {
        padding: 11px 17px;
        background: #f8faf8;
        color: #929a95;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.8px;
      }

      #page-settings .shopping-memo-actions {
        display: flex;
        justify-content: center;
        padding: 15px;
        border-top: 1px solid #edf1ee;
      }

      #page-settings #shoppingClearCompletedButton {
        padding: 10px 15px;
        border: 0;
        border-radius: 13px;
        background: #f4f6f4;
        color: #747c77;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      #page-settings .shopping-refresh {
        display: flex;
        justify-content: center;
        margin-top: 13px;
      }

      #page-settings #shoppingRefreshButton {
        display: flex;
        gap: 5px;
        align-items: center;
        padding: 9px 14px;
        border: 0;
        border-radius: 13px;
        background: transparent;
        color: #5f6b63;
        font-size: 11px;
        cursor: pointer;
      }

      #page-settings #shoppingRefreshButton span {
        font-size: 18px;
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function buildShoppingMemoPage_() {
    const page =
      document.getElementById(
        "page-settings"
      );

    if (!page) {
      return;
    }

    addShoppingMemoStyles_();

    page.innerHTML = `
      <div class="shopping-memo-title">

        <div class="shopping-memo-title-icon">
          <span class="material-symbols-rounded">
            edit_note
          </span>
        </div>

        <div>
          <small>SHOPPING LIST</small>
          <strong>買い物メモ</strong>
        </div>

      </div>

      <section class="shopping-input-card">

        <h3>買うものを追加</h3>

        <p>
          1品ずつ入力してください。数量も一緒に書けます。
        </p>

        <div class="shopping-input-row">

          <input
            type="text"
            id="shoppingMemoInput"
            maxlength="80"
            autocomplete="off"
            placeholder="例：牛乳 2本"
          >

          <button
            type="button"
            id="shoppingMemoAddButton"
          >
            追加
          </button>

        </div>

      </section>

      <section class="shopping-list-card">

        <div class="shopping-list-heading">

          <strong>買い物リスト</strong>

          <span id="shoppingMemoCount">
            未購入 0品
          </span>

        </div>

        <div id="shoppingMemoList">

          <div class="shopping-empty">
            読み込み中…
          </div>

        </div>

      </section>

      <div class="shopping-refresh">

        <button
          type="button"
          id="shoppingRefreshButton"
        >
          <span class="material-symbols-rounded">
            refresh
          </span>

          最新の状態に更新
        </button>

      </div>
    `;

    const input =
      document.getElementById(
        "shoppingMemoInput"
      );

    const addButton =
      document.getElementById(
        "shoppingMemoAddButton"
      );

    const refreshButton =
      document.getElementById(
        "shoppingRefreshButton"
      );

    if (addButton) {
      addButton.addEventListener(
        "click",
        addShoppingMemoItem_
      );
    }

    if (input) {
      input.addEventListener(
        "keydown",
        function(event) {
          if (
            event.key === "Enter"
          ) {
            event.preventDefault();
            addShoppingMemoItem_();
          }
        }
      );
    }

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        loadShoppingMemo_
      );
    }

    shoppingMemoBuilt_ = true;
  }

  async function shoppingMemoRequest_(
    action,
    parameters
  ) {
    const query =
      new URLSearchParams();

    query.set(
      "action",
      action
    );

    Object.entries(
      parameters || {}
    ).forEach(
      function(entry) {
        query.set(
          entry[0],
          String(entry[1])
        );
      }
    );

    query.set(
      "_",
      String(
        Date.now()
      )
    );

    const response =
      await fetch(
        API_BASE +
        "?" +
        query.toString(),
        {
          method:
            "GET",
          cache:
            "no-store"
        }
      );

    const result =
      await response.json();

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.error ||
        "買い物メモを保存できませんでした"
      );
    }

    return result;
  }

  async function loadShoppingMemo_() {
    if (
      shoppingMemoLoading_
    ) {
      return;
    }

    shoppingMemoLoading_ =
      true;

    try {
      const result =
        await shoppingMemoRequest_(
          "getShoppingMemo"
        );

      shoppingMemoItems_ =
        Array.isArray(
          result.items
        )
          ? result.items
          : [];

      renderShoppingMemo_();
    }
    catch (error) {
      const list =
        document.getElementById(
          "shoppingMemoList"
        );

      if (list) {
        list.innerHTML = `
          <div class="shopping-empty">
            <strong>読み込めませんでした</strong>
            <p>
              ${shoppingEscape_(
                error.message ||
                error
              )}
            </p>
          </div>
        `;
      }
    }
    finally {
      shoppingMemoLoading_ =
        false;
    }
  }

  async function addShoppingMemoItem_() {
    const input =
      document.getElementById(
        "shoppingMemoInput"
      );

    const button =
      document.getElementById(
        "shoppingMemoAddButton"
      );

    if (!input) {
      return;
    }

    const text =
      input.value
        .replace(/\s+/g, " ")
        .trim();

    if (!text) {
      input.focus();
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent =
        "追加中…";
    }

    try {
      const result =
        await shoppingMemoRequest_(
          "addShoppingMemo",
          {
            text:
              text
          }
        );

      shoppingMemoItems_ =
        result.items || [];

      input.value = "";

      renderShoppingMemo_();
      input.focus();
    }
    catch (error) {
      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          String(
            error.message ||
            error
          )
        );
      }
    }
    finally {
      if (button) {
        button.disabled = false;
        button.textContent =
          "追加";
      }
    }
  }

  async function toggleShoppingMemoItem_(
    id,
    completed
  ) {
    try {
      const result =
        await shoppingMemoRequest_(
          "toggleShoppingMemo",
          {
            id:
              id,
            completed:
              completed
          }
        );

      shoppingMemoItems_ =
        result.items || [];

      renderShoppingMemo_();
    }
    catch (error) {
      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          String(
            error.message ||
            error
          )
        );
      }
    }
  }

  async function deleteShoppingMemoItem_(
    id
  ) {
    try {
      const result =
        await shoppingMemoRequest_(
          "deleteShoppingMemo",
          {
            id:
              id
          }
        );

      shoppingMemoItems_ =
        result.items || [];

      renderShoppingMemo_();
    }
    catch (error) {
      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          String(
            error.message ||
            error
          )
        );
      }
    }
  }

  async function clearCompletedShoppingMemo_() {
    try {
      const result =
        await shoppingMemoRequest_(
          "clearCompletedShoppingMemo"
        );

      shoppingMemoItems_ =
        result.items || [];

      renderShoppingMemo_();
    }
    catch (error) {
      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          String(
            error.message ||
            error
          )
        );
      }
    }
  }

  function renderShoppingMemo_() {
    const list =
      document.getElementById(
        "shoppingMemoList"
      );

    const count =
      document.getElementById(
        "shoppingMemoCount"
      );

    if (!list) {
      return;
    }

    const activeItems =
      shoppingMemoItems_
        .filter(
          function(item) {
            return (
              item.completed !==
              true
            );
          }
        );

    const completedItems =
      shoppingMemoItems_
        .filter(
          function(item) {
            return (
              item.completed ===
              true
            );
          }
        );

    if (count) {
      count.textContent =
        "未購入 " +
        activeItems.length +
        "品";
    }

    if (
      shoppingMemoItems_.length === 0
    ) {
      list.innerHTML = `
        <div class="shopping-empty">

          <span class="shopping-empty-icon">
            🛒
          </span>

          <strong>
            買い物メモは空です
          </strong>

          <p>
            上の欄から1品ずつ追加できます
          </p>

        </div>
      `;

      return;
    }

    function itemHtml_(
      item
    ) {
      return `
        <div
          class="
            shopping-item
            ${
              item.completed
                ? "is-completed"
                : ""
            }
          "
        >

          <button
            type="button"
            class="shopping-check"
            data-shopping-toggle="${shoppingEscape_(
              item.id
            )}"
            data-shopping-completed="${
              item.completed
                ? "true"
                : "false"
            }"
            aria-label="購入状態を変更"
          >
            <span class="material-symbols-rounded">
              check
            </span>
          </button>

          <div class="shopping-item-text">
            ${shoppingEscape_(
              item.text
            )}
          </div>

          <button
            type="button"
            class="shopping-delete"
            data-shopping-delete="${shoppingEscape_(
              item.id
            )}"
            aria-label="削除"
          >
            <span class="material-symbols-rounded">
              close
            </span>
          </button>

        </div>
      `;
    }

    let html =
      activeItems
        .map(
          itemHtml_
        )
        .join("");

    if (
      completedItems.length > 0
    ) {
      html += `
        <div class="shopping-completed-title">
          購入済み
        </div>
      `;

      html +=
        completedItems
          .map(
            itemHtml_
          )
          .join("");

      html += `
        <div class="shopping-memo-actions">

          <button
            type="button"
            id="shoppingClearCompletedButton"
          >
            購入済みをまとめて削除
          </button>

        </div>
      `;
    }

    list.innerHTML =
      html;

    list
      .querySelectorAll(
        "[data-shopping-toggle]"
      )
      .forEach(
        function(button) {
          button.addEventListener(
            "click",
            function() {
              toggleShoppingMemoItem_(
                button.dataset
                  .shoppingToggle,
                button.dataset
                  .shoppingCompleted !==
                  "true"
              );
            }
          );
        }
      );

    list
      .querySelectorAll(
        "[data-shopping-delete]"
      )
      .forEach(
        function(button) {
          button.addEventListener(
            "click",
            function() {
              deleteShoppingMemoItem_(
                button.dataset
                  .shoppingDelete
              );
            }
          );
        }
      );

    const clearButton =
      document.getElementById(
        "shoppingClearCompletedButton"
      );

    if (clearButton) {
      clearButton.addEventListener(
        "click",
        clearCompletedShoppingMemo_
      );
    }
  }

  function updateShoppingMemoLabels_() {
    const navButton =
      document.querySelector(
        '.nav-button[data-page="settings"]'
      );

    if (navButton) {
      const icon =
        navButton.querySelector(
          ".material-symbols-rounded"
        );

      const label =
        navButton.querySelector(
          ".nav-label"
        );

      if (icon) {
        icon.textContent =
          "edit_note";
      }

      if (label) {
        label.textContent =
          "メモ";
      }
    }

    if (
      typeof currentPage !==
        "undefined" &&
      currentPage ===
        "settings"
    ) {
      const kicker =
        document.getElementById(
          "pageKicker"
        );

      const title =
        document.getElementById(
          "pageTitle"
        );

      const month =
        document.getElementById(
          "currentMonth"
        );

      if (kicker) {
        kicker.textContent =
          "📝 SHOPPING MEMO";
      }

      if (title) {
        title.textContent =
          "メモ";
      }

      if (month) {
        month.textContent =
          "ふたりの買い物リスト";
      }
    }
  }

  const updatePageHeaderBeforeMemo_ =
    updatePageHeader;

  updatePageHeader =
    function () {
      updatePageHeaderBeforeMemo_();
      updateShoppingMemoLabels_();
    };

  const switchPageBeforeMemo_ =
    switchPage;

  switchPage =
    async function(page) {
      await switchPageBeforeMemo_(
        page
      );

      updateShoppingMemoLabels_();

      if (
        page === "settings"
      ) {
        if (!shoppingMemoBuilt_) {
          buildShoppingMemoPage_();
        }

        await loadShoppingMemo_();

        const input =
          document.getElementById(
            "shoppingMemoInput"
          );

        if (input) {
          input.focus();
        }
      }
    };

  buildShoppingMemoPage_();
  updateShoppingMemoLabels_();
})();
// =========================================================
// 買い物メモを自動更新
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (
    window.shoppingMemoAutoRefreshAdded_
  ) {
    return;
  }

  window.shoppingMemoAutoRefreshAdded_ =
    true;

  function refreshShoppingMemoIfOpen_() {
    if (
      typeof currentPage ===
        "undefined" ||
      currentPage !==
        "settings"
    ) {
      return;
    }

    const button =
      document.getElementById(
        "shoppingRefreshButton"
      );

    if (button) {
      button.click();
    }
  }

  // メモ画面を開いている間は15秒ごとに確認
  setInterval(
    refreshShoppingMemoIfOpen_,
    15000
  );

  // 別画面・LINEから戻ったときに確認
  document.addEventListener(
    "visibilitychange",
    function () {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refreshShoppingMemoIfOpen_();
      }
    }
  );

  window.addEventListener(
    "focus",
    refreshShoppingMemoIfOpen_
  );
})();
// =========================================================
// ホーム画面をスリム化
//
// ・今日の予定を丸ごと非表示
// ・現在の貯蓄を1行表示
// ・HOME 今月の家計を「AI 今月の家計」へ変更
// ・AIの現状と買い物アドバイスを短く表示
// =========================================================

(function () {
  "use strict";

  if (window.homeSlimAiAdded_) {
    return;
  }

  window.homeSlimAiAdded_ = true;


  // -------------------------------------------------------
  // 金額変換
  // -------------------------------------------------------

  function homeSlimNumber_(value) {
    const number =
      Number(
        String(value ?? 0)
          .replace(/,/g, "")
          .replace(/[¥￥円]/g, "")
      );

    return Number.isFinite(number)
      ? number
      : 0;
  }


  // -------------------------------------------------------
  // 金額表示
  // -------------------------------------------------------

  function homeSlimYen_(value) {
    return (
      "¥" +
      Math.round(
        homeSlimNumber_(value)
      ).toLocaleString("ja-JP")
    );
  }


  // -------------------------------------------------------
  // 短いAIアドバイスを作成
  // -------------------------------------------------------

  function createHomeSlimAdvice_() {
    if (!window.dashboardData) {
      return "家計データを確認しています";
    }

    const living =
      dashboardData.living || {};

    const budget =
      homeSlimNumber_(
        living.budget ??
        dashboardData.budget ??
        250000
      );

    const expense =
      homeSlimNumber_(
        living.expense ??
        dashboardData.expense ??
        0
      );

    const remaining =
      homeSlimNumber_(
        living.remaining ??
        dashboardData.balance ??
        (
          budget -
          expense
        )
      );

    const rate =
      budget > 0
        ? Math.round(
            expense /
            budget *
            100
          )
        : 0;

    const categories =
      Array.isArray(
        dashboardData.categories
      )
        ? dashboardData.categories
        : [];

    const topCategory =
      categories
        .filter(
          function(category) {
            const name =
              String(
                category.name || ""
              );

            return (
              name.indexOf("家賃") === -1 &&
              name.indexOf("賃料") === -1 &&
              homeSlimNumber_(
                category.amount
              ) > 0
            );
          }
        )
        .sort(
          function(a, b) {
            return (
              homeSlimNumber_(
                b.amount
              ) -
              homeSlimNumber_(
                a.amount
              )
            );
          }
        )[0];

    if (remaining < 0) {
      return (
        "予算を" +
        homeSlimYen_(
          Math.abs(remaining)
        ) +
        "超過。買い物を控えめに"
      );
    }

    if (rate >= 90) {
      return (
        "残り" +
        homeSlimYen_(remaining) +
        "。必要な物を優先"
      );
    }

    if (rate >= 75) {
      return (
        "残り" +
        homeSlimYen_(remaining) +
        "。まとめ買いは慎重に"
      );
    }

    if (topCategory) {
      return (
        String(
          topCategory.name || "支出"
        )
          .replace(
            /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu,
            ""
          )
          .trim() +
        "が多め。残り" +
        homeSlimYen_(remaining)
      );
    }

    if (expense > 0) {
      return (
        "使用率" +
        rate +
        "％。残り" +
        homeSlimYen_(remaining)
      );
    }

    return "今月の支出はまだありません";
  }


  // -------------------------------------------------------
  // 指定した要素を含むカードを取得
  // -------------------------------------------------------

  function findHomeCard_(element) {
    if (!element) {
      return null;
    }

    const homePanel =
      document.querySelector(
        '[data-page-panel="home"]'
      );

    let current =
      element;

    while (
      current &&
      current.parentElement &&
      current.parentElement !==
        homePanel
    ) {
      const parent =
        current.parentElement;

      const className =
        String(
          parent.className || ""
        ).toLowerCase();

      if (
        parent.tagName === "ARTICLE" ||
        parent.tagName === "SECTION" ||
        className.indexOf("card") !== -1
      ) {
        return parent;
      }

      current =
        parent;
    }

    return current &&
      current !== homePanel
        ? current
        : null;
  }


  // -------------------------------------------------------
  // 今日の予定を丸ごと非表示
  // -------------------------------------------------------

  function hideTodaySchedule_() {
    const scheduleList =
      document.getElementById(
        "todayScheduleList"
      );

    const calendarButton =
      document.getElementById(
        "todayCalendarButton"
      );

    const addButton =
      document.getElementById(
        "todayAddScheduleButton"
      );

    const target =
      findHomeCard_(
        scheduleList ||
        calendarButton ||
        addButton
      );

    if (target) {
      target.style.setProperty(
        "display",
        "none",
        "important"
      );
    }
  }


  // -------------------------------------------------------
  // 現在の貯蓄を1行のカードに変更
  // -------------------------------------------------------

  function slimSavingCard_() {
    const amount =
      document.getElementById(
        "savingActual"
      );

    if (!amount) {
      return;
    }

    const card =
      findHomeCard_(amount);

    if (!card) {
      return;
    }

    card.classList.add(
      "home-slim-saving-card"
    );

    amount.classList.add(
      "home-slim-saving-amount"
    );

    const textElements =
      Array.from(
        card.querySelectorAll(
          "p, small, span, div"
        )
      );

    textElements.forEach(
      function(element) {
        const text =
          String(
            element.textContent || ""
          ).trim();

        if (
          text.indexOf(
            "終了した月の残金"
          ) !== -1
        ) {
          element.style.display =
            "none";
        }
      }
    );
  }


  // -------------------------------------------------------
  // HOME 今月の家計をAI表示へ変更
  // -------------------------------------------------------

  function createSlimAiRow_() {
    const homePanel =
      document.querySelector(
        '[data-page-panel="home"]'
      );

    if (!homePanel) {
      return;
    }

    const candidates =
      Array.from(
        homePanel.querySelectorAll(
          "h1, h2, h3, h4, p, span, div"
        )
      );

    const title =
      candidates.find(
        function(element) {
          const text =
            String(
              element.textContent || ""
            )
              .replace(/\s+/g, "");

          return (
            text === "今月の家計" ||
            text === "今月の家庭"
          );
        }
      );

    if (!title) {
      return;
    }

    let row =
      title.parentElement;

    if (
      row &&
      row.parentElement &&
      row.parentElement !== homePanel &&
      row.children.length <= 2
    ) {
      row =
        row.parentElement;
    }

    if (!row) {
      return;
    }

    row.classList.add(
      "home-slim-ai-row"
    );

    row.innerHTML =
      '<div class="home-slim-ai-icon">✨</div>' +
      '<div class="home-slim-ai-copy">' +
        '<strong>AI 今月の家計</strong>' +
        '<span id="homeSlimAiAdvice"></span>' +
      '</div>';

    const advice =
      document.getElementById(
        "homeSlimAiAdvice"
      );

    if (advice) {
      advice.textContent =
        createHomeSlimAdvice_();
    }
  }


  // -------------------------------------------------------
  // 以前の大きいAIカードを非表示
  // -------------------------------------------------------

  function hideOldAiCard_() {
    const oldAdvice =
      document.getElementById(
        "aiAdvice"
      );

    const oldCard =
      findHomeCard_(oldAdvice);

    if (oldCard) {
      oldCard.style.setProperty(
        "display",
        "none",
        "important"
      );
    }
  }


  // -------------------------------------------------------
  // 画面へ反映
  // -------------------------------------------------------

  function applyHomeSlimLayout_() {
    hideTodaySchedule_();
    slimSavingCard_();
    createSlimAiRow_();
    hideOldAiCard_();

    const advice =
      document.getElementById(
        "homeSlimAiAdvice"
      );

    if (advice) {
      advice.textContent =
        createHomeSlimAdvice_();
    }
  }


  // -------------------------------------------------------
  // 専用デザイン
  // -------------------------------------------------------

  const style =
    document.createElement(
      "style"
    );

  style.textContent = `
    .home-slim-ai-row {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      min-height: 64px !important;
      margin: 12px 0 16px !important;
      padding: 10px 14px !important;
      box-sizing: border-box !important;
      border: 1px solid rgba(46, 204, 113, 0.14) !important;
      border-radius: 20px !important;
      background:
        linear-gradient(
          135deg,
          #ffffff 0%,
          #f1fff5 100%
        ) !important;
      box-shadow:
        0 10px 25px
        rgba(30, 80, 50, 0.07) !important;
    }

    .home-slim-ai-icon {
      display: grid !important;
      place-items: center !important;
      width: 38px !important;
      height: 38px !important;
      flex: 0 0 38px !important;
      border-radius: 13px !important;
      background: #e5f9eb !important;
      font-size: 18px !important;
    }

    .home-slim-ai-copy {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      min-width: 0 !important;
      width: 100% !important;
    }

    .home-slim-ai-copy strong {
      flex: 0 0 auto !important;
      color: #171717 !important;
      font-size: 14px !important;
      white-space: nowrap !important;
    }

    #homeSlimAiAdvice {
      min-width: 0 !important;
      overflow: hidden !important;
      color: #66706a !important;
      font-size: 11px !important;
      line-height: 1.35 !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    .home-slim-saving-card {
      min-height: 70px !important;
      margin-top: 12px !important;
      padding: 12px 20px !important;
      box-sizing: border-box !important;
    }

    .home-slim-saving-card > * {
      margin-top: 0 !important;
      margin-bottom: 0 !important;
    }

    .home-slim-saving-card,
    .home-slim-saving-card > div {
      align-items: center !important;
    }

    .home-slim-saving-amount {
      margin: 0 !important;
      line-height: 1 !important;
      white-space: nowrap !important;
    }

    @media (max-width: 430px) {
      .home-slim-ai-copy {
        gap: 7px !important;
      }

      .home-slim-ai-copy strong {
        font-size: 13px !important;
      }

      #homeSlimAiAdvice {
        font-size: 10px !important;
      }
    }
  `;

  document.head.appendChild(
    style
  );


  // 初回表示
  setTimeout(
    applyHomeSlimLayout_,
    300
  );

  setTimeout(
    applyHomeSlimLayout_,
    1200
  );


  // データ更新後にも表示を整える
  const observer =
    new MutationObserver(
      function() {
        clearTimeout(
          window.homeSlimLayoutTimer_
        );

        window.homeSlimLayoutTimer_ =
          setTimeout(
            applyHomeSlimLayout_,
            100
          );
      }
    );

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );


  window.addEventListener(
    "hashchange",
    function() {
      setTimeout(
        applyHomeSlimLayout_,
        100
      );
    }
  );
})();
// =========================================================
// ホーム画面スリム化・復旧版
//
// ・消えた貯蓄金額を復元
// ・現在の貯蓄を1行表示
// ・AI助言を生活費カードの直前へ確実に表示
// =========================================================

(function () {
  "use strict";

  if (window.homeSlimRepairAdded_) {
    return;
  }

  window.homeSlimRepairAdded_ = true;


  function repairYen_(value) {
    const number =
      Number(
        String(value ?? 0)
          .replace(/,/g, "")
          .replace(/[¥￥円]/g, "")
      );

    return (
      "¥" +
      (
        Number.isFinite(number)
          ? Math.round(number)
          : 0
      ).toLocaleString("ja-JP")
    );
  }


  function repairNumber_(value) {
    const number =
      Number(
        String(value ?? 0)
          .replace(/,/g, "")
          .replace(/[¥￥円]/g, "")
      );

    return Number.isFinite(number)
      ? number
      : 0;
  }


  // -------------------------------------------------------
  // 短く分かりやすいAI助言
  // -------------------------------------------------------

  function makeRepairAdvice_() {
    if (!window.dashboardData) {
      return "家計データを確認中";
    }

    const living =
      dashboardData.living || {};

    const budget =
      repairNumber_(
        living.budget ??
        dashboardData.budget ??
        250000
      );

    const expense =
      repairNumber_(
        living.expense ??
        dashboardData.expense ??
        0
      );

    const remaining =
      repairNumber_(
        living.remaining ??
        dashboardData.balance ??
        (
          budget -
          expense
        )
      );

    const rate =
      budget > 0
        ? Math.round(
            expense /
            budget *
            100
          )
        : 0;

    const categories =
      Array.isArray(
        dashboardData.categories
      )
        ? dashboardData.categories
        : [];

    const top =
      categories
        .filter(
          function(category) {
            const name =
              String(
                category.name || ""
              );

            return (
              name.indexOf("家賃") === -1 &&
              name.indexOf("賃料") === -1 &&
              repairNumber_(
                category.amount
              ) > 0
            );
          }
        )
        .sort(
          function(a, b) {
            return (
              repairNumber_(
                b.amount
              ) -
              repairNumber_(
                a.amount
              )
            );
          }
        )[0];

    if (remaining < 0) {
      return (
        "予算を" +
        repairYen_(
          Math.abs(remaining)
        ) +
        "超過。買い物を控えて"
      );
    }

    if (rate >= 90) {
      return (
        "残り" +
        repairYen_(remaining) +
        "。必要品だけ購入"
      );
    }

    if (rate >= 75) {
      return (
        "残り" +
        repairYen_(remaining) +
        "。まとめ買いは慎重に"
      );
    }

    if (top) {
      const name =
        String(
          top.name || "支出"
        )
          .replace(
            /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu,
            ""
          )
          .trim();

      return (
        name +
        "が多め。残り" +
        repairYen_(remaining)
      );
    }

    return (
      "使用率" +
      rate +
      "％。残り" +
      repairYen_(remaining)
    );
  }


  // -------------------------------------------------------
  // 消えた貯蓄金額を復元して1行化
  // -------------------------------------------------------

  function repairSavingCard_() {
    const amount =
      document.getElementById(
        "savingActual"
      );

    if (!amount) {
      return;
    }

    const card =
      amount.closest(
        ".home-slim-saving-card"
      );

    if (!card) {
      return;
    }

    // 前回誤って非表示にした親要素を復元
    let parent =
      amount.parentElement;

    while (
      parent &&
      parent !== card
    ) {
      parent.style.removeProperty(
        "display"
      );

      parent =
        parent.parentElement;
    }

    card.style.removeProperty(
      "display"
    );

    // すでに復旧済みなら金額だけ更新
    const existingRow =
      card.querySelector(
        ".home-repaired-saving-row"
      );

    if (existingRow) {
      const displayedAmount =
        existingRow.querySelector(
          "#savingActual"
        );

      if (
        displayedAmount &&
        window.dashboardData
      ) {
        const saving =
          dashboardData.saving || {};

        displayedAmount.textContent =
          repairYen_(
            saving.current ??
            saving.actual ??
            0
          );
      }

      return;
    }

    const editButton =
      card.querySelector(
        "button"
      );

    // 元の内容を画面上だけ非表示
    Array.from(
      card.children
    ).forEach(
      function(child) {
        child.style.setProperty(
          "display",
          "none",
          "important"
        );
      }
    );

    const row =
      document.createElement(
        "div"
      );

    row.className =
      "home-repaired-saving-row";

    const icon =
      document.createElement(
        "div"
      );

    icon.className =
      "home-repaired-saving-icon";

    icon.textContent =
      "🐷";

    const label =
      document.createElement(
        "span"
      );

    label.className =
      "home-repaired-saving-label";

    label.textContent =
      "現在の貯蓄";

    const right =
      document.createElement(
        "div"
      );

    right.className =
      "home-repaired-saving-right";

    // 元の金額要素を移動するため、
    // データ更新や編集機能をそのまま維持
    amount.style.removeProperty(
      "display"
    );

    amount.className +=
      " home-repaired-saving-amount";

    right.appendChild(
      amount
    );

    if (editButton) {
      editButton.style.removeProperty(
        "display"
      );

      editButton.classList.add(
        "home-repaired-saving-edit"
      );

      right.appendChild(
        editButton
      );
    }

    row.appendChild(icon);
    row.appendChild(label);
    row.appendChild(right);

    card.appendChild(row);
  }


  // -------------------------------------------------------
  // AI助言を生活費カードの直前に新設
  // -------------------------------------------------------

  function repairAiRow_() {
    const homePanel =
      document.querySelector(
        '[data-page-panel="home"]'
      );

    const totalMoney =
      document.getElementById(
        "totalMoney"
      );

    if (
      !homePanel ||
      !totalMoney
    ) {
      return;
    }

    let budgetCard =
      totalMoney.closest(
        "[class*='card'], article, section"
      );

    if (!budgetCard) {
      budgetCard =
        totalMoney.parentElement;
    }

    if (
      !budgetCard ||
      !budgetCard.parentElement
    ) {
      return;
    }

    let aiRow =
      document.getElementById(
        "homeAiSummaryRow"
      );

    if (!aiRow) {
      aiRow =
        document.createElement(
          "div"
        );

      aiRow.id =
        "homeAiSummaryRow";

      aiRow.innerHTML =
        '<div class="home-ai-summary-icon">✨</div>' +
        '<strong>AI 今月の家計</strong>' +
        '<span id="homeAiSummaryAdvice"></span>';

      budgetCard.parentElement.insertBefore(
        aiRow,
        budgetCard
      );
    }

    // 元の「HOME 今月の家計」見出しを非表示
    let previous =
      aiRow.previousElementSibling;

    if (
      previous &&
      previous !== budgetCard
    ) {
      const text =
        String(
          previous.textContent || ""
        )
          .replace(/\s+/g, "");

      if (
        text.indexOf("HOME") !== -1 ||
        text.indexOf("今月の家計") !== -1 ||
        text.indexOf("今月の家庭") !== -1
      ) {
        previous.style.setProperty(
          "display",
          "none",
          "important"
        );
      }
    }

    const advice =
      document.getElementById(
        "homeAiSummaryAdvice"
      );

    if (advice) {
      const newText =
        makeRepairAdvice_();

      if (
        advice.textContent !==
        newText
      ) {
        advice.textContent =
          newText;
      }
    }
  }


  function applyHomeRepair_() {
    repairSavingCard_();
    repairAiRow_();
  }


  // -------------------------------------------------------
  // 復旧版デザイン
  // -------------------------------------------------------

  const style =
    document.createElement(
      "style"
    );

  style.textContent = `
    #homeAiSummaryRow {
      display: flex !important;
      align-items: center !important;
      gap: 9px !important;
      width: 100% !important;
      min-height: 58px !important;
      margin: 0 0 14px !important;
      padding: 9px 14px !important;
      box-sizing: border-box !important;
      border: 1px solid rgba(42, 203, 105, 0.14) !important;
      border-radius: 18px !important;
      background:
        linear-gradient(
          135deg,
          #ffffff,
          #effff4
        ) !important;
      box-shadow:
        0 8px 22px
        rgba(25, 70, 45, 0.06) !important;
    }

    .home-ai-summary-icon {
      display: grid !important;
      place-items: center !important;
      width: 36px !important;
      height: 36px !important;
      flex: 0 0 36px !important;
      border-radius: 12px !important;
      background: #e2f8e9 !important;
      font-size: 17px !important;
    }

    #homeAiSummaryRow strong {
      flex: 0 0 auto !important;
      color: #151515 !important;
      font-size: 13px !important;
      white-space: nowrap !important;
    }

    #homeAiSummaryAdvice {
      min-width: 0 !important;
      overflow: hidden !important;
      color: #66706a !important;
      font-size: 10px !important;
      line-height: 1.3 !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    .home-slim-saving-card {
      display: block !important;
      min-height: 72px !important;
      padding: 10px 20px !important;
    }

    .home-repaired-saving-row {
      display: flex !important;
      align-items: center !important;
      width: 100% !important;
      min-height: 50px !important;
      gap: 11px !important;
    }

    .home-repaired-saving-icon {
      display: grid !important;
      place-items: center !important;
      width: 40px !important;
      height: 40px !important;
      flex: 0 0 40px !important;
      border-radius: 14px !important;
      background: #ddf8e6 !important;
      font-size: 20px !important;
    }

    .home-repaired-saving-label {
      flex: 1 1 auto !important;
      color: #555f59 !important;
      font-size: 12px !important;
      white-space: nowrap !important;
    }

    .home-repaired-saving-right {
      display: flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 7px !important;
      margin-left: auto !important;
    }

    .home-repaired-saving-amount {
      display: inline-block !important;
      margin: 0 !important;
      color: #151515 !important;
      font-size: 24px !important;
      font-weight: 800 !important;
      line-height: 1 !important;
      white-space: nowrap !important;
    }

    .home-repaired-saving-edit {
      display: grid !important;
      place-items: center !important;
      margin: 0 !important;
      flex: 0 0 auto !important;
    }

    @media (max-width: 430px) {
      #homeAiSummaryRow {
        gap: 7px !important;
        padding-left: 11px !important;
        padding-right: 11px !important;
      }

      #homeAiSummaryRow strong {
        font-size: 12px !important;
      }

      #homeAiSummaryAdvice {
        font-size: 9px !important;
      }

      .home-repaired-saving-amount {
        font-size: 21px !important;
      }
    }
  `;

  document.head.appendChild(
    style
  );


  setTimeout(
    applyHomeRepair_,
    200
  );

  setTimeout(
    applyHomeRepair_,
    1000
  );

  setTimeout(
    applyHomeRepair_,
    2500
  );


  window.addEventListener(
    "hashchange",
    function() {
      setTimeout(
        applyHomeRepair_,
        200
      );
    }
  );


  // 家計データが更新された後も金額と助言を更新
  setInterval(
    applyHomeRepair_,
    3000
  );
})();
// =========================================================
// AI助言の読み込み修正＋鈴を更新ボタンへ変更
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (window.aiAdviceRefreshRepairAdded_) {
    return;
  }

  window.aiAdviceRefreshRepairAdded_ =
    true;


  function adviceNumber_(value) {
    const number =
      Number(
        String(value ?? 0)
          .replace(/,/g, "")
          .replace(/[¥￥円]/g, "")
      );

    return Number.isFinite(number)
      ? number
      : 0;
  }


  function adviceYen_(value) {
    return (
      "¥" +
      Math.round(
        adviceNumber_(value)
      ).toLocaleString("ja-JP")
    );
  }


  // -------------------------------------------------------
  // 家計データを正しい場所から取得
  // -------------------------------------------------------

  function getAdviceDashboard_() {
    if (
      typeof dashboardData !==
        "undefined" &&
      dashboardData
    ) {
      // 前回のコードでも取得できるように同期
      window.dashboardData =
        dashboardData;

      return dashboardData;
    }

    return null;
  }


  // -------------------------------------------------------
  // 短い現状・買い物アドバイスを作成
  // -------------------------------------------------------

  function createWorkingAdvice_() {
    const data =
      getAdviceDashboard_();

    if (!data) {
      return "更新ボタンで家計を取得してください";
    }

    const living =
      data.living || {};

    const budget =
      adviceNumber_(
        living.budget ??
        data.budget ??
        250000
      );

    const expense =
      adviceNumber_(
        living.expense ??
        data.expense ??
        0
      );

    const remaining =
      adviceNumber_(
        living.remaining ??
        data.balance ??
        (
          budget -
          expense
        )
      );

    const rate =
      budget > 0
        ? Math.round(
            expense /
            budget *
            100
          )
        : 0;

    const categories =
      Array.isArray(
        data.categories
      )
        ? data.categories
        : [];

    const topCategory =
      categories
        .filter(
          function(category) {
            const name =
              String(
                category.name || ""
              );

            return (
              name.indexOf("家賃") === -1 &&
              name.indexOf("賃料") === -1 &&
              adviceNumber_(
                category.amount
              ) > 0
            );
          }
        )
        .sort(
          function(a, b) {
            return (
              adviceNumber_(
                b.amount
              ) -
              adviceNumber_(
                a.amount
              )
            );
          }
        )[0];

    if (remaining < 0) {
      return (
        "予算を" +
        adviceYen_(
          Math.abs(remaining)
        ) +
        "超過。買い物を控えて"
      );
    }

    if (rate >= 90) {
      return (
        "残り" +
        adviceYen_(remaining) +
        "。必要品だけ購入"
      );
    }

    if (rate >= 75) {
      return (
        "残り" +
        adviceYen_(remaining) +
        "。まとめ買いは慎重に"
      );
    }

    if (topCategory) {
      const categoryName =
        String(
          topCategory.name || "支出"
        )
          .replace(
            /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu,
            ""
          )
          .trim();

      return (
        categoryName +
        "が多め。残り" +
        adviceYen_(remaining)
      );
    }

    if (expense === 0) {
      return "今月の支出はまだありません";
    }

    return (
      "使用率" +
      rate +
      "％。残り" +
      adviceYen_(remaining)
    );
  }


  // -------------------------------------------------------
  // AI欄を更新
  // -------------------------------------------------------

  function updateWorkingAdvice_() {
    const advice =
      document.getElementById(
        "homeAiSummaryAdvice"
      );

    if (!advice) {
      return;
    }

    const text =
      createWorkingAdvice_();

    if (
      advice.textContent !== text
    ) {
      advice.textContent =
        text;
    }
  }


  // -------------------------------------------------------
  // 鈴を更新ボタンへ変更
  // -------------------------------------------------------

  function changeBellToRefresh_() {
    const button =
      document.getElementById(
        "notificationButton"
      );

    if (!button) {
      return;
    }

    button.setAttribute(
      "aria-label",
      "最新データに更新"
    );

    button.setAttribute(
      "title",
      "最新データに更新"
    );

    button.classList.add(
      "family-refresh-button"
    );

    let icon =
      button.querySelector(
        ".material-symbols-rounded"
      );

    if (!icon) {
      icon =
        document.createElement(
          "span"
        );

      icon.className =
        "material-symbols-rounded";

      button.innerHTML = "";

      button.appendChild(icon);
    }

    icon.textContent =
      "refresh";

    if (
      button.dataset.refreshRepairAdded ===
      "true"
    ) {
      return;
    }

    button.dataset.refreshRepairAdded =
      "true";

    // 元の鈴ボタン処理より先に実行
    button.addEventListener(
      "click",
      async function(event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (
          button.classList.contains(
            "is-refreshing"
          )
        ) {
          return;
        }

        button.classList.add(
          "is-refreshing"
        );

        icon.textContent =
          "progress_activity";

        const advice =
          document.getElementById(
            "homeAiSummaryAdvice"
          );

        if (advice) {
          advice.textContent =
            "最新データを確認中";
        }

        try {
          if (
            typeof loadDashboard ===
            "function"
          ) {
            await loadDashboard();
          }

          getAdviceDashboard_();
          updateWorkingAdvice_();

          if (
            typeof showToast ===
            "function"
          ) {
            showToast(
              "最新データに更新しました"
            );
          }
        }
        catch (error) {
          console.error(
            "家計更新エラー:",
            error
          );

          if (advice) {
            advice.textContent =
              "更新できませんでした";
          }

          if (
            typeof showToast ===
            "function"
          ) {
            showToast(
              "更新できませんでした"
            );
          }
        }
        finally {
          button.classList.remove(
            "is-refreshing"
          );

          icon.textContent =
            "refresh";
        }
      },
      true
    );
  }


  // -------------------------------------------------------
  // 画面へ反映
  // -------------------------------------------------------

  function applyAdviceRefreshRepair_() {
    getAdviceDashboard_();
    changeBellToRefresh_();
    updateWorkingAdvice_();
  }


  const style =
    document.createElement(
      "style"
    );

  style.textContent = `
    .family-refresh-button {
      cursor: pointer !important;
    }

    .family-refresh-button
    .material-symbols-rounded {
      transition:
        transform 0.25s ease !important;
    }

    .family-refresh-button.is-refreshing
    .material-symbols-rounded {
      animation:
        family-refresh-spin
        0.8s linear infinite !important;
    }

    @keyframes family-refresh-spin {
      from {
        transform: rotate(0deg);
      }

      to {
        transform: rotate(360deg);
      }
    }
  `;

  document.head.appendChild(
    style
  );


  setTimeout(
    applyAdviceRefreshRepair_,
    100
  );

  setTimeout(
    applyAdviceRefreshRepair_,
    700
  );

  setTimeout(
    applyAdviceRefreshRepair_,
    1800
  );


  // データ取得後もAI助言を更新
  setInterval(
    applyAdviceRefreshRepair_,
    1000
  );


  window.addEventListener(
    "hashchange",
    function() {
      setTimeout(
        applyAdviceRefreshRepair_,
        100
      );
    }
  );
})();
// =========================================================
// スマート家計助言＋生活費予算編集
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (window.smartBudgetAdviceAdded_) {
    return;
  }

  window.smartBudgetAdviceAdded_ =
    true;


  function smartNumber_(value) {
    const number =
      Number(
        String(value ?? 0)
          .replace(/,/g, "")
          .replace(/[¥￥円]/g, "")
      );

    return Number.isFinite(number)
      ? number
      : 0;
  }


  function smartYen_(value) {
    return (
      "¥" +
      Math.max(
        0,
        Math.round(
          smartNumber_(value)
        )
      ).toLocaleString("ja-JP")
    );
  }


  function getSmartDashboard_() {
    if (
      typeof dashboardData !==
        "undefined" &&
      dashboardData
    ) {
      window.dashboardData =
        dashboardData;

      return dashboardData;
    }

    return null;
  }


  // -------------------------------------------------------
  // 残り日数・予算・カテゴリから助言を作成
  // -------------------------------------------------------

  function createSmartAdvice_() {
    const data =
      getSmartDashboard_();

    if (!data) {
      return "右上の更新ボタンを押してください";
    }

    const living =
      data.living || {};

    const budget =
      smartNumber_(
        living.budget ??
        data.budget ??
        250000
      );

    const expense =
      smartNumber_(
        living.expense ??
        data.expense ??
        0
      );

    const remaining =
      smartNumber_(
        living.remaining ??
        data.balance ??
        (
          budget -
          expense
        )
      );

    const now =
      new Date();

    const lastDay =
      new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();

    const daysLeft =
      Math.max(
        1,
        lastDay -
        now.getDate() +
        1
      );

    const dailyAllowance =
      remaining > 0
        ? Math.floor(
            remaining /
            daysLeft
          )
        : 0;

    const categories =
      Array.isArray(
        data.categories
      )
        ? data.categories
        : [];

    const variableCategories =
      categories
        .filter(
          function(category) {
            const name =
              String(
                category.name || ""
              );

            return (
              name.indexOf("家賃") === -1 &&
              name.indexOf("賃料") === -1 &&
              smartNumber_(
                category.amount
              ) > 0
            );
          }
        )
        .sort(
          function(a, b) {
            return (
              smartNumber_(
                b.amount
              ) -
              smartNumber_(
                a.amount
              )
            );
          }
        );

    const overCategory =
      variableCategories.find(
        function(category) {
          const categoryBudget =
            smartNumber_(
              category.budget
            );

          const categoryAmount =
            smartNumber_(
              category.amount
            );

          return (
            categoryBudget > 0 &&
            categoryAmount /
            categoryBudget >= 0.9
          );
        }
      );

    const topCategory =
      variableCategories[0];

    if (remaining < 0) {
      return (
        "予算を" +
        smartYen_(
          Math.abs(remaining)
        ) +
        "超過。今月は必要品だけ"
      );
    }

    if (overCategory) {
      const name =
        String(
          overCategory.name || "支出"
        )
          .replace(
            /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu,
            ""
          )
          .trim();

      return (
        name +
        "が予算間近。残り" +
        daysLeft +
        "日は1日" +
        smartYen_(dailyAllowance) +
        "まで"
      );
    }

    if (topCategory) {
      const name =
        String(
          topCategory.name || "支出"
        )
          .replace(
            /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu,
            ""
          )
          .trim();

      let shoppingAdvice =
        "買い物メモを優先";

      if (
        name.indexOf("外食") !== -1
      ) {
        shoppingAdvice =
          "外食回数を抑えると安心";
      }
      else if (
        name.indexOf("日用品") !== -1
      ) {
        shoppingAdvice =
          "在庫確認してから購入";
      }
      else if (
        name.indexOf("洋服") !== -1
      ) {
        shoppingAdvice =
          "買い足しは慎重に";
      }

      return (
        "残り" +
        daysLeft +
        "日、1日" +
        smartYen_(dailyAllowance) +
        "まで。" +
        name +
        "が最多、" +
        shoppingAdvice
      );
    }

    return (
      "残り" +
      daysLeft +
      "日、1日" +
      smartYen_(dailyAllowance) +
      "まで使えます"
    );
  }


  // -------------------------------------------------------
  // AIという見出しを消して助言だけ表示
  // -------------------------------------------------------

  function updateSmartAdvice_() {
    const row =
      document.getElementById(
        "homeAiSummaryRow"
      );

    if (!row) {
      return;
    }

    const oldTitle =
      row.querySelector(
        "strong"
      );

    if (oldTitle) {
      oldTitle.style.setProperty(
        "display",
        "none",
        "important"
      );
    }

    let advice =
      document.getElementById(
        "smartHomeAdvice"
      );

    if (!advice) {
      const oldAdvice =
        document.getElementById(
          "homeAiSummaryAdvice"
        );

      if (oldAdvice) {
        // 前のAI処理から切り離す
        oldAdvice.id =
          "smartHomeAdvice";

        advice =
          oldAdvice;
      }
    }

    if (advice) {
      advice.textContent =
        createSmartAdvice_();
    }
  }


  // -------------------------------------------------------
  // 予算編集ボタン
  // -------------------------------------------------------

  function addBudgetEditButton_() {
    const budgetMoney =
      document.getElementById(
        "budgetMoney"
      );

    if (!budgetMoney) {
      return;
    }

    if (
      document.getElementById(
        "monthlyBudgetEditButton"
      )
    ) {
      return;
    }

    const button =
      document.createElement(
        "button"
      );

    button.id =
      "monthlyBudgetEditButton";

    button.type =
      "button";

    button.title =
      "生活費予算を変更";

    button.setAttribute(
      "aria-label",
      "生活費予算を変更"
    );

    button.innerHTML =
      '<span class="material-symbols-rounded">edit</span>';

    budgetMoney.insertAdjacentElement(
      "afterend",
      button
    );

    button.addEventListener(
      "click",
      async function() {
        const data =
          getSmartDashboard_();

        const currentBudget =
          smartNumber_(
            data?.living?.budget ??
            data?.budget ??
            250000
          );

        const entered =
          window.prompt(
            "毎月の生活費予算を入力してください",
            String(currentBudget)
          );

        if (entered === null) {
          return;
        }

        const newBudget =
          Math.round(
            smartNumber_(entered)
          );

        if (
          newBudget < 10000 ||
          newBudget > 10000000
        ) {
          if (
            typeof showToast ===
            "function"
          ) {
            showToast(
              "1万円以上で入力してください"
            );
          }

          return;
        }

        button.disabled =
          true;

        button.classList.add(
          "is-saving"
        );

        try {
          const result =
            await fetchJson(
              API_BASE +
              "?action=saveMonthlyBudget" +
              "&budget=" +
              encodeURIComponent(
                newBudget
              ) +
              "&_=" +
              Date.now()
            );

          if (
            !result ||
            result.success !== true
          ) {
            throw new Error(
              result?.error ||
              "予算を保存できませんでした"
            );
          }

          if (
            typeof loadDashboard ===
            "function"
          ) {
            await loadDashboard();
          }

          updateSmartAdvice_();

          if (
            typeof showToast ===
            "function"
          ) {
            showToast(
              "生活費予算を" +
              smartYen_(newBudget) +
              "へ変更しました"
            );
          }
        }
        catch (error) {
          console.error(
            "予算保存エラー:",
            error
          );

          if (
            typeof showToast ===
            "function"
          ) {
            showToast(
              "予算を保存できませんでした"
            );
          }
        }
        finally {
          button.disabled =
            false;

          button.classList.remove(
            "is-saving"
          );
        }
      }
    );
  }


  function applySmartBudgetAdvice_() {
    getSmartDashboard_();
    updateSmartAdvice_();
    addBudgetEditButton_();
  }


  const style =
    document.createElement(
      "style"
    );

  style.textContent = `
    #homeAiSummaryRow > strong {
      display: none !important;
    }

    #smartHomeAdvice {
      display: block !important;
      flex: 1 1 auto !important;
      width: 100% !important;
      overflow: hidden !important;
      color: #26312a !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      line-height: 1.4 !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    #monthlyBudgetEditButton {
      display: inline-grid !important;
      place-items: center !important;
      width: 24px !important;
      height: 24px !important;
      margin: 2px 0 0 6px !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 9px !important;
      background: #e8f8ed !important;
      color: #25bd5d !important;
      cursor: pointer !important;
      vertical-align: middle !important;
    }

    #monthlyBudgetEditButton
    .material-symbols-rounded {
      font-size: 14px !important;
    }

    #monthlyBudgetEditButton.is-saving
    .material-symbols-rounded {
      animation:
        budget-edit-spin
        0.8s linear infinite !important;
    }

    @keyframes budget-edit-spin {
      from {
        transform: rotate(0deg);
      }

      to {
        transform: rotate(360deg);
      }
    }
  `;

  document.head.appendChild(
    style
  );


  setTimeout(
    applySmartBudgetAdvice_,
    200
  );

  setTimeout(
    applySmartBudgetAdvice_,
    1000
  );

  setInterval(
    applySmartBudgetAdvice_,
    2000
  );

  window.addEventListener(
    "hashchange",
    function() {
      setTimeout(
        applySmartBudgetAdvice_,
        200
      );
    }
  );
})();
// =========================================================
// 保存済み予算を全ページへ確実に反映
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (window.sharedBudgetDisplayRepairAdded_) {
    return;
  }

  window.sharedBudgetDisplayRepairAdded_ =
    true;


  // -------------------------------------------------------
  // 保存済み予算を専用APIから取得
  // -------------------------------------------------------

  async function loadSavedMonthlyBudget_() {
    const result =
      await fetchJson(
        API_BASE +
        "?mode=monthlyBudget" +
        "&_=" +
        Date.now()
      );

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.error ||
        "保存済み予算を取得できません"
      );
    }

    const budget =
      Math.round(
        Number(
          result.budget
        )
      );

    if (
      !Number.isFinite(budget) ||
      budget < 10000
    ) {
      throw new Error(
        "保存済み予算が正しくありません"
      );
    }

    return budget;
  }


  // -------------------------------------------------------
  // 家計データへ保存済み予算を合成
  // -------------------------------------------------------

  function applySavedBudgetToData_(
    budget
  ) {
    if (
      typeof dashboardData ===
        "undefined" ||
      !dashboardData
    ) {
      return;
    }

    const living =
      dashboardData.living || {};

    const expense =
      Number(
        living.expense ??
        dashboardData.expense ??
        0
      ) || 0;

    const remaining =
      budget - expense;

    const rate =
      budget > 0
        ? Math.round(
            expense /
            budget *
            100
          )
        : 0;

    dashboardData.budget =
      budget;

    dashboardData.balance =
      remaining;

    dashboardData.living =
      living;

    dashboardData.living.budget =
      budget;

    dashboardData.living.expense =
      expense;

    dashboardData.living.remaining =
      remaining;

    dashboardData.living.rate =
      rate;

    // 既存の予算初期値も更新
    if (
      typeof SETTINGS !==
        "undefined" &&
      SETTINGS
    ) {
      SETTINGS.monthlyBudget =
        budget;
    }

    window.dashboardData =
      dashboardData;
  }


  // -------------------------------------------------------
  // 全ページを同じ予算で再描画
  // -------------------------------------------------------

  function redrawAllPagesWithBudget_() {
    if (
      typeof renderHome ===
      "function"
    ) {
      renderHome();
    }

    if (
      typeof renderReport ===
      "function"
    ) {
      renderReport();
    }

    if (
      typeof saveDashboardCache ===
      "function"
    ) {
      saveDashboardCache();
    }

    // 現在表示中の金額も直接更新
    const budgetMoney =
      document.getElementById(
        "budgetMoney"
      );

    if (
      budgetMoney &&
      dashboardData?.living
    ) {
      budgetMoney.textContent =
        "¥" +
        Number(
          dashboardData.living.budget
        ).toLocaleString("ja-JP");
    }

    const balanceMoney =
      document.getElementById(
        "balanceMoney"
      );

    if (
      balanceMoney &&
      dashboardData?.living
    ) {
      balanceMoney.textContent =
        "¥" +
        Number(
          dashboardData.living.remaining
        ).toLocaleString("ja-JP");
    }

    const budgetPercent =
      document.getElementById(
        "budgetPercent"
      );

    if (
      budgetPercent &&
      dashboardData?.living
    ) {
      budgetPercent.textContent =
        Math.round(
          dashboardData.living.rate
        ) +
        "%";
    }

    const progressBar =
      document.getElementById(
        "progressBar"
      );

    if (
      progressBar &&
      dashboardData?.living
    ) {
      progressBar.style.width =
        Math.min(
          100,
          Math.max(
            0,
            dashboardData.living.rate
          )
        ) +
        "%";
    }
  }


  // -------------------------------------------------------
  // 保存済み予算を同期
  // -------------------------------------------------------

  async function synchronizeSavedBudget_() {
    try {
      const budget =
        await loadSavedMonthlyBudget_();

      applySavedBudgetToData_(
        budget
      );

      redrawAllPagesWithBudget_();

      return budget;
    }
    catch (error) {
      console.error(
        "共有予算取得エラー:",
        error
      );

      return null;
    }
  }


  // -------------------------------------------------------
  // 通常の家計データ取得後に必ず予算を合成
  // -------------------------------------------------------

  if (
    typeof loadDashboard ===
    "function"
  ) {
    const loadDashboardBeforeBudgetRepair_ =
      loadDashboard;

    loadDashboard =
      async function() {
        await loadDashboardBeforeBudgetRepair_();

        await synchronizeSavedBudget_();

        return dashboardData;
      };
  }


  // 初回表示にも反映
  setTimeout(
    synchronizeSavedBudget_,
    300
  );

  setTimeout(
    synchronizeSavedBudget_,
    1500
  );


  // ページ移動時にも同じ予算を反映
  window.addEventListener(
    "hashchange",
    function() {
      setTimeout(
        synchronizeSavedBudget_,
        200
      );
    }
  );


  // 更新ボタンを押した後にも同期
  document.addEventListener(
    "click",
    function(event) {
      const refreshButton =
        event.target.closest(
          "#notificationButton"
        );

      if (refreshButton) {
        setTimeout(
          synchronizeSavedBudget_,
          1000
        );
      }
    },
    true
  );
})();
// =========================================================
// カテゴリ別予算の編集ボタン
// 空欄で「予算未設定」へ戻す
// app.jsの一番最後へ追加
// =========================================================

(function () {
  "use strict";

  if (window.categoryBudgetEditorAdded_) {
    return;
  }

  window.categoryBudgetEditorAdded_ =
    true;


  function categoryBudgetNumber_(value) {
    const number =
      Number(
        String(value ?? "")
          .replace(/,/g, "")
          .replace(/[¥￥円]/g, "")
      );

    return Number.isFinite(number)
      ? number
      : 0;
  }


  function categoryBudgetName_(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(
        /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu,
        ""
      )
      .replace(/[\uFE0E\uFE0F]/g, "")
      .replace(/\s+/g, "")
      .trim();
  }


  function findCategoryData_(
    name
  ) {
    if (
      typeof dashboardData ===
        "undefined" ||
      !dashboardData ||
      !Array.isArray(
        dashboardData.categories
      )
    ) {
      return null;
    }

    const target =
      categoryBudgetName_(name);

    return (
      dashboardData.categories.find(
        function(category) {
          return (
            categoryBudgetName_(
              category.name
            ) === target
          );
        }
      ) ||
      null
    );
  }


  async function openCategoryBudgetEditor_(
    categoryName
  ) {
    const category =
      findCategoryData_(
        categoryName
      );

    const cleanName =
      categoryBudgetName_(
        categoryName
      );

    const currentBudget =
      categoryBudgetNumber_(
        category?.budget
      );

    const entered =
      window.prompt(
        cleanName +
        "の月予算を入力してください\n" +
        "未設定に戻す場合は空欄のままOKを押してください",
        currentBudget > 0
          ? String(currentBudget)
          : ""
      );

    if (entered === null) {
      return;
    }

    const trimmed =
      String(entered)
        .trim();

    const unset =
      trimmed === "" ||
      trimmed === "未設定";

    const budget =
      unset
        ? 0
        : Math.round(
            categoryBudgetNumber_(
              trimmed
            )
          );

    if (
      !unset &&
      (
        budget < 0 ||
        budget > 10000000
      )
    ) {
      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          "正しい予算金額を入力してください"
        );
      }

      return;
    }

    try {
      const result =
        await fetchJson(
          API_BASE +
          "?action=saveCategoryBudget" +
          "&category=" +
          encodeURIComponent(
            cleanName
          ) +
          "&budget=" +
          encodeURIComponent(
            unset
              ? ""
              : budget
          ) +
          "&unset=" +
          (
            unset
              ? "1"
              : "0"
          ) +
          "&_=" +
          Date.now()
        );

      if (
        !result ||
        result.success !== true
      ) {
        throw new Error(
          result?.error ||
          "カテゴリ予算を保存できませんでした"
        );
      }

      if (
        typeof loadDashboard ===
        "function"
      ) {
        await loadDashboard();
      }

      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          unset
            ? cleanName +
              "の予算を未設定にしました"
            : cleanName +
              "の予算を¥" +
              budget.toLocaleString(
                "ja-JP"
              ) +
              "へ変更しました"
        );
      }
    }
    catch (error) {
      console.error(
        "カテゴリ予算保存エラー:",
        error
      );

      if (
        typeof showToast ===
        "function"
      ) {
        showToast(
          "保存できませんでした：" +
          String(
            error.message ||
            error
          )
        );
      }
    }
  }


  function addCategoryBudgetButtons_() {
    const container =
      document.getElementById(
        "categoryList"
      );

    if (!container) {
      return;
    }

    container
      .querySelectorAll(
        ".category-item"
      )
      .forEach(
        function(row) {
          if (
            row.querySelector(
              ".category-budget-edit"
            )
          ) {
            return;
          }

          const nameElement =
            row.querySelector(
              ".category-name"
            );

          const top =
            row.querySelector(
              ".category-top"
            );

          if (
            !nameElement ||
            !top
          ) {
            return;
          }

          const categoryName =
            nameElement.textContent || "";

          const button =
            document.createElement(
              "button"
            );

          button.type =
            "button";

          button.className =
            "category-budget-edit";

          button.title =
            "カテゴリ予算を変更";

          button.setAttribute(
            "aria-label",
            categoryBudgetName_(
              categoryName
            ) +
            "の予算を変更"
          );

          button.innerHTML =
            '<span class="material-symbols-rounded">edit</span>';

          button.addEventListener(
            "click",
            function(event) {
              event.preventDefault();
              event.stopPropagation();

              openCategoryBudgetEditor_(
                categoryName
              );
            }
          );

          button.addEventListener(
            "keydown",
            function(event) {
              event.stopPropagation();
            }
          );

          top.appendChild(
            button
          );
        }
      );
  }


  // カテゴリ再描画後にも鉛筆を追加
  if (
    typeof renderCategoryList ===
    "function"
  ) {
    const renderCategoryListBeforeBudgetEdit_ =
      renderCategoryList;

    renderCategoryList =
      function(
        container,
        categories
      ) {
        renderCategoryListBeforeBudgetEdit_(
          container,
          categories
        );

        if (
          container &&
          container.id === "categoryList"
        ) {
          addCategoryBudgetButtons_();
        }
      };
  }


  const style =
    document.createElement(
      "style"
    );

  style.textContent = `
    #categoryList .category-top {
      display: flex !important;
      align-items: center !important;
    }

    #categoryList .category-name {
      min-width: 0 !important;
      margin-right: auto !important;
    }

    #categoryList .category-amount {
      margin-left: 8px !important;
      white-space: nowrap !important;
    }

    .category-budget-edit {
      display: inline-grid !important;
      place-items: center !important;
      width: 25px !important;
      height: 25px !important;
      flex: 0 0 25px !important;
      margin-left: 6px !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 8px !important;
      background: #edf8f0 !important;
      color: #25ae52 !important;
      cursor: pointer !important;
    }

    .category-budget-edit
    .material-symbols-rounded {
      font-size: 14px !important;
    }
  `;

  document.head.appendChild(
    style
  );


  setTimeout(
    addCategoryBudgetButtons_,
    300
  );

  setTimeout(
    addCategoryBudgetButtons_,
    1200
  );

  window.addEventListener(
    "hashchange",
    function() {
      setTimeout(
        addCategoryBudgetButtons_,
        200
      );
    }
  );
})();
