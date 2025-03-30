const API_URL = 'https://slot-machine-a08c.onrender.com';

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${API_URL}/api/get-win-percentages`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("freeWinPercent").value = data.free;
      document.getElementById("paidWinPercent").value = data.paid;
    });

  document.getElementById("updateWinBtn").addEventListener("click", () => {
    const free = parseInt(document.getElementById("freeWinPercent").value);
    const paid = parseInt(document.getElementById("paidWinPercent").value);
    fetch(`${API_URL}/api/update-win-percentages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ free, paid })
    })
    .then(res => res.json())
    .then(data => alert(data.success ? "Updated!" : "Failed"));
  });

  document.getElementById("sendBonusBtn").addEventListener("click", () => {
    const wallet = document.getElementById("bonusWallet").value;
    const amount = document.getElementById("bonusAmount").value;
    fetch(`${API_URL}/api/send-bonus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, amount })
    })
    .then(res => res.json())
    .then(data => alert(data.success ? "Bonus sent!" : "Failed to send bonus"));
  });

  function loadPlayers() {
    fetch(`${API_URL}/api/player-balances`)
      .then(res => res.json())
      .then(data => {
        const list = document.getElementById("playerList");
        list.innerHTML = "";
        data.players.forEach(p => {
          list.innerHTML += `<div>${p.wallet}: ${p.credits} MET</div>`;
        });
      });
  }

  loadPlayers();
});
