const STORAGE_KEY = "finance-table-v2";

const defaultRows = [
  { name: "莺莺备用2", income: "10", expense: "", tone: "cyan" },
  { name: "呵呵支付宝", income: "", expense: "5404", tone: "yellow" },
  { name: "", income: "", expense: "", tone: "blank" },
  { name: "忍者支付宝", income: "", expense: "", tone: "cyan" },
  { name: "秀支", income: "", expense: "", tone: "yellow" },
  { name: "", income: "", expense: "", tone: "blank" },
  { name: "小河123微", income: "", expense: "", tone: "yellow" },
  { name: "哎呦喂微", income: "", expense: "", tone: "cyan" },
  { name: "秦法拉", income: "", expense: "", tone: "yellow" },
  { name: "", income: "", expense: "", tone: "blank" },
  { name: "世纪备3微信", income: "", expense: "", tone: "cyan" },
  { name: "三山农信", income: "", expense: "", tone: "yellow" },
  { name: "", income: "", expense: "", tone: "blank" },
  { name: "主号财务", income: "", expense: "", tone: "yellow" },
  { name: "天空财务", income: "", expense: "", tone: "cyan" },
  { name: "清晨财务", income: "", expense: "", tone: "yellow" },
  { name: "", income: "", expense: "", tone: "blank" },
  { name: "诚信换钱", income: "", expense: "", tone: "yellow" },
  { name: "北京女人", income: "", expense: "", tone: "cyan" },
  { name: "", income: "", expense: "", tone: "blank" },
  { name: "啊哥", income: "", expense: "", tone: "yellow" },
  { name: "提现", income: "", expense: "", tone: "cyan" },
  { name: "报销", income: "", expense: "", tone: "blank" }
];

let state = loadState();

const tableHeader = document.getElementById("tableHeader");
const tableBody = document.getElementById("tableBody");
const rowDialog = document.getElementById("rowDialog");
const columnDialog = document.getElementById("columnDialog");

document.getElementById("addRowBtn").addEventListener("click", () => {
  document.getElementById("newRowName").value = "";
  rowDialog.showModal();
});

document.getElementById("confirmAddRow").addEventListener("click", (event) => {
  event.preventDefault();
  addRow(document.getElementById("newRowName").value.trim());
  rowDialog.close();
});

document.getElementById("addColumnBtn").addEventListener("click", () => {
  document.getElementById("newColumnName").value = "";
  columnDialog.showModal();
});

document.getElementById("confirmAddColumn").addEventListener("click", (event) => {
  event.preventDefault();
  const name = document.getElementById("newColumnName").value.trim();
  if (name) addColumn(name);
  columnDialog.close();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("恢复默认模板？Data akan kembali ke template awal.")) return;
  state = createDefaultState();
  persist();
  render();
});

document.getElementById("clearNumberBtn").addEventListener("click", () => {
  if (!confirm("清空所有金额？Nama tetap dipertahankan.")) return;
  state.rows = state.rows.map(row => ({ ...row, income: "", expense: "" }));
  persist();
  render();
});

function createDefaultState() {
  return {
    columns: [],
    rows: defaultRows.map(row => ({ ...row, extra: {} }))
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.rows)) {
      return {
        columns: Array.isArray(saved.columns) ? saved.columns : [],
        rows: saved.rows.map((row, index) => ({
          name: row.name ?? "",
          income: row.income ?? "",
          expense: row.expense ?? "",
          tone: row.tone ?? autoTone(index),
          extra: row.extra ?? {}
        }))
      };
    }
  } catch (error) {
    console.warn("Cannot load saved data", error);
  }
  return createDefaultState();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function autoTone(index) {
  const tones = ["yellow", "cyan"];
  return tones[index % 2];
}

function parseMoney(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : NaN;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function totalsFromRows() {
  let invalid = false;

  const totals = state.rows.reduce((acc, row) => {
    const income = parseMoney(row.income);
    const expense = parseMoney(row.expense);

    if (!Number.isFinite(income) || !Number.isFinite(expense)) {
      invalid = true;
      return acc;
    }

    acc.income += income;
    acc.expense += expense;
    return acc;
  }, { income: 0, expense: 0 });

  return { ...totals, invalid };
}

function renderHeader() {
  tableHeader.innerHTML = `
    <th>姓名</th>
    <th>收入</th>
    <th>支出</th>
    ${state.columns.map(col => `<th>${escapeHtml(col)} <button class="delete-row" title="删除列" onclick="deleteColumn('${escapeAttr(col)}')">×</button></th>`).join("")}
    <th style="width:52px"></th>
  `;
}

function renderBody() {
  tableBody.innerHTML = state.rows.map((row, index) => {
    const extraCells = state.columns.map(col => `
      <td>
        <input class="cell-input" value="${escapeAttr(row.extra?.[col] ?? "")}"
          oninput="updateExtra(${index}, '${escapeAttr(col)}', this.value)" />
      </td>
    `).join("");

    return `
      <tr class="row-${row.tone}">
        <td class="name-cell">
          <input class="cell-input" value="${escapeAttr(row.name)}"
            oninput="updateRow(${index}, 'name', this.value)" />
        </td>
        <td class="income-cell">
          <input class="cell-input number-input" type="number" min="0" inputmode="decimal"
            value="${escapeAttr(row.income)}" oninput="updateRow(${index}, 'income', this.value)" />
        </td>
        <td class="expense-cell ${row.expense ? "expense-filled" : ""}">
          <input class="cell-input number-input" type="number" min="0" inputmode="decimal"
            value="${escapeAttr(row.expense)}" oninput="updateRow(${index}, 'expense', this.value)" />
        </td>
        ${extraCells}
        <td>
          <button class="delete-row" title="删除行" onclick="deleteRow(${index})">×</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderTotals() {
  const totals = totalsFromRows();

  document.getElementById("footerIncome").textContent = formatMoney(totals.income);
  document.getElementById("footerExpense").textContent = formatMoney(totals.expense);

  document.getElementById("summaryIncome").textContent = formatMoney(totals.income);
  document.getElementById("summaryExpense").textContent = formatMoney(totals.expense);
  document.getElementById("summaryBalance").textContent = formatMoney(totals.income - totals.expense);

  validate(totals);
}

function validate(totals) {
  const footerIncome = document.getElementById("footerIncome").textContent;
  const footerExpense = document.getElementById("footerExpense").textContent;
  const summaryIncome = document.getElementById("summaryIncome").textContent;
  const summaryExpense = document.getElementById("summaryExpense").textContent;

  const isMatch =
    !totals.invalid &&
    footerIncome === summaryIncome &&
    footerExpense === summaryExpense;

  const checkCard = document.getElementById("checkCard");
  const statusBadge = document.getElementById("statusBadge");

  if (isMatch) {
    checkCard.className = "check-card success";
    statusBadge.className = "status-badge success";
    document.getElementById("checkIcon").textContent = "✓";
    document.getElementById("checkTitle").textContent = "SUCCESS";
    document.getElementById("checkMessage").textContent = "左右合计一致 / Total kanan dan kiri cocok.";
    statusBadge.textContent = "SUCCESS";
  } else {
    checkCard.className = "check-card failed";
    statusBadge.className = "status-badge failed";
    document.getElementById("checkIcon").textContent = "!";
    document.getElementById("checkTitle").textContent = "FAILED";
    document.getElementById("checkMessage").textContent = "合计不一致或数字无效 / Total tidak cocok atau ada angka tidak valid.";
    statusBadge.textContent = "FAILED";
  }
}

function render() {
  renderHeader();
  renderBody();
  renderTotals();
}

function updateRow(index, field, value) {
  state.rows[index][field] = value;
  persist();

  if (field === "expense") {
    renderBody();
  }

  renderTotals();
}

function updateExtra(index, column, value) {
  state.rows[index].extra = state.rows[index].extra || {};
  state.rows[index].extra[column] = value;
  persist();
}

function addRow(name = "") {
  const lastTone = state.rows.length > 0 ? state.rows[state.rows.length - 1].tone : "cyan";
  const nextTone = lastTone === "cyan" ? "yellow" : "cyan";

  state.rows.push({
    name,
    income: "",
    expense: "",
    tone: nextTone,
    extra: {}
  });

  persist();
  render();
}

function deleteRow(index) {
  state.rows.splice(index, 1);
  persist();
  render();
}

function addColumn(name) {
  if (["姓名", "收入", "支出", "合计"].includes(name)) {
    alert("列名已保留，请使用其他名称。");
    return;
  }

  if (state.columns.includes(name)) {
    alert("列名已存在。");
    return;
  }

  state.columns.push(name);
  state.rows = state.rows.map(row => ({
    ...row,
    extra: { ...(row.extra || {}), [name]: "" }
  }));

  persist();
  render();
}

function deleteColumn(name) {
  if (!confirm(`删除列：${name} ?`)) return;

  state.columns = state.columns.filter(col => col !== name);
  state.rows = state.rows.map(row => {
    const extra = { ...(row.extra || {}) };
    delete extra[name];
    return { ...row, extra };
  });

  persist();
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

render();
