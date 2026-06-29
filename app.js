const DB_NAME = "recon_iphone_table_v8";
const DB_VERSION = 1;
const STATE_STORE = "state";
const IMAGE_STORE = "images";
const STATE_KEY = "current";
const LOCAL_KEY = "recon_iphone_table_state_v8";

let db = null;
let state = defaultState();
let saveTimer = null;

const $ = (id) => document.getElementById(id);

const el = {
  appTitle: $("appTitle"),
  globalStatus: $("globalStatus"),
  globalStatusText: $("globalStatusText"),
  globalStatusSub: $("globalStatusSub"),
  incomeNameLabel: $("incomeNameLabel"),
  incomeMoneyLabel: $("incomeMoneyLabel"),
  expenseNameLabel: $("expenseNameLabel"),
  expenseMoneyLabel: $("expenseMoneyLabel"),
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
};

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function row(incomeName = "", incomeAmount = "", expenseName = "", expenseAmount = "") {
  return {
    id: newId(),
    incomeName,
    incomeAmount,
    expenseName,
    expenseAmount,
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
      expenseName: "姓名",
      expenseMoney: "金额"
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
  return {
    title: input?.title || input?.appTitle || base.title,
    compact: Boolean(input?.compact),
    mode: input?.mode === "vertical" ? "vertical" : "table",
    fontScale: Number(input?.fontScale || 100),
    labels: { ...base.labels, ...(input?.labels || {}) },
    rows: Array.isArray(input?.rows) && input.rows.length ? input.rows.map((r) => ({
      id: r.id || newId(),
      incomeName: r.incomeName ?? "",
      incomeAmount: r.incomeAmount ?? "",
      expenseName: r.expenseName ?? "",
      expenseAmount: r.expenseAmount ?? "",
      imageId: r.imageId ?? null,
      imageName: r.imageName ?? ""
    })) : base.rows
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
    .replace(/）/g, ")");
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
  const input = normalizeFullWidth(expression)
    .replace(/\s+/g, "")
    .replace(/[^\d+\-*/().,]/g, "");

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

function evaluateExpression(expression) {
  if (expression === "" || expression === null || expression === undefined) return 0;

  const tokens = tokenizeExpression(expression);
  if (!tokens || tokens.length === 0) return NaN;
  let pos = 0;

  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }

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
  if (pos !== tokens.length) return NaN;
  return Number.isFinite(result) ? result : NaN;
}

function parseMoney(value) {
  return evaluateExpression(value);
}

function displayAmount(value) {
  const n = parseMoney(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

function hasValue(value) {
  return String(value ?? "").trim() !== "";
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function rowStatus(r) {
  const income = parseMoney(r.incomeAmount);
  const expense = parseMoney(r.expenseAmount);

  if (!Number.isFinite(income) || !Number.isFinite(expense)) {
    return { type: "bad", text: "金额错误" };
  }

  const hasIncome = hasValue(r.incomeAmount);
  const hasExpense = hasValue(r.expenseAmount);

  if (!hasIncome && !hasExpense) return { type: "wait", text: "待输入" };
  if (!hasIncome || !hasExpense) return { type: "wait", text: "待匹配" };
  if (income === expense) return { type: "ok", text: "一致" };

  return { type: "bad", text: `差 ${formatMoney(income - expense)}` };
}

function totals() {
  let invalid = false;
  const total = state.rows.reduce((acc, r) => {
    const income = parseMoney(r.incomeAmount);
    const expense = parseMoney(r.expenseAmount);

    if (!Number.isFinite(income) || !Number.isFinite(expense)) {
      invalid = true;
      return acc;
    }

    acc.income += income;
    acc.expense += expense;
    return acc;
  }, { income: 0, expense: 0 });

  total.diff = total.income - total.expense;
  total.invalid = invalid;
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

function amountInput(index, field, value) {
  return `<input class="money-input" type="text" inputmode="decimal"
    value="${escapeHtml(value)}" placeholder="0"
    oninput="updateRow(${index}, '${field}', this.value)"
    onblur="normalizeAmount(${index}, '${field}', this)" />`;
}

function renderTable() {
  el.tableRows.innerHTML = state.rows.map((r, index) => {
    const status = rowStatus(r);
    const hasImage = Boolean(r.imageId);

    return `
      <article class="row-wrap ${status.type}">
        <div class="data-grid">
          <div class="cell income">
            <input value="${escapeHtml(r.incomeName)}" placeholder="收入来源"
              oninput="updateRow(${index}, 'incomeName', this.value)" />
          </div>
          <div class="cell income">${amountInput(index, "incomeAmount", r.incomeAmount)}</div>
          <div class="cell expense">
            <input value="${escapeHtml(r.expenseName)}" placeholder="支出去向"
              oninput="updateRow(${index}, 'expenseName', this.value)" />
          </div>
          <div class="cell expense">${amountInput(index, "expenseAmount", r.expenseAmount)}</div>
        </div>
        <div class="row-meta">
          <span class="pill ${status.type}">${escapeHtml(status.text)}</span>
          <div class="row-actions">
            <button class="icon-btn ${hasImage ? "image-on" : ""}" onclick="pickImage(${index})" title="上传图片">图</button>
            <button class="icon-btn" onclick="viewImage(${index})" ${hasImage ? "" : "disabled"} title="查看图片">看</button>
            <button class="icon-btn danger" onclick="deleteRow(${index})" title="删除">×</button>
            <input id="imageInput-${index}" type="file" accept="image/*" hidden onchange="storeImage(${index}, this.files[0])" />
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderVertical() {
  el.verticalRows.innerHTML = state.rows.map((r, index) => {
    const status = rowStatus(r);
    const hasImage = Boolean(r.imageId);

    return `
      <article class="v-card">
        <header class="v-head">
          <span class="pill ${status.type}">${escapeHtml(status.text)}</span>
          <div class="row-actions">
            <button class="icon-btn ${hasImage ? "image-on" : ""}" onclick="pickImage(${index})">图</button>
            <button class="icon-btn" onclick="viewImage(${index})" ${hasImage ? "" : "disabled"}>看</button>
            <button class="icon-btn danger" onclick="deleteRow(${index})">×</button>
          </div>
        </header>
        <div class="v-body">
          <section class="v-side income">
            <div class="v-side-title">收入</div>
            <div class="v-fields">
              <div class="v-field">
                <label>${escapeHtml(state.labels.incomeName)}</label>
                <input value="${escapeHtml(r.incomeName)}" placeholder="收入来源"
                  oninput="updateRow(${index}, 'incomeName', this.value)" />
              </div>
              <div class="v-field">
                <label>${escapeHtml(state.labels.incomeMoney)}</label>
                ${amountInput(index, "incomeAmount", r.incomeAmount)}
              </div>
            </div>
          </section>
          <section class="v-side expense">
            <div class="v-side-title">支出</div>
            <div class="v-fields">
              <div class="v-field">
                <label>${escapeHtml(state.labels.expenseName)}</label>
                <input value="${escapeHtml(r.expenseName)}" placeholder="支出去向"
                  oninput="updateRow(${index}, 'expenseName', this.value)" />
              </div>
              <div class="v-field">
                <label>${escapeHtml(state.labels.expenseMoney)}</label>
                ${amountInput(index, "expenseAmount", r.expenseAmount)}
              </div>
            </div>
          </section>
        </div>
      </article>
    `;
  }).join("");
}

function renderTotals() {
  const t = totals();
  const allEmpty = state.rows.every((r) => !hasValue(r.incomeAmount) && !hasValue(r.expenseAmount));

  el.totalIncome.textContent = formatMoney(t.income);
  el.totalExpense.textContent = formatMoney(t.expense);
  el.difference.textContent = formatMoney(t.diff);

  let cls = "ok";
  let text = "成功";
  let sub = "已平衡";

  if (t.invalid) {
    cls = "bad";
    text = "失败";
    sub = "金额错误";
  } else if (allEmpty) {
    cls = "wait";
    text = "待输入";
    sub = "请填写";
  } else if (t.diff !== 0) {
    cls = "bad";
    text = "失败";
    sub = `差 ${formatMoney(t.diff)}`;
  }

  el.globalStatus.className = `status-chip ${cls}`;
  el.globalStatusText.textContent = text;
  el.globalStatusSub.textContent = sub;
  el.diffBox.className = cls;
}

function render() {
  document.documentElement.style.setProperty("--scale", state.fontScale / 100);
  document.body.classList.toggle("compact", state.compact);
  document.body.classList.toggle("vertical", state.mode === "vertical");

  el.appTitle.textContent = state.title;
  el.incomeNameLabel.textContent = state.labels.incomeName;
  el.incomeMoneyLabel.textContent = state.labels.incomeMoney;
  el.expenseNameLabel.textContent = state.labels.expenseName;
  el.expenseMoneyLabel.textContent = state.labels.expenseMoney;
  el.fontScale.value = state.fontScale;
  el.modeBtn.textContent = state.mode === "vertical" ? "表格" : "纵向";
  el.compactBtn.textContent = state.compact ? "舒适" : "紧凑";

  renderTable();
  renderVertical();
  renderTotals();
}

window.updateRow = function(index, field, value) {
  state.rows[index][field] = value;
  persistSoon();
  renderTotals();

  if (field.includes("Amount")) {
    const tableRow = el.tableRows.children[index];
    const status = rowStatus(state.rows[index]);
    if (tableRow) {
      tableRow.className = `row-wrap ${status.type}`;
      const pill = tableRow.querySelector(".pill");
      if (pill) {
        pill.className = `pill ${status.type}`;
        pill.textContent = status.text;
      }
    }
  }
};

window.normalizeAmount = function(index, field, input) {
  const raw = input.value.trim();
  const calculated = parseMoney(raw);

  if (raw === "") {
    state.rows[index][field] = "";
    input.value = "";
  } else if (Number.isFinite(calculated)) {
    const normalized = displayAmount(raw);
    state.rows[index][field] = normalized;
    input.value = normalized;
  } else {
    input.classList.add("input-error");
    setTimeout(() => input.classList.remove("input-error"), 900);
  }

  persistSoon();
  render();
};

window.deleteRow = async function(index) {
  if (!confirm("删除这一行？")) return;
  const imageId = state.rows[index]?.imageId;
  if (imageId) await dbDelete(IMAGE_STORE, imageId);

  state.rows.splice(index, 1);
  if (state.rows.length === 0) state.rows.push(row());

  persistSoon();
  render();
};

window.pickImage = function(index) {
  document.getElementById(`imageInput-${index}`).click();
};

window.storeImage = async function(index, file) {
  if (!file) return;
  const imageId = state.rows[index].imageId || newId();
  await dbSet(IMAGE_STORE, imageId, file);
  state.rows[index].imageId = imageId;
  state.rows[index].imageName = file.name || "图片";
  persistSoon();
  render();
};

window.viewImage = async function(index) {
  const imageId = state.rows[index]?.imageId;
  if (!imageId) return;

  const blob = await dbGet(IMAGE_STORE, imageId);
  if (!blob) {
    alert("图片不存在。");
    return;
  }

  const url = URL.createObjectURL(blob);
  const img = $("previewImage");
  img.src = url;
  $("imageDialog").showModal();
};

$("closeImageDialog").addEventListener("click", () => {
  const img = $("previewImage");
  if (img.src) URL.revokeObjectURL(img.src);
  $("imageDialog").close();
});

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

bindEditable(el.appTitle, (v) => state.title = v || "收支核对");
bindEditable(el.incomeNameLabel, (v) => state.labels.incomeName = v || "姓名");
bindEditable(el.incomeMoneyLabel, (v) => state.labels.incomeMoney = v || "金额");
bindEditable(el.expenseNameLabel, (v) => state.labels.expenseName = v || "姓名");
bindEditable(el.expenseMoneyLabel, (v) => state.labels.expenseMoney = v || "金额");

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
  const t = totals();
  const ok = !t.invalid && t.diff === 0;
  const width = 1200;
  const rowH = 58;
  const height = 220 + state.rows.length * rowH + 110;
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
  const colW = [300, 170, 300, 170];
  const colX = [x, x + 300, x + 470, x + 770];

  ctx.fillStyle = "#e2e8f0";
  drawRoundRect(ctx, x, y, 940, 46, 14);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 22px Microsoft YaHei, PingFang SC, Arial";
  [state.labels.incomeName, state.labels.incomeMoney, state.labels.expenseName, state.labels.expenseMoney]
    .forEach((label, i) => ctx.fillText(label, colX[i] + 14, y + 30));

  y += 58;

  state.rows.forEach((r, i) => {
    const status = rowStatus(r);
    ctx.fillStyle = i % 2 === 0 ? "#f8fafc" : "#ffffff";
    drawRoundRect(ctx, x, y, 940, 46, 12);
    ctx.fill();

    ctx.fillStyle = status.type === "ok" ? "#16a34a" : status.type === "wait" ? "#ca8a04" : "#dc2626";
    ctx.fillRect(x, y, 5, 46);

    ctx.font = "bold 21px Microsoft YaHei, PingFang SC, Arial";
    ctx.fillStyle = "#0369a1";
    ctx.fillText(r.incomeName || "-", colX[0] + 14, y + 30);
    ctx.textAlign = "right";
    ctx.fillText(formatMoney(Number.isFinite(parseMoney(r.incomeAmount)) ? parseMoney(r.incomeAmount) : 0), colX[1] + colW[1] - 14, y + 30);
    ctx.textAlign = "left";

    ctx.fillStyle = "#c2410c";
    ctx.fillText(r.expenseName || "-", colX[2] + 14, y + 30);
    ctx.textAlign = "right";
    ctx.fillText(formatMoney(Number.isFinite(parseMoney(r.expenseAmount)) ? parseMoney(r.expenseAmount) : 0), colX[3] + colW[3] - 14, y + 30);
    ctx.textAlign = "left";

    ctx.fillStyle = status.type === "ok" ? "#16a34a" : status.type === "wait" ? "#ca8a04" : "#dc2626";
    ctx.fillText(status.text, x + 970, y + 30);

    y += rowH;
  });

  y += 16;
  ctx.fillStyle = "#0f172a";
  drawRoundRect(ctx, x, y, 1040, 68, 18);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Microsoft YaHei, PingFang SC, Arial";
  ctx.fillText(`收入：${formatMoney(t.income)}`, x + 28, y + 43);
  ctx.fillText(`支出：${formatMoney(t.expense)}`, x + 360, y + 43);
  ctx.fillStyle = ok ? "#86efac" : "#fca5a5";
  ctx.fillText(`差额：${formatMoney(t.diff)}`, x + 690, y + 43);

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
  }, "image/png", .96);
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
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}

init();
