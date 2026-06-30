const DB_NAME = "recon_3col_telegram_v12";
const DB_VERSION = 1;
const STATE_STORE = "state";
const IMAGE_STORE = "images";
const STATE_KEY = "current";
const LOCAL_KEY = "recon_3col_telegram_state_v12";
const TOKEN_KEY = "telegram_bot_token_v12";

const TELEGRAM_USERS = [
  { name: "Lobeng", id: "5137608953" },
  { name: "Ocha", id: "5817507946" },
  { name: "Faisal", id: "6201817840" }
];

let db = null;
let state = defaultState();
let saveTimer = null;
let activeMoneyInput = null;
let dialogTarget = null;

const $ = (id) => document.getElementById(id);

const el = {
  appTitle: $("appTitle"),
  globalStatus: $("globalStatus"),
  globalStatusText: $("globalStatusText"),
  globalStatusSub: $("globalStatusSub"),
  incomeNameLabel: $("incomeNameLabel"),
  incomeMoneyLabel: $("incomeMoneyLabel"),
  incomeTotalLabel: $("incomeTotalLabel"),
  expenseNameLabel: $("expenseNameLabel"),
  expenseMoneyLabel: $("expenseMoneyLabel"),
  expenseTotalLabel: $("expenseTotalLabel"),
  tableRows: $("tableRows"),
  verticalRows: $("verticalRows"),
  totalIncome: $("totalIncome"),
  totalExpense: $("totalExpense"),
  difference: $("difference"),
  diffBox: $("diffBox"),
  fontScale: $("fontScale"),
  saveState: $("saveState"),
  modeBtn: $("modeBtn"),
  compactBtn: $("compactBtn"),
  telegramUser: $("telegramUser"),
  telegramToken: $("telegramToken"),
  telegramPreview: $("telegramPreview"),
  telegramStatus: $("telegramStatus"),
  exprDialog: $("exprDialog"),
  exprDialogTitle: $("exprDialogTitle"),
  exprDialogText: $("exprDialogText")
};

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function row(incomeName = "", incomeExpr = "", expenseName = "", expenseExpr = "") {
  const incomeEval = calculateExpression(incomeExpr, null);
  const expenseEval = calculateExpression(expenseExpr, null);

  return {
    id: newId(),
    incomeName,
    incomeExpr,
    incomeAmount: incomeEval.ok ? incomeEval.value : 0,
    incomeState: incomeEval.state,
    incomeValid: incomeEval.ok,
    incomeError: incomeEval.error,
    expenseName,
    expenseExpr,
    expenseAmount: expenseEval.ok ? expenseEval.value : 0,
    expenseState: expenseEval.state,
    expenseValid: expenseEval.ok,
    expenseError: expenseEval.error,
    imageId: null,
    imageName: ""
  };
}

function defaultState() {
  return {
    title: "收支核对",
    compact: false,
    mode: "table",
    fontScale: 100,
    labels: {
      incomeName: "姓名",
      incomeMoney: "金额",
      incomeTotal: "合计",
      expenseName: "姓名",
      expenseMoney: "金额",
      expenseTotal: "合计"
    },
    rows: [
      row("微信", "100+20", "支付宝", "120"),
      row("现金", "250", "银行卡", "250"),
      row("客户A", "450", "供应商A", "400"),
      row("客户B", "", "供应商B", ""),
      row("", "", "", "")
    ]
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) database.createObjectStore(STATE_STORE);
      if (!database.objectStoreNames.contains(IMAGE_STORE)) database.createObjectStore(IMAGE_STORE);
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(store, key) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(null);
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function dbSet(store, key, value) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbDelete(store, key) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function normalizeState(input) {
  const base = defaultState();
  const labels = { ...base.labels, ...(input?.labels || {}) };

  const rows = Array.isArray(input?.rows) && input.rows.length ? input.rows.map((r) => {
    const normalized = {
      id: r.id || newId(),
      incomeName: r.incomeName ?? "",
      incomeExpr: r.incomeExpr ?? r.incomeAmount ?? "",
      incomeAmount: Number.isFinite(Number(r.incomeAmount)) ? Number(r.incomeAmount) : 0,
      incomeState: r.incomeState || (r.incomeValid === false ? "error" : "ok"),
      incomeValid: r.incomeValid !== false,
      incomeError: r.incomeError ?? "",
      expenseName: r.expenseName ?? "",
      expenseExpr: r.expenseExpr ?? r.expenseAmount ?? "",
      expenseAmount: Number.isFinite(Number(r.expenseAmount)) ? Number(r.expenseAmount) : 0,
      expenseState: r.expenseState || (r.expenseValid === false ? "error" : "ok"),
      expenseValid: r.expenseValid !== false,
      expenseError: r.expenseError ?? "",
      imageId: r.imageId ?? null,
      imageName: r.imageName ?? ""
    };

    updateSideCalculation(normalized, "income", false);
    updateSideCalculation(normalized, "expense", false);
    return normalized;
  }) : base.rows;

  return {
    title: input?.title || input?.appTitle || base.title,
    compact: Boolean(input?.compact),
    mode: input?.mode === "vertical" ? "vertical" : "table",
    fontScale: Number(input?.fontScale || 100),
    labels,
    rows
  };
}

async function loadState() {
  try {
    db = await openDB();
    const saved = await dbGet(STATE_STORE, STATE_KEY);
    if (saved) return normalizeState(saved);
  } catch (error) {
    console.warn("IndexedDB 不可用。", error);
  }

  try {
    const local = localStorage.getItem(LOCAL_KEY);
    if (local) return normalizeState(JSON.parse(local));
  } catch (error) {
    console.warn("localStorage 读取失败。", error);
  }

  return defaultState();
}

function persistSoon() {
  el.saveState.textContent = "保存中…";
  el.saveState.style.color = "#ca8a04";

  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
      await dbSet(STATE_STORE, STATE_KEY, state);
      el.saveState.textContent = "已保存";
      el.saveState.style.color = "#16a34a";
      updateTelegramPreview();
    } catch (error) {
      el.saveState.textContent = "保存失败";
      el.saveState.style.color = "#dc2626";
    }
  }, 120);
}

function normalizeFullWidth(value) {
  return String(value ?? "")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/＋/g, "+")
    .replace(/－/g, "-")
    .replace(/[×ｘXx]/g, "*")
    .replace(/÷/g, "/")
    .replace(/，/g, ",")
    .replace(/。/g, ".")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/＝/g, "=");
}

function compactExpression(value) {
  return normalizeFullWidth(value)
    .replace(/\s+/g, "")
    .replace(/^=+/, "")
    .replace(/=+$/, "");
}

function cleanExpressionForPayload(value) {
  return normalizeFullWidth(value)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^=+/, "")
    .replace(/=+$/, "")
    .trim();
}

function normalizeNumberToken(token) {
  let value = String(token).trim();
  const comma = value.includes(",");
  const dot = value.includes(".");

  if (comma && dot) {
    value = value.lastIndexOf(",") > value.lastIndexOf(".")
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  } else if (comma) {
    const parts = value.split(",");
    value = parts.length > 2 || (parts[1] && parts[1].length === 3)
      ? value.replace(/,/g, "")
      : value.replace(",", ".");
  } else if (dot) {
    const parts = value.split(".");
    if (parts.length > 2 || (parts[1] && parts[1].length === 3)) {
      value = value.replace(/\./g, "");
    }
  }

  return value;
}

function tokenizeExpression(expression) {
  const input = compactExpression(expression).replace(/[^\d+\-*/().,]/g, "");
  if (!input) return [];

  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if ("+-*/()".includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }

    if (/\d|[.,]/.test(ch)) {
      let j = i;
      while (j < input.length && /[\d.,]/.test(input[j])) j++;
      tokens.push(normalizeNumberToken(input.slice(i, j)));
      i = j;
      continue;
    }

    return null;
  }

  return tokens;
}

function canBeTypingExpression(expression) {
  const input = compactExpression(expression);
  if (!input) return false;

  // Case: user ends with one operator, e.g. "100+" or "(100+20)*".
  if (/[+\-*/.]$/.test(input)) {
    const prefix = input.slice(0, -1);
    if (!prefix) return true;
    const prefixEval = evaluateExpressionStrict(prefix);
    return prefixEval.ok || hasUnclosedParentheses(prefix);
  }

  // Case: user has opened parentheses but not closed yet, e.g. "(100+20".
  if (hasUnclosedParentheses(input)) return true;

  return false;
}

function hasUnclosedParentheses(input) {
  let balance = 0;
  for (const ch of input) {
    if (ch === "(") balance++;
    if (ch === ")") balance--;
    if (balance < 0) return false;
  }
  return balance > 0;
}

function evaluateExpressionStrict(expression) {
  if (String(expression ?? "").trim() === "") return { ok: true, value: 0 };

  const tokens = tokenizeExpression(expression);
  if (!tokens || tokens.length === 0) return { ok: false, error: "无法计算" };

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function primary() {
    const token = peek();

    if (token === "+") {
      consume();
      return primary();
    }

    if (token === "-") {
      consume();
      return -primary();
    }

    if (token === "(") {
      consume();
      const value = expressionParser();
      if (peek() !== ")") return NaN;
      consume();
      return value;
    }

    consume();
    const number = Number(token);
    return Number.isFinite(number) ? number : NaN;
  }

  function term() {
    let value = primary();

    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const right = primary();

      if (!Number.isFinite(value) || !Number.isFinite(right)) return NaN;
      if (operator === "*") value *= right;
      if (operator === "/") {
        if (right === 0) return NaN;
        value /= right;
      }
    }

    return value;
  }

  function expressionParser() {
    let value = term();

    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = term();

      if (!Number.isFinite(value) || !Number.isFinite(right)) return NaN;
      if (operator === "+") value += right;
      if (operator === "-") value -= right;
    }

    return value;
  }

  const result = expressionParser();
  if (pos !== tokens.length || !Number.isFinite(result)) {
    return { ok: false, error: "无法计算" };
  }

  return { ok: true, value: result };
}

function calculateExpression(expression, previous) {
  if (String(expression ?? "").trim() === "") {
    return { ok: true, state: "ok", value: 0, error: "" };
  }

  const strict = evaluateExpressionStrict(expression);

  if (strict.ok) {
    return {
      ok: true,
      state: "ok",
      value: Number.isInteger(strict.value) ? strict.value : Number(strict.value.toFixed(2)),
      error: ""
    };
  }

  if (canBeTypingExpression(expression)) {
    return {
      ok: false,
      state: "typing",
      value: Number.isFinite(Number(previous)) ? Number(previous) : 0,
      error: "输入中"
    };
  }

  return {
    ok: false,
    state: "error",
    value: Number.isFinite(Number(previous)) ? Number(previous) : 0,
    error: strict.error || "无法计算"
  };
}

function updateSideCalculation(rowData, side, keepPrevious = true) {
  const exprKey = `${side}Expr`;
  const amountKey = `${side}Amount`;
  const validKey = `${side}Valid`;
  const stateKey = `${side}State`;
  const errorKey = `${side}Error`;

  const previous = rowData[amountKey];
  const result = calculateExpression(rowData[exprKey], previous);

  rowData[stateKey] = result.state;
  rowData[validKey] = result.state !== "error";
  rowData[errorKey] = result.error;

  // Only a valid expression updates the stored amount.
  // Typing/error states preserve the last valid amount.
  if (result.state === "ok" || !keepPrevious) {
    rowData[amountKey] = result.value;
  }
}

function hasValue(value) {
  return String(value ?? "").trim() !== "";
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function rowStatus(rowData) {
  if (rowData.incomeState === "error" || rowData.expenseState === "error") {
    return { type: "bad", text: "金额错误" };
  }

  if (rowData.incomeState === "typing" || rowData.expenseState === "typing") {
    return { type: "typing", text: "输入中..." };
  }

  const hasIncome = hasValue(rowData.incomeExpr);
  const hasExpense = hasValue(rowData.expenseExpr);

  if (!hasIncome && !hasExpense) return { type: "wait", text: "待输入" };
  if (!hasIncome || !hasExpense) return { type: "wait", text: "待匹配" };
  if (Number(rowData.incomeAmount) === Number(rowData.expenseAmount)) return { type: "ok", text: "一致" };

  return { type: "bad", text: `差 ${formatMoney(Number(rowData.incomeAmount) - Number(rowData.expenseAmount))}` };
}

function totals() {
  const total = state.rows.reduce((acc, rowData) => {
    acc.income += Number(rowData.incomeAmount || 0);
    acc.expense += Number(rowData.expenseAmount || 0);
    acc.hasError = acc.hasError || rowData.incomeState === "error" || rowData.expenseState === "error";
    acc.hasTyping = acc.hasTyping || rowData.incomeState === "typing" || rowData.expenseState === "typing";
    return acc;
  }, { income: 0, expense: 0, hasError: false, hasTyping: false });

  total.diff = total.income - total.expense;
  return total;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function moneyEditor(index, side, value) {
  const exprKey = `${side}Expr`;
  const stateValue = state.rows[index]?.[`${side}State`] || "ok";
  return `
    <div class="money-wrap ${stateValue}">
      <textarea class="money-editor money-input" inputmode="decimal" spellcheck="false"
        data-row-index="${index}"
        data-side="${side}"
        placeholder="100+20"
        onfocus="setActiveMoneyInput(this)"
        oninput="updateRow(${index}, '${exprKey}', this.value)"
        onkeyup="updateRow(${index}, '${exprKey}', this.value)"
        onchange="updateRow(${index}, '${exprKey}', this.value)"
        onpaste="setTimeout(() => updateRow(${index}, '${exprKey}', this.value), 0)"
        onblur="updateRow(${index}, '${exprKey}', this.value)">${escapeHtml(value)}</textarea>
    </div>
  `;
}

function amountBox(rowData, side, index = 0) {
  const sideState = rowData[`${side}State`] || "ok";
  const error = rowData[`${side}Error`];
  const amount = rowData[`${side}Amount`];

  let text = formatMoney(amount);
  if (sideState === "typing") text = "输入中";

  return `
    <div class="amount-box ${sideState === "error" ? "error" : sideState === "typing" ? "typing" : ""}"
      data-amount="${index}-${side}"
      title="${escapeHtml(error || "")}">
      ${text}
    </div>
  `;
}

function renderTable() {
  el.tableRows.innerHTML = state.rows.map((rowData, index) => {
    const status = rowStatus(rowData);
    const hasImage = Boolean(rowData.imageId);

    return `
      <article class="row-wrap ${status.type}" data-row-index="${index}">
        <div class="data-grid">
          <div class="cell income">
            <input value="${escapeHtml(rowData.incomeName)}" placeholder="名"
              oninput="updateRow(${index}, 'incomeName', this.value)" />
          </div>
          <div class="cell income">${moneyEditor(index, "income", rowData.incomeExpr)}</div>
          <div class="cell income">${amountBox(rowData, "income", index)}</div>

          <div class="cell expense">
            <input value="${escapeHtml(rowData.expenseName)}" placeholder="名"
              oninput="updateRow(${index}, 'expenseName', this.value)" />
          </div>
          <div class="cell expense">${moneyEditor(index, "expense", rowData.expenseExpr)}</div>
          <div class="cell expense">${amountBox(rowData, "expense", index)}</div>
        </div>
        <div class="row-meta">
          <span class="pill ${status.type}" data-status="${index}">${escapeHtml(status.text)}</span>
          <div class="row-actions">
            <button class="icon-btn danger" onclick="deleteRow(${index})" title="删除">×</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderVertical() {
  el.verticalRows.innerHTML = state.rows.map((rowData, index) => {
    const status = rowStatus(rowData);
    const hasImage = Boolean(rowData.imageId);

    return `
      <article class="v-card" data-v-row-index="${index}">
        <header class="v-head">
          <span class="pill ${status.type}" data-status="${index}">${escapeHtml(status.text)}</span>
          <div class="row-actions">
            <button class="icon-btn danger" onclick="deleteRow(${index})">×</button>
          </div>
        </header>
        <div class="v-body">
          <section class="v-side income">
            <div class="v-side-title">收入</div>
            <div class="v-fields">
              <div class="v-field">
                <label>${escapeHtml(state.labels.incomeName)}</label>
                <input value="${escapeHtml(rowData.incomeName)}" placeholder="名"
                  oninput="updateRow(${index}, 'incomeName', this.value)" />
              </div>
              <div class="v-field">
                <label>${escapeHtml(state.labels.incomeMoney)}</label>
                ${moneyEditor(index, "income", rowData.incomeExpr)}
              </div>
              <div class="v-field">
                <label>${escapeHtml(state.labels.incomeTotal)}</label>
                <div class="v-result ${rowData.incomeState === "error" ? "error" : rowData.incomeState === "typing" ? "typing" : ""}" data-amount="${index}-income">
                  ${rowData.incomeState === "typing" ? "输入中" : formatMoney(rowData.incomeAmount)}
                </div>
              </div>
            </div>
          </section>
          <section class="v-side expense">
            <div class="v-side-title">支出</div>
            <div class="v-fields">
              <div class="v-field">
                <label>${escapeHtml(state.labels.expenseName)}</label>
                <input value="${escapeHtml(rowData.expenseName)}" placeholder="名"
                  oninput="updateRow(${index}, 'expenseName', this.value)" />
              </div>
              <div class="v-field">
                <label>${escapeHtml(state.labels.expenseMoney)}</label>
                ${moneyEditor(index, "expense", rowData.expenseExpr)}
              </div>
              <div class="v-field">
                <label>${escapeHtml(state.labels.expenseTotal)}</label>
                <div class="v-result ${rowData.expenseState === "error" ? "error" : rowData.expenseState === "typing" ? "typing" : ""}" data-amount="${index}-expense">
                  ${rowData.expenseState === "typing" ? "输入中" : formatMoney(rowData.expenseAmount)}
                </div>
              </div>
            </div>
          </section>
        </div>
      </article>
    `;
  }).join("");
}

function renderTotals() {
  const total = totals();
  const allEmpty = state.rows.every((rowData) => !hasValue(rowData.incomeExpr) && !hasValue(rowData.expenseExpr));

  el.totalIncome.textContent = formatMoney(total.income);
  el.totalExpense.textContent = formatMoney(total.expense);
  el.difference.textContent = formatMoney(total.diff);

  let cls = "ok";
  let text = "成功";
  let sub = "已平衡";

  if (total.hasError) {
    cls = "bad";
    text = "失败";
    sub = "金额错误";
  } else if (total.hasTyping) {
    cls = "wait";
    text = "输入中";
    sub = "实时计算";
  } else if (allEmpty) {
    cls = "wait";
    text = "待输入";
    sub = "请填写";
  } else if (total.diff !== 0) {
    cls = "bad";
    text = "失败";
    sub = `差 ${formatMoney(total.diff)}`;
  }

  el.globalStatus.className = `status-chip ${cls}`;
  el.globalStatusText.textContent = text;
  el.globalStatusSub.textContent = sub;
  el.diffBox.className = cls;
}

function refreshRowVisual(index) {
  const rowData = state.rows[index];
  if (!rowData) return;

  const status = rowStatus(rowData);

  document.querySelectorAll(`[data-row-index="${index}"]`).forEach((node) => {
    node.className = `row-wrap ${status.type}`;
  });

  document.querySelectorAll(`[data-v-row-index="${index}"]`).forEach((node) => {
    node.className = `v-card ${status.type}`;
  });

  document.querySelectorAll(`[data-status="${index}"]`).forEach((node) => {
    node.className = `pill ${status.type}`;
    node.textContent = status.text;
  });

  ["income", "expense"].forEach((side) => {
    const sideState = rowData[`${side}State`] || "ok";
    const amount = rowData[`${side}Amount`];
    const error = rowData[`${side}Error`] || "";
    const text = sideState === "typing" ? "输入中" : formatMoney(amount);

    document.querySelectorAll(`[data-amount="${index}-${side}"]`).forEach((node) => {
      node.className = node.classList.contains("v-result")
        ? `v-result ${sideState === "error" ? "error" : sideState === "typing" ? "typing" : ""}`
        : `amount-box ${sideState === "error" ? "error" : sideState === "typing" ? "typing" : ""}`;
      node.textContent = text;
      node.title = error;
    });

    const field = `${side}Expr`;
    const textareas = document.querySelectorAll(`textarea[oninput*="${field}"]`);
    textareas.forEach((area) => {
      const wrap = area.closest(".money-wrap");
      if (wrap) wrap.className = `money-wrap ${sideState}`;
    });
  });
}

function render() {
  document.documentElement.style.setProperty("--scale", state.fontScale / 100);
  document.body.classList.toggle("compact", state.compact);
  document.body.classList.toggle("vertical", state.mode === "vertical");

  el.appTitle.textContent = state.title;
  el.incomeNameLabel.textContent = state.labels.incomeName;
  el.incomeMoneyLabel.textContent = state.labels.incomeMoney;
  el.incomeTotalLabel.textContent = state.labels.incomeTotal;
  el.expenseNameLabel.textContent = state.labels.expenseName;
  el.expenseMoneyLabel.textContent = state.labels.expenseMoney;
  el.expenseTotalLabel.textContent = state.labels.expenseTotal;
  el.fontScale.value = state.fontScale;
  el.modeBtn.textContent = state.mode === "vertical" ? "表格" : "纵向";
  el.compactBtn.textContent = state.compact ? "舒适" : "紧凑";

  renderTable();
  renderVertical();
  renderTotals();
  updateTelegramPreview();
}


function syncMoneyInputsFromDom() {
  document.querySelectorAll(".money-editor[data-row-index][data-side]").forEach((node) => {
    const index = Number(node.dataset.rowIndex);
    const side = node.dataset.side;
    if (!Number.isInteger(index) || !state.rows[index]) return;

    const key = `${side}Expr`;
    if (state.rows[index][key] !== node.value) {
      state.rows[index][key] = node.value;
    }

    updateSideCalculation(state.rows[index], side, true);
  });
}

function recalculateEverything({ fromWatchdog = false } = {}) {
  syncMoneyInputsFromDom();

  state.rows.forEach((rowData) => {
    updateSideCalculation(rowData, "income", true);
    updateSideCalculation(rowData, "expense", true);
  });

  state.rows.forEach((_, index) => refreshRowVisual(index));
  renderTotals();
  updateTelegramPreview();

  if (fromWatchdog) {
    document.querySelectorAll(".amount-box, .v-result").forEach((node) => {
      node.classList.add("recalc-pulse");
      setTimeout(() => node.classList.remove("recalc-pulse"), 280);
    });
  }

  persistSoon();
}

let liveRecalcTimer = null;
function scheduleLiveRecalc() {
  clearTimeout(liveRecalcTimer);
  liveRecalcTimer = setTimeout(() => {
    recalculateEverything({ fromWatchdog: true });
  }, 2000);
}

window.updateRow = function(index, field, value) {
  if (!state.rows[index]) return;

  state.rows[index][field] = value;

  if (field === "incomeExpr") updateSideCalculation(state.rows[index], "income", true);
  if (field === "expenseExpr") updateSideCalculation(state.rows[index], "expense", true);

  persistSoon();

  if (field === "incomeExpr" || field === "expenseExpr") {
    refreshRowVisual(index);
  }

  renderTotals();
  updateTelegramPreview();
  scheduleLiveRecalc();
};

function setActiveMoneyInput(input) {
  activeMoneyInput = input;
}

window.setActiveMoneyInput = setActiveMoneyInput;

function insertToActiveMoneyInput(text) {
  if (!activeMoneyInput) {
    alert("请先点击金额输入框。");
    return;
  }

  activeMoneyInput.focus();

  const start = activeMoneyInput.selectionStart ?? activeMoneyInput.value.length;
  const end = activeMoneyInput.selectionEnd ?? activeMoneyInput.value.length;
  const value = activeMoneyInput.value;

  activeMoneyInput.value = value.slice(0, start) + text + value.slice(end);

  const next = start + text.length;
  activeMoneyInput.selectionStart = next;
  activeMoneyInput.selectionEnd = next;

  activeMoneyInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function backspaceActiveMoneyInput() {
  if (!activeMoneyInput) {
    alert("请先点击金额输入框。");
    return;
  }

  activeMoneyInput.focus();

  let start = activeMoneyInput.selectionStart ?? activeMoneyInput.value.length;
  let end = activeMoneyInput.selectionEnd ?? activeMoneyInput.value.length;
  const value = activeMoneyInput.value;

  if (start === end && start > 0) {
    activeMoneyInput.value = value.slice(0, start - 1) + value.slice(end);
    start -= 1;
  } else {
    activeMoneyInput.value = value.slice(0, start) + value.slice(end);
  }

  activeMoneyInput.selectionStart = start;
  activeMoneyInput.selectionEnd = start;

  activeMoneyInput.dispatchEvent(new Event("input", { bubbles: true }));
}

document.addEventListener("pointerdown", (event) => {
  const button = event.target.closest && event.target.closest("#calcToolbar button");
  if (!button) return;

  event.preventDefault();

  if (button.dataset.op) {
    insertToActiveMoneyInput(button.dataset.op);
    return;
  }

  if (button.id === "calcBackspace") {
    backspaceActiveMoneyInput();
  }
});

window.openExprDialog = function(index, side) {
  dialogTarget = { index, side };
  const key = `${side}Expr`;
  el.exprDialogTitle.textContent = side === "income" ? "收入金额详情" : "支出金额详情";
  el.exprDialogText.value = state.rows[index][key] || "";
  el.exprDialog.showModal();
  setTimeout(() => el.exprDialogText.focus(), 50);
};

$("closeExprDialog").addEventListener("click", () => {
  el.exprDialog.close();
});

$("saveExprDialog").addEventListener("click", () => {
  if (!dialogTarget) return;
  const { index, side } = dialogTarget;
  const key = `${side}Expr`;

  state.rows[index][key] = el.exprDialogText.value;
  updateSideCalculation(state.rows[index], side, true);

  persistSoon();
  render();
  el.exprDialog.close();
});

window.deleteRow = async function(index) {
  if (!confirm("删除这一行？")) return;

  state.rows.splice(index, 1);
  if (state.rows.length === 0) state.rows.push(row());

  persistSoon();
  render();
  scheduleLiveRecalc();
};

$("addRowBtn").addEventListener("click", () => {
  state.rows.push(row());
  persistSoon();
  render();
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
});

$("modeBtn").addEventListener("click", () => {
  state.mode = state.mode === "vertical" ? "table" : "vertical";
  persistSoon();
  render();
});

$("compactBtn").addEventListener("click", () => {
  state.compact = !state.compact;
  persistSoon();
  render();
});

el.fontScale.addEventListener("input", () => {
  state.fontScale = Number(el.fontScale.value);
  persistSoon();
  render();
});

function bindEditable(element, callback) {
  element.addEventListener("blur", () => {
    callback(element.textContent.trim());
    persistSoon();
    render();
  });

  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      element.blur();
    }
  });
}

bindEditable(el.appTitle, (value) => state.title = value || "收支核对");
bindEditable(el.incomeNameLabel, (value) => state.labels.incomeName = value || "姓名");
bindEditable(el.incomeMoneyLabel, (value) => state.labels.incomeMoney = value || "金额");
bindEditable(el.incomeTotalLabel, (value) => state.labels.incomeTotal = value || "合计");
bindEditable(el.expenseNameLabel, (value) => state.labels.expenseName = value || "姓名");
bindEditable(el.expenseMoneyLabel, (value) => state.labels.expenseMoney = value || "金额");
bindEditable(el.expenseTotalLabel, (value) => state.labels.expenseTotal = value || "合计");

$("backupBtn").addEventListener("click", () => {
  const payload = { exportedAt: new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `收支核对备份-${new Date().toISOString().slice(0, 10)}.json`);
});

$("importBackupInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    state = normalizeState(payload.state || payload);
    persistSoon();
    render();
    alert("导入成功。");
  } catch (error) {
    alert("导入失败。");
  } finally {
    event.target.value = "";
  }
});

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function visibleRows() {
  return state.rows.filter((rowData) =>
    hasValue(rowData.incomeName) ||
    hasValue(rowData.incomeExpr) ||
    hasValue(rowData.expenseName) ||
    hasValue(rowData.expenseExpr)
  );
}

function linePayload(rowData, side) {
  const name = side === "income" ? rowData.incomeName : rowData.expenseName;
  const expr = side === "income" ? rowData.incomeExpr : rowData.expenseExpr;
  const amount = side === "income" ? rowData.incomeAmount : rowData.expenseAmount;

  const safeName = htmlEscape(name || "-");
  const safeExpr = htmlEscape(cleanExpressionForPayload(expr) || "0");
  return `<b>${safeName}</b>\n<code>${safeExpr}=${formatMoney(amount)}</code>`;
}

function buildAllPayload() {
  return visibleRows()
    .map((rowData) => `${linePayload(rowData, "income")}\n${linePayload(rowData, "expense")}`)
    .join("\n\n");
}

function buildSidePayload(index, side) {
  return linePayload(state.rows[index], side);
}

function previewTextFromHtml(html) {
  return String(html)
    .replaceAll("<b>", "")
    .replaceAll("</b>", "")
    .replaceAll("<code>", "`")
    .replaceAll("</code>", "`")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function updateTelegramPreview() {
  if (el.telegramPreview) el.telegramPreview.value = previewTextFromHtml(buildAllPayload());
}

function selectedTelegramUserIds() {
  return [el.telegramUser.value];
}

function allTelegramUserIds() {
  return TELEGRAM_USERS.map((user) => user.id);
}

async function sendTelegram(chatIds, htmlPayload) {
  const token = el.telegramToken.value.trim();
  localStorage.setItem(TOKEN_KEY, token);

  if (!htmlPayload.trim()) {
    alert("没有可发送内容。");
    return;
  }

  if (!token) {
    await navigator.clipboard.writeText(previewTextFromHtml(htmlPayload));
    el.telegramStatus.textContent = "未填写 Bot Token，内容已复制。";
    return;
  }

  el.telegramStatus.textContent = "发送中…";

  let ok = 0;
  let failed = 0;

  for (const chatId of chatIds) {
    try {
      const body = new URLSearchParams({
        chat_id: chatId,
        text: htmlPayload,
        parse_mode: "HTML",
        disable_web_page_preview: "true"
      });

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        body
      });

      const data = await res.json();
      if (data.ok) ok++;
      else failed++;
    } catch (error) {
      failed++;
    }
  }

  el.telegramStatus.textContent = `发送完成：成功 ${ok}，失败 ${failed}`;
}

window.sendSide = function(index, side) {
  sendTelegram(selectedTelegramUserIds(), buildSidePayload(index, side));
};

$("sendSelectedBtn").addEventListener("click", () => {
  sendTelegram(selectedTelegramUserIds(), buildAllPayload());
});

$("sendAllBtn").addEventListener("click", () => {
  sendTelegram(allTelegramUserIds(), buildAllPayload());
});

$("copyPayloadBtn").addEventListener("click", async () => {
  const text = previewTextFromHtml(buildAllPayload());
  await navigator.clipboard.writeText(text);
  el.telegramStatus.textContent = "内容已复制。";
});

el.telegramToken.addEventListener("input", () => {
  localStorage.setItem(TOKEN_KEY, el.telegramToken.value.trim());
});

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

$("saveImageBtn").addEventListener("click", () => {
  const total = totals();
  const ok = !total.hasError && !total.hasTyping && total.diff === 0;
  const rows = visibleRows();
  const width = 1400;
  const rowH = 60;
  const height = 230 + rows.length * rowH + 110;
  const scale = Math.max(2, window.devicePixelRatio || 2);

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#f4f7fb";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  drawRoundRect(ctx, 36, 36, width - 72, height - 72, 28);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 46px Microsoft YaHei, PingFang SC, Arial";
  ctx.fillText(state.title || "收支核对", 70, 100);

  ctx.fillStyle = ok ? "#16a34a" : "#dc2626";
  drawRoundRect(ctx, width - 210, 58, 140, 48, 24);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Microsoft YaHei, PingFang SC, Arial";
  ctx.fillText(ok ? "成功" : "失败", width - 165, 90);

  const x = 70;
  let y = 145;
  const columns = [
    { x, w: 120, label: state.labels.incomeName },
    { x: x + 120, w: 270, label: state.labels.incomeMoney },
    { x: x + 390, w: 150, label: state.labels.incomeTotal },
    { x: x + 540, w: 120, label: state.labels.expenseName },
    { x: x + 660, w: 270, label: state.labels.expenseMoney },
    { x: x + 930, w: 150, label: state.labels.expenseTotal }
  ];

  ctx.fillStyle = "#e2e8f0";
  drawRoundRect(ctx, x, y, 1080, 46, 14);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 21px Microsoft YaHei, PingFang SC, Arial";
  columns.forEach((column) => ctx.fillText(column.label, column.x + 12, y + 30));
  y += 58;

  rows.forEach((rowData, index) => {
    const status = rowStatus(rowData);

    ctx.fillStyle = index % 2 === 0 ? "#f8fafc" : "#ffffff";
    drawRoundRect(ctx, x, y, 1080, 46, 12);
    ctx.fill();

    ctx.fillStyle = status.type === "ok" ? "#16a34a" : status.type === "wait" || status.type === "typing" ? "#ca8a04" : "#dc2626";
    ctx.fillRect(x, y, 5, 46);

    ctx.font = "bold 19px Microsoft YaHei, PingFang SC, Arial";
    ctx.fillStyle = "#c2410c";
    ctx.fillText(rowData.incomeName || "-", columns[0].x + 12, y + 30);
    ctx.fillText(cleanExpressionForPayload(rowData.incomeExpr) || "0", columns[1].x + 12, y + 30);
    ctx.textAlign = "right";
    ctx.fillText(formatMoney(rowData.incomeAmount), columns[2].x + columns[2].w - 12, y + 30);
    ctx.textAlign = "left";

    ctx.fillStyle = "#0369a1";
    ctx.fillText(rowData.expenseName || "-", columns[3].x + 12, y + 30);
    ctx.fillText(cleanExpressionForPayload(rowData.expenseExpr) || "0", columns[4].x + 12, y + 30);
    ctx.textAlign = "right";
    ctx.fillText(formatMoney(rowData.expenseAmount), columns[5].x + columns[5].w - 12, y + 30);
    ctx.textAlign = "left";

    y += rowH;
  });

  y += 16;
  ctx.fillStyle = "#0f172a";
  drawRoundRect(ctx, x, y, 1080, 68, 18);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Microsoft YaHei, PingFang SC, Arial";
  ctx.fillText(`收入：${formatMoney(total.income)}`, x + 28, y + 43);
  ctx.fillText(`支出：${formatMoney(total.expense)}`, x + 380, y + 43);
  ctx.fillStyle = ok ? "#86efac" : "#fca5a5";
  ctx.fillText(`差额：${formatMoney(total.diff)}`, x + 730, y + 43);

  canvas.toBlob(async (blob) => {
    if (!blob) return alert("保存图片失败。");
    const filename = `收支核对-${new Date().toISOString().slice(0, 10)}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "收支核对" });
        return;
      } catch (error) {}
    }

    downloadBlob(blob, filename);
  }, "image/png", 0.96);
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.addEventListener("pagehide", () => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch (error) {}
});

async function init() {
  state = await loadState();
  el.telegramToken.value = localStorage.getItem(TOKEN_KEY) || "";
  render();
  recalculateEverything();
  setInterval(() => recalculateEverything({ fromWatchdog: false }), 2000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}

init();


/* v12 safety net: any edit-like event schedules live recalculation. */
["input", "change", "keyup", "paste", "blur", "compositionend"].forEach((eventName) => {
  document.addEventListener(eventName, (event) => {
    if (event.target && event.target.classList && event.target.classList.contains("money-editor")) {
      scheduleLiveRecalc();
    }
  }, true);
});
