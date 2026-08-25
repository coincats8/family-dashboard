// =========================================================
// Family Dashboard
// app.js
// v2.0
//
// ・ホーム
// ・レシート
// ・レポート
// ・夫婦カレンダー
// ・設定
//
// 家計開始：2026年8月
// 月予算：250,000円
// =========================================================


// =========================================================
// API
// =========================================================

const API_BASE =
  "https://script.google.com/macros/s/AKfycbxfmSB9YZCQ5aWsU5yyl3DB2dB6egoz5Y5noF0zGM2cc7ID3jl0DuMh0uNWlguM67s/exec";


const DASHBOARD_API =
  `${API_BASE}?mode=dashboard`;


// =========================================================
// SETTINGS
// =========================================================

const SETTINGS = {

  refreshInterval:
    60000,

  monthlyBudget:
    250000,

  startYear:
    2026,

  startMonth:
    8

};


// =========================================================
// STATE
// =========================================================

let dashboardData =
  null;


let receiptData =
  [];


let scheduleData =
  [];


let currentPage =
  "home";


let receiptDate =
  new Date();


let calendarDate =
  new Date();


let selectedCalendarDate =
  null;


let refreshTimer =
  null;


// =========================================================
// MONEY
// =========================================================

function yen(value) {

  return (
    "¥" +
    (
      Number(value) ||
      0
    ).toLocaleString(
      "ja-JP"
    )
  );

}


// =========================================================
// HTML ESCAPE
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
// COLOR
// =========================================================

function safeColor(value) {

  const color =
    String(
      value || ""
    ).trim();


  if (
    /^#[0-9a-fA-F]{6}$/.test(
      color
    ) ||
    /^#[0-9a-fA-F]{3}$/.test(
      color
    )
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


  return (
    `${year}-${month}-${day}`
  );

}


// =========================================================
// FORMAT DATE
// =========================================================

function formatDate(value) {

  if (!value) {

    return "";

  }


  const match =
    String(value)
      .match(
        /^(\d{4})-(\d{2})-(\d{2})/
      );


  if (match) {

    return (
      `${Number(match[2])}/${Number(match[3])}`
    );

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

    return String(value);

  }


  return (
    `${date.getMonth() + 1}/${date.getDate()}`
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


  const response =
    await fetch(
      `${url}${separator}_=${Date.now()}`,
      {

        method:
          "GET",

        cache:
          "no-store",

        redirect:
          "follow"

      }
    );


  if (
    !response.ok
  ) {

    throw new Error(
      `HTTP ${response.status}`
    );

  }


  return await response.json();

}


// =========================================================
// LOAD DASHBOARD
// =========================================================

async function loadDashboard() {

  try {

    const data =
      await fetchJson(
        DASHBOARD_API
      );


    dashboardData =
      data;


    renderHome();

    renderReport();


    setUpdatedTime();

  }

  catch (error) {

    console.error(
      error
    );


    showToast(
      "家計データを取得できませんでした"
    );

  }

}


// =========================================================
// LOAD RECEIPTS
// =========================================================

async function loadReceipts() {

  try {

    const year =
      receiptDate.getFullYear();


    const month =
      receiptDate.getMonth() + 1;


    const data =
      await fetchJson(
        `${API_BASE}?mode=receipts&year=${year}&month=${month}`
      );


    if (
      Array.isArray(data)
    ) {

      receiptData =
        data;

    }

    else if (
      Array.isArray(
        data.receipts
      )
    ) {

      receiptData =
        data.receipts;

    }

    else {

      receiptData =
        [];

    }


    renderReceiptPage();


    if (
      currentPage === "calendar"
    ) {

      renderCalendar();

    }

  }

  catch (error) {

    console.error(
      "Receipt Error:",
      error
    );


    receiptData =
      [];


    renderReceiptPage();

  }

}


// =========================================================
// LOAD SCHEDULE
// =========================================================

async function loadSchedules() {

  try {

    const year =
      calendarDate.getFullYear();


    const month =
      calendarDate.getMonth() + 1;


    const data =
      await fetchJson(
        `${API_BASE}?mode=schedules&year=${year}&month=${month}`
      );


    scheduleData =
      Array.isArray(
        data.schedules
      )
        ? data.schedules
        : [];


    renderCalendar();

  }

  catch (error) {

    console.error(
      "Schedule Error:",
      error
    );


    scheduleData =
      [];


    renderCalendar();

  }

}


// =========================================================
// HEADER
// =========================================================

function setHeader() {

  const greeting =
    document.getElementById(
      "greeting"
    );


  const title =
    document.getElementById(
      "pageTitle"
    );


  const month =
    document.getElementById(
      "currentMonth"
    );


  const now =
    new Date();


  let hello =
    "こんにちは";


  let icon =
    "🌿";


  if (
    now.getHours() >= 5 &&
    now.getHours() < 11
  ) {

    hello =
      "おはよう";

    icon =
      "☀️";

  }

  else if (
    now.getHours() >= 18 ||
    now.getHours() < 5
  ) {

    hello =
      "こんばんは";

    icon =
      "🌙";

  }


  greeting.textContent =
    `${icon} ${hello}、市川さん`;


  const titles = {

    home:
      "ふたりの家計簿",

    receipt:
      "レシート",

    report:
      "レポート",

    calendar:
      "ふたりの予定",

    settings:
      "設定"

  };


  title.textContent =
    titles[currentPage] ||
    "ふたりの家計簿";


  let target =
    new Date();


  if (
    currentPage === "receipt"
  ) {

    target =
      receiptDate;

  }


  if (
    currentPage === "calendar"
  ) {

    target =
      calendarDate;

  }


  month.textContent =
    `${target.getFullYear()}年${target.getMonth() + 1}月`;

}


// =========================================================
// HOME
// =========================================================

function renderHome() {

  if (!dashboardData) {

    return;

  }


  const data =
    dashboardData;


  const living =
    data.living ||
    {};


  const budget =
    Number(
      living.budget ??
      data.budget ??
      SETTINGS.monthlyBudget
    ) ||
    SETTINGS.monthlyBudget;


  const expense =
    Number(
      living.expense ??
      data.expense ??
      0
    ) || 0;


  const remaining =
    Number(
      living.remaining ??
      data.balance ??
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


  document.getElementById(
    "totalMoney"
  ).textContent =
    yen(
      expense
    );


  document.getElementById(
    "budgetMoney"
  ).textContent =
    yen(
      budget
    );


  document.getElementById(
    "balanceMoney"
  ).textContent =
    yen(
      remaining
    );


  document.getElementById(
    "budgetPercent"
  ).textContent =
    `${Math.round(rate)}%`;


  const progress =
    document.getElementById(
      "progressBar"
    );


  progress.style.width =
    `${Math.min(
      100,
      Math.max(
        0,
        rate
      )
    )}%`;


  document.getElementById(
    "budgetProgress"
  ).setAttribute(
    "aria-valuenow",
    String(
      Math.round(
        Math.min(
          100,
          Math.max(
            0,
            rate
          )
        )
      )
    )
  );


  // =======================================================
  // SAVING
  // =======================================================

  const saving =
    Number(
      data.saving?.current ??
      data.saving?.actual ??
      0
    ) || 0;


  document.getElementById(
    "savingActual"
  ).textContent =
    yen(
      saving
    );


  // =======================================================
  // CATEGORY
  // =======================================================

  renderCategoryList(
    document.getElementById(
      "categoryList"
    ),
    Array.isArray(
      data.categories
    )
      ? data.categories
      : []
  );


  // =======================================================
  // RECENT
  // =======================================================

  renderReceiptList(
    document.getElementById(
      "recentList"
    ),
    Array.isArray(
      data.recent
    )
      ? data.recent
      : [],
    5
  );


  renderAdvice();

}


// =========================================================
// CATEGORY LIST
// =========================================================

function renderCategoryList(
  container,
  categories
) {

  if (!container) {

    return;

  }


  if (
    categories.length === 0
  ) {

    container.innerHTML =
      emptyState(
        "pie_chart",
        "カテゴリがありません"
      );


    return;

  }


  container.innerHTML =
    categories
      .map(
        category => {

          const budget =
            Number(
              category.budget
            ) || 0;


          const amount =
            Number(
              category.amount
            ) || 0;


          const remaining =
            budget -
            amount;


          const rate =
            budget > 0
              ? (
                  amount /
                  budget
                ) * 100
              : (
                  amount > 0
                    ? 100
                    : 0
                );


          return `

            <div class="category-item">

              <div class="category-top">

                <span class="category-name">
                  ${escapeHTML(category.name)}
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
                    width:${Math.min(100, rate)}%;
                    background:${safeColor(category.color)};
                  "
                ></div>

              </div>


              <div
                class="category-remaining ${
                  remaining < 0
                    ? "danger"
                    : ""
                }"
              >

                ${
                  budget > 0
                    ? (
                        remaining >= 0
                          ? `残り ${yen(remaining)}`
                          : `${yen(Math.abs(remaining))} オーバー`
                      )
                    : "予算未設定"
                }

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


  const items =
    limit
      ? receipts.slice(
          0,
          limit
        )
      : receipts;


  if (
    items.length === 0
  ) {

    container.innerHTML =
      emptyState(
        "receipt_long",
        "支出はありません"
      );


    return;

  }


  container.innerHTML =
    items
      .map(
        item => {

          return `

            <div class="receipt-item">

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

                  <span>•</span>

                  <span>
                    ${escapeHTML(formatDate(item.date))}
                  </span>

                  ${
                    item.payer
                      ? `
                          <span>•</span>
                          <span>${escapeHTML(item.payer)}</span>
                        `
                      : ""
                  }

                </div>

              </div>


              <strong class="receipt-amount">
                ${yen(item.amount)}
              </strong>

            </div>

          `;

        }
      )
      .join("");

}


// =========================================================
// ADVICE
// =========================================================

function renderAdvice() {

  const element =
    document.getElementById(
      "aiAdvice"
    );


  if (
    !element ||
    !dashboardData
  ) {

    return;

  }


  const living =
    dashboardData.living ||
    {};


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

    element.textContent =
      `生活費予算を${yen(Math.abs(remaining))}超えています。支出を確認してみましょう。`;


    return;

  }


  const categories =
    Array.isArray(
      dashboardData.categories
    )
      ? dashboardData.categories
      : [];


  const top =
    [...categories]
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

    element.textContent =
      `今月は「${top.name}」が最も多く${yen(top.amount)}です。生活費はあと${yen(remaining)}使えます。`;


    return;

  }


  element.textContent =
    `今月は${yen(budget)}からスタートです。`;

}


// =========================================================
// RECEIPT PAGE
// =========================================================

async function renderReceiptPage() {

  const label =
    document.getElementById(
      "receiptMonthLabel"
    );


  if (!label) {

    return;

  }


  label.textContent =
    `${receiptDate.getFullYear()}年${receiptDate.getMonth() + 1}月`;


  const year =
    receiptDate.getFullYear();


  const month =
    receiptDate.getMonth() + 1;


  const filtered =
    receiptData
      .filter(
        item => {

          const match =
            String(
              item.date || ""
            ).match(
              /^(\d{4})-(\d{2})/
            );


          if (!match) {

            return true;

          }


          return (
            Number(match[1]) === year &&
            Number(match[2]) === month
          );

        }
      )
      .sort(
        (a, b) =>
          String(
            b.date || ""
          ).localeCompare(
            String(
              a.date || ""
            )
          )
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


  document.getElementById(
    "receiptMonthTotal"
  ).textContent =
    yen(
      total
    );


  document.getElementById(
    "receiptCount"
  ).textContent =
    `${filtered.length}件`;


  renderReceiptList(
    document.getElementById(
      "receiptFullList"
    ),
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
    dashboardData.living ||
    {};


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


  const rate =
    budget > 0
      ? (
          expense /
          budget
        ) * 100
      : 0;


  document.getElementById(
    "reportExpense"
  ).textContent =
    yen(
      expense
    );


  document.getElementById(
    "reportBudget"
  ).textContent =
    yen(
      budget
    );


  document.getElementById(
    "reportRemaining"
  ).textContent =
    yen(
      remaining
    );


  document.getElementById(
    "reportRate"
  ).textContent =
    `${Math.round(rate)}%`;


  document.getElementById(
    "reportSaving"
  ).textContent =
    yen(
      dashboardData.saving?.current ||
      0
    );


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
    document.getElementById(
      "reportCategoryList"
    ),
    categories
  );

}


// =========================================================
// CALENDAR
// =========================================================

async function renderCalendar() {

  const grid =
    document.getElementById(
      "calendarGrid"
    );


  if (!grid) {

    return;

  }


  const year =
    calendarDate.getFullYear();


  const month =
    calendarDate.getMonth();


  document.getElementById(
    "calendarMonthLabel"
  ).textContent =
    `${year}年${month + 1}月`;


  const firstDay =
    new Date(
      year,
      month,
      1
    );


  const lastDay =
    new Date(
      year,
      month + 1,
      0
    );


  const startWeekday =
    firstDay.getDay();


  const days =
    lastDay.getDate();


  let html =
    "";


  for (
    let i = 0;
    i < startWeekday;
    i++
  ) {

    html +=
      `<div class="calendar-day empty"></div>`;

  }


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const date =
      new Date(
        year,
        month,
        day
      );


    const key =
      localDateKey(
        date
      );


    const schedules =
      scheduleData.filter(
        item =>
          item.date === key
      );


    const expenses =
      getExpensesForDate(
        key
      );


    const total =
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


    const isToday =
      key ===
      localDateKey(
        new Date()
      );


    const selected =
      key ===
      selectedCalendarDate;


    html += `

      <button
        class="
          calendar-day
          ${isToday ? "today" : ""}
          ${selected ? "selected" : ""}
        "
        type="button"
        data-date="${key}"
      >

        <span class="calendar-number">
          ${day}
        </span>


        <div class="calendar-markers">

          ${
            schedules
              .slice(
                0,
                2
              )
              .map(
                schedule => {

                  const icon =
                    schedule.target === "さとる"
                      ? "🌿"
                      : (
                          schedule.target === "かな"
                            ? "🌸"
                            : "👫"
                        );


                  return `
                    <span class="calendar-schedule-dot">
                      ${icon}
                    </span>
                  `;

                }
              )
              .join("")
          }

        </div>


        ${
          total > 0
            ? `
                <span class="calendar-money">
                  ${compactYen(total)}
                </span>
              `
            : ""
        }

      </button>

    `;

  }


  grid.innerHTML =
    html;


  grid
    .querySelectorAll(
      ".calendar-day:not(.empty)"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            selectedCalendarDate =
              button.dataset.date;


            renderCalendar();

            renderSelectedDay();

          }
        );

      }
    );


  if (
    selectedCalendarDate
  ) {

    renderSelectedDay();

  }

}


// =========================================================
// EXPENSES FOR DATE
// =========================================================

function getExpensesForDate(
  date
) {

  const source =
    receiptData.length
      ? receiptData
      : (
          Array.isArray(
            dashboardData?.recent
          )
            ? dashboardData.recent
            : []
        );


  return source.filter(
    item =>
      String(
        item.date || ""
      ).slice(
        0,
        10
      ) === date
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


  const title =
    document.getElementById(
      "selectedDateTitle"
    );


  const list =
    document.getElementById(
      "selectedDayList"
    );


  const date =
    new Date(
      `${selectedCalendarDate}T00:00:00`
    );


  title.textContent =
    `${date.getMonth() + 1}月${date.getDate()}日`;


  const schedules =
    scheduleData.filter(
      item =>
        item.date ===
        selectedCalendarDate
    );


  const expenses =
    getExpensesForDate(
      selectedCalendarDate
    );


  let html =
    "";


  schedules.forEach(
    item => {

      const icon =
        item.target === "さとる"
          ? "🌿"
          : (
              item.target === "かな"
                ? "🌸"
                : "👫"
            );


      html += `

        <button
          class="schedule-list-item"
          type="button"
          data-schedule-id="${escapeHTML(item.id)}"
        >

          <div class="schedule-icon">
            ${icon}
          </div>


          <div class="schedule-info">

            <strong>
              ${escapeHTML(item.title)}
            </strong>

            <span>

              ${
                item.start
                  ? escapeHTML(item.start)
                  : "時間未設定"
              }

              ${
                item.end
                  ? `〜${escapeHTML(item.end)}`
                  : ""
              }

              ・${escapeHTML(item.target)}

            </span>

          </div>

        </button>

      `;

    }
  );


  expenses.forEach(
    item => {

      html += `

        <div class="day-expense-item">

          <div class="day-expense-icon">
            💰
          </div>

          <div>

            <strong>
              ${escapeHTML(item.shop || item.category)}
            </strong>

            <span>
              ${escapeHTML(item.category || "支出")}
            </span>

          </div>

          <strong class="day-expense-money">
            ${yen(item.amount)}
          </strong>

        </div>

      `;

    }
  );


  if (!html) {

    html =
      emptyState(
        "event_available",
        "予定・支出はありません"
      );

  }


  list.innerHTML =
    html;


  list
    .querySelectorAll(
      "[data-schedule-id]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const schedule =
              scheduleData.find(
                item =>
                  item.id ===
                  button.dataset.scheduleId
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
// COMPACT YEN
// =========================================================

function compactYen(value) {

  const number =
    Number(
      value
    ) || 0;


  if (
    number >= 10000
  ) {

    return (
      `¥${Math.round(number / 1000)}k`
    );

  }


  return (
    `¥${number.toLocaleString("ja-JP")}`
  );

}


// =========================================================
// SCHEDULE MODAL
// =========================================================

function openScheduleModal(
  schedule = null
) {

  const modal =
    document.getElementById(
      "scheduleModal"
    );


  const deleteButton =
    document.getElementById(
      "deleteScheduleButton"
    );


  modal.classList.add(
    "show"
  );


  document.body.classList.add(
    "modal-open"
  );


  if (schedule) {

    document.getElementById(
      "scheduleModalTitle"
    ).textContent =
      "予定を編集";


    document.getElementById(
      "scheduleId"
    ).value =
      schedule.id || "";


    document.getElementById(
      "scheduleDate"
    ).value =
      schedule.date || "";


    document.getElementById(
      "scheduleStart"
    ).value =
      schedule.start || "";


    document.getElementById(
      "scheduleEnd"
    ).value =
      schedule.end || "";


    document.getElementById(
      "scheduleTitle"
    ).value =
      schedule.title || "";


    document.getElementById(
      "scheduleTarget"
    ).value =
      schedule.target ||
      "ふたり";


    document.getElementById(
      "scheduleMemo"
    ).value =
      schedule.memo || "";


    deleteButton.classList.remove(
      "hidden"
    );

  }

  else {

    document.getElementById(
      "scheduleModalTitle"
    ).textContent =
      "予定を追加";


    document.getElementById(
      "scheduleId"
    ).value =
      "";


    document.getElementById(
      "scheduleDate"
    ).value =
      selectedCalendarDate ||
      localDateKey(
        new Date()
      );


    document.getElementById(
      "scheduleStart"
    ).value =
      "";


    document.getElementById(
      "scheduleEnd"
    ).value =
      "";


    document.getElementById(
      "scheduleTitle"
    ).value =
      "";


    document.getElementById(
      "scheduleTarget"
    ).value =
      "ふたり";


    document.getElementById(
      "scheduleMemo"
    ).value =
      "";


    deleteButton.classList.add(
      "hidden"
    );

  }

}


// =========================================================
// CLOSE MODAL
// =========================================================

function closeScheduleModal() {

  document.getElementById(
    "scheduleModal"
  ).classList.remove(
    "show"
  );


  document.body.classList.remove(
    "modal-open"
  );

}


// =========================================================
// SAVE SCHEDULE
// =========================================================

async function saveSchedule() {

  const id =
    document.getElementById(
      "scheduleId"
    ).value.trim();


  const date =
    document.getElementById(
      "scheduleDate"
    ).value;


  const title =
    document.getElementById(
      "scheduleTitle"
    ).value.trim();


  if (
    !date ||
    !title
  ) {

    showToast(
      "日付と予定を入力してください"
    );


    return;

  }


  const params =
    new URLSearchParams();


  params.set(
    "action",
    id
      ? "updateSchedule"
      : "addSchedule"
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
    document.getElementById(
      "scheduleStart"
    ).value
  );


  params.set(
    "end",
    document.getElementById(
      "scheduleEnd"
    ).value
  );


  params.set(
    "title",
    title
  );


  params.set(
    "target",
    document.getElementById(
      "scheduleTarget"
    ).value
  );


  params.set(
    "memo",
    document.getElementById(
      "scheduleMemo"
    ).value
  );


  params.set(
    "registeredBy",
    "Web"
  );


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
        "保存失敗"
      );

    }


    closeScheduleModal();


    selectedCalendarDate =
      date;


    calendarDate =
      new Date(
        `${date}T00:00:00`
      );


    await loadSchedules();


    showToast(
      id
        ? "予定を変更しました"
        : "予定を追加しました"
    );

  }

  catch (error) {

    console.error(
      error
    );


    showToast(
      "予定を保存できませんでした"
    );

  }

}


// =========================================================
// DELETE SCHEDULE
// =========================================================

async function deleteSchedule() {

  const id =
    document.getElementById(
      "scheduleId"
    ).value.trim();


  if (!id) {

    return;

  }


  if (
    !window.confirm(
      "この予定を削除しますか？"
    )
  ) {

    return;

  }


  try {

    const result =
      await fetchJson(
        `${API_BASE}?action=deleteSchedule&id=${encodeURIComponent(id)}`
      );


    if (
      result.success !== true
    ) {

      throw new Error(
        result.error ||
        "削除失敗"
      );

    }


    closeScheduleModal();


    await loadSchedules();


    showToast(
      "予定を削除しました"
    );

  }

  catch (error) {

    console.error(
      error
    );


    showToast(
      "予定を削除できませんでした"
    );

  }

}


// =========================================================
// NAVIGATION
// =========================================================

async function switchPage(page) {

  currentPage =
    page;


  document
    .querySelectorAll(
      ".page"
    )
    .forEach(
      element => {

        element.classList.toggle(
          "active",
          element.id ===
          `page-${page}`
        );

      }
    );


  document
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
          page
        );

      }
    );


  setHeader();


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  if (
    page === "receipt"
  ) {

    await loadReceipts();

  }


  if (
    page === "report"
  ) {

    renderReport();

  }


  if (
    page === "calendar"
  ) {

    receiptDate =
      new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth(),
        1
      );


    await loadReceipts();

    await loadSchedules();

  }

}


// =========================================================
// EMPTY STATE
// =========================================================

function emptyState(
  icon,
  text
) {

  return `

    <div class="empty-state">

      <span class="material-symbols-rounded">
        ${icon}
      </span>

      <strong>
        ${escapeHTML(text)}
      </strong>

    </div>

  `;

}


// =========================================================
// TOAST
// =========================================================

function showToast(message) {

  const toast =
    document.getElementById(
      "errorToast"
    );


  const text =
    document.getElementById(
      "errorMessage"
    );


  text.textContent =
    message;


  toast.classList.add(
    "show"
  );


  window.setTimeout(
    () => {

      toast.classList.remove(
        "show"
      );

    },
    2800
  );

}


// =========================================================
// UPDATE TIME
// =========================================================

function setUpdatedTime() {

  const now =
    new Date();


  document.getElementById(
    "lastUpdated"
  ).textContent =
    `${now.toLocaleTimeString(
      "ja-JP",
      {
        hour:
          "2-digit",
        minute:
          "2-digit"
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
          () => {

            switchPage(
              button.dataset.page
            );

          }
        );

      }
    );


  // HOME → REPORT

  document.getElementById(
    "categoryDetailButton"
  ).addEventListener(
    "click",
    () => {

      switchPage(
        "report"
      );

    }
  );


  // HOME → RECEIPT

  document.getElementById(
    "receiptDetailButton"
  ).addEventListener(
    "click",
    () => {

      switchPage(
        "receipt"
      );

    }
  );


  // RECEIPT MONTH

  document.getElementById(
    "receiptPrevMonth"
  ).addEventListener(
    "click",
    async () => {

      receiptDate.setMonth(
        receiptDate.getMonth() - 1
      );


      await loadReceipts();

      setHeader();

    }
  );


  document.getElementById(
    "receiptNextMonth"
  ).addEventListener(
    "click",
    async () => {

      receiptDate.setMonth(
        receiptDate.getMonth() + 1
      );


      await loadReceipts();

      setHeader();

    }
  );


  // CALENDAR MONTH

  document.getElementById(
    "calendarPrevMonth"
  ).addEventListener(
    "click",
    async () => {

      calendarDate =
        new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth() - 1,
          1
        );


      selectedCalendarDate =
        null;


      receiptDate =
        new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth(),
          1
        );


      await loadReceipts();

      await loadSchedules();

      setHeader();

    }
  );


  document.getElementById(
    "calendarNextMonth"
  ).addEventListener(
    "click",
    async () => {

      calendarDate =
        new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth() + 1,
          1
        );


      selectedCalendarDate =
        null;


      receiptDate =
        new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth(),
          1
        );


      await loadReceipts();

      await loadSchedules();

      setHeader();

    }
  );


  // ADD SCHEDULE

  document.getElementById(
    "addScheduleButton"
  ).addEventListener(
    "click",
    () => {

      openScheduleModal();

    }
  );


  // CLOSE

  document.getElementById(
    "scheduleModalClose"
  ).addEventListener(
    "click",
    closeScheduleModal
  );


  // BACKDROP

  document.getElementById(
    "scheduleModal"
  ).addEventListener(
    "click",
    event => {

      if (
        event.target.id ===
        "scheduleModal"
      ) {

        closeScheduleModal();

      }

    }
  );


  // SAVE

  document.getElementById(
    "saveScheduleButton"
  ).addEventListener(
    "click",
    saveSchedule
  );


  // DELETE

  document.getElementById(
    "deleteScheduleButton"
  ).addEventListener(
    "click",
    deleteSchedule
  );


  // NOTIFICATION

  document.getElementById(
    "notificationButton"
  ).addEventListener(
    "click",
    () => {

      showToast(
        "お知らせはありません"
      );

    }
  );

}


// =========================================================
// AUTO REFRESH
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
      async () => {

        if (
          document.visibilityState !==
          "visible"
        ) {

          return;

        }


        await loadDashboard();


        if (
          currentPage === "calendar"
        ) {

          await loadSchedules();

        }

      },
      SETTINGS.refreshInterval
    );

}


// =========================================================
// START
// =========================================================

async function initializeApp() {

  const now =
    new Date();


  receiptDate =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );


  calendarDate =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );


  setHeader();


  setupEvents();


  await loadDashboard();


  startAutoRefresh();

}


document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);
