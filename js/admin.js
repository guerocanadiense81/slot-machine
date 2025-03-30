const API_URL = 'https://slot-machine-a08c.onrender.com';

document.addEventListener("DOMContentLoaded", () => {
  const bonusWallet = document.getElementById("bonusWallet");
  const bonusAmount = document.getElementById("bonusAmount");
  const sendBtn = document.getElementById("sendBonusBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const walletList = document.getElementById("walletList");
  const exportBtn = document.getElementById("exportCSVBtn");

  sendBtn.addEventListener("click", async () => {
    const wallet = bonusWallet.value.trim();
    const amount = parseFloat(bonusAmount.value);

    if (!wallet || isNaN(amount) || amount <= 0) {
      alert("Invalid input.");
      return;
    }

    const res = await fetch(`${API_URL}/api/send-bonus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, amount })
    });

    const result = await res.json();
    if (result.success) {
      alert("Bonus sent!");
      bonusWallet.value = "";
      bonusAmount.value = "";
      loadBalances();
    } else {
      alert("Failed to send bonus.");
    }
  });

  refreshBtn.addEventListener("click", loadBalances);

  exportBtn.addEventListener("click", () => {
    window.location.href = `${API_URL}/api/export-balances`;
  });

  async function loadBalances() {
    const res = await fetch(`${API_URL}/api/balances`);
    const data = await res.json();
    walletList.innerHTML = "";

    Object.entries(data).forEach(([wallet, balance]) => {
      const p = document.createElement("p");
      p.textContent = `${wallet}: ${balance.toFixed(2)} MET`;
      walletList.appendChild(p);
    });
  }

  loadBalances();
});
