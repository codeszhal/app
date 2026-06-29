const nameInput = document.getElementById("name");
const incomeInput = document.getElementById("income");
const expenseInput = document.getElementById("expense");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const list = document.getElementById("list");

let records = JSON.parse(localStorage.getItem("financeRecords") || "[]");

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function saveRecords() {
  localStorage.setItem("financeRecords", JSON.stringify(records));
}

function render() {
  const totalIncome = records.reduce((sum, r) => sum + Number(r.income || 0), 0);
  const totalExpense = records.reduce((sum, r) => sum + Number(r.expense || 0), 0);

  document.getElementById("totalIncome").textContent = formatNumber(totalIncome);
  document.getElementById("totalExpense").textContent = formatNumber(totalExpense);
  document.getElementById("balance").textContent = formatNumber(totalIncome - totalExpense);

  if (records.length === 0) {
    list.innerHTML = "<p class='subtitle'>Belum ada data.</p>";
    return;
  }

  list.innerHTML = records.map((r, index) => `
    <div class="item">
      <div>
        <strong>${r.name || "-"}</strong><br />
        <small>收入 ${formatNumber(r.income)} · 支出 ${formatNumber(r.expense)}</small>
      </div>
      <button class="small" onclick="deleteRecord(${index})">删除</button>
    </div>
  `).join("");
}

function deleteRecord(index) {
  records.splice(index, 1);
  saveRecords();
  render();
}

saveBtn.addEventListener("click", () => {
  records.push({
    name: nameInput.value.trim(),
    income: Number(incomeInput.value || 0),
    expense: Number(expenseInput.value || 0),
    createdAt: new Date().toISOString()
  });

  nameInput.value = "";
  incomeInput.value = "";
  expenseInput.value = "";

  saveRecords();
  render();
});

clearBtn.addEventListener("click", () => {
  if (confirm("Hapus semua data?")) {
    records = [];
    saveRecords();
    render();
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

render();
