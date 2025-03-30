document.addEventListener("DOMContentLoaded", () => {
  let credits = 10;
  const spinBtn = document.getElementById("spinBtn");
  const totalCredits = document.getElementById("totalCredits");
  const reels = document.querySelectorAll(".reel img");
  const betButtons = document.querySelectorAll(".bet");
  const symbols = ["seven.png", "coins1.png", "crown.png", "goldbar.png"];

  let currentBet = 1;

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
      const payout = currentBet * 10;
      credits += payout;
      alert(`You win ${payout} credits!`);
    }

    updateCredits();
  });

  betButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentBet = parseInt(btn.textContent);
    });
  });

  updateCredits();
});
