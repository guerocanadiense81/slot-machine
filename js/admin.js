const API_URL = 'https://slot-machine-a08c.onrender.com';

document.addEventListener("DOMContentLoaded", () => {
  const paidWinPercent = document.getElementById("paidWinPercent");
  const freeWinPercent = document.getElementById("freeWinPercent");
  const updateBtn = document.getElementById("updateWinBtn");
  const bonusForm = document.getElementById("bonusForm");
  const refreshBtn = document.getElementById("refreshBtn");
  const exportLogsBtn = document.getElementById("exportLogsBtn");
  const userTableBody = document.getElementById("userTableBody");

  // Load current win percentages
  fetch(`${API_URL}/api/get-win-percentages`)
    .then(res => res.json())
    .then(data => {
      paidWinPercent.value = data.paid;
      freeWinPercent.value = data.free;
    });

  updateBtn.addEventListener("click", () => {
    const paid = parseInt(paidWinPercent.value);
    const free = parseInt(freeWinPercent.value);
    fetch(`${API_URL}/api/update-win-percentages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer YOUR_ADMIN_JWT" },
      body: JSON.stringify({ paid, free })
    })
      .then(res => res.json())
      .then(data => {
        alert(data.success ? "Win percentages updated!" : "Failed to update.");
      });
  });

  bonusForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const wallet = document.getElementById("bonusWallet").value.trim();
    const amount = parseFloat(document.getElementById("bonusAmount").value);
    if (!wallet || isNaN(amount) || amount <= 0) {
      alert("Invalid input.");
      return;
    }
    const res = await fetch(`${API_URL}/api/send-bonus`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer YOUR_ADMIN_JWT" },
      body: JSON.stringify({ wallet, amount })
    });
    const result = await res.json();
    alert(result.success ? "Bonus sent!" : "Bonus failed.");
    loadBalances();
    bonusForm.reset();
  });

  async function loadBalances() {
    const res = await fetch(`${API_URL}/api/get-balances`, {
      headers: { Authorization: "Bearer YOUR_ADMIN_JWT" }
    });
    const data = await res.json();
    userTableBody.innerHTML = "";
    let idx = 1;
    for (const [wallet, credit] of Object.entries(data)) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${idx++}</td><td>${wallet}</td><td>${parseFloat(credit).toFixed(2)} MET</td>`;
      userTableBody.appendChild(tr);
    }
  }

  refreshBtn.addEventListener("click", loadBalances);
  exportLogsBtn.addEventListener("click", () => {
    window.location.href = `${API_URL}/api/export-logs`;
  });

  loadBalances();
});
