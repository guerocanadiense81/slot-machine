const API_URL = 'https://slot-machine-a08c.onrender.com';

document.addEventListener("DOMContentLoaded", () => {
  const paidWinPercent = document.getElementById("paidWinPercent");
  const freeWinPercent = document.getElementById("freeWinPercent");
  const updateBtn = document.getElementById("updateWinBtn");
  const exportLogBtn = document.getElementById("exportLogsBtn");
  const bonusForm = document.getElementById("bonusForm");
  const userTableBody = document.getElementById("userTableBody");

  // Load current win percentages
  fetch(`${API_URL}/api/get-win-percentages`)
    .then(res => res.json())
    .then(data => {
      paidWinPercent.value = data.paid;
      freeWinPercent.value = data.free;
    });

  // Update win percentages
  updateBtn.addEventListener("click", () => {
    const paid = parseInt(paidWinPercent.value);
    const free = parseInt(freeWinPercent.value);
    fetch(`${API_URL}/api/update-win-percentages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid, free }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) alert("✅ Win percentages updated.");
        else alert("❌ Failed to update.");
      });
  });

  // Export logs
  exportLogBtn.addEventListener("click", () => {
    window.open(`${API_URL}/api/export-logs`);
  });

  // Bonus form handler
  bonusForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const wallet = document.getElementById("bonusWallet").value.trim();
    const amount = parseFloat(document.getElementById("bonusAmount").value);

    if (!wallet || isNaN(amount) || amount <= 0) {
      return alert("Enter valid wallet and amount.");
    }

    const res = await fetch(`${API_URL}/api/send-bonus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, amount }),
    });

    const result = await res.json();
    if (result.success) {
      alert("🎁 Bonus sent!");
      bonusForm.reset();
      loadUserBalances();
    } else {
      alert("❌ Failed to send bonus.");
    }
  });

  // Load off-chain balances
  async function loadUserBalances() {
    try {
      const res = await fetch(`${API_URL}/api/get-balances`);
      const users = await res.json();
      userTableBody.innerHTML = "";

      Object.entries(users).forEach(([wallet, balance], i) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${i + 1}</td>
          <td>${wallet}</td>
          <td>${balance.toFixed(2)} MET</td>
        `;
        userTableBody.appendChild(row);
      });
    } catch (err) {
      console.error("Failed to load user balances", err);
    }
  }

  loadUserBalances();
});
