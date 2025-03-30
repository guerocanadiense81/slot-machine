document.addEventListener("DOMContentLoaded", () => {
  let credits = 10;
  let currentBet = 1;
  const spinBtn = document.getElementById("spinBtn");
  const totalCredits = document.getElementById("totalCredits");
  const reels = document.querySelectorAll(".reel img");
  const betButtons = document.querySelectorAll(".bet");

  const symbols = ["seven.png", "coins1.png", "crown.png", "goldbar.png"];
  const symbolPayouts = {
    "seven.png": 10,
    "coins1.png": 5,
    "crown.png": 3,
    "goldbar.png": 2
  };

  function updateCredits() {
    totalCredits.textContent = `Credits: ${credits}`;
  }

  spinBtn.addEventListener("click", () => {
    if (credits < currentBet) {
      alert("Not enough credits.");
      return;
    }
    credits -= currentBet;
    const result = [];
    reels.forEach((reel, i) => {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      reel.src = `/assets/${symbol}`;
      result.push(symbol);
    });
    if (result[0] === result[1] && result[1] === result[2]) {
      const payout = currentBet * (symbolPayouts[result[0]] || 1);
      credits += payout;
      alert(`You win ${payout} credits!`);
    }
    updateCredits();
  });

  betButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentBet = parseInt(btn.getAttribute("data-bet"));
      console.log(`Current Bet: ${currentBet}`);
    });
  });

  updateCredits();
});
