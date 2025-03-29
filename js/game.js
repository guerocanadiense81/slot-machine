const API_URL = 'https://slot-machine-a08c.onrender.com';

let winPercentage = 30;
let credits = 0;
let currentBet = 0;

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${API_URL}/api/get-win-percentages`)
    .then(res => res.json())
    .then(data => winPercentage = data.free);

  const spinBtn = document.getElementById("spinBtn");
  const resetBtn = document.getElementById("resetBtn");
  const reels = document.querySelectorAll(".reel img");
  const betButtons = document.querySelectorAll(".bet");

  const payouts = {
    "ch": 50, "s7": 10, "sc": 5, "b3": 4, "b2": 3, "b1": 2
  };

  const symbols = ["b1.png", "b2.png", "b3.png", "ch.png", "s7.png", "sc.png"];

  betButtons.forEach((btn, idx) => {
    const betVals = [1, 5, 10, 50, 100, 1000];
    btn.addEventListener("click", () => {
      currentBet = betVals[idx];
      console.log(`Bet: ${currentBet}`);
    });
  });

  resetBtn.addEventListener("click", () => {
    credits = 0;
    currentBet = 0;
    updateDisplay();
  });

  spinBtn.addEventListener("click", () => {
    if (credits < currentBet || currentBet <= 0) {
      alert("Not enough credits or no bet selected!");
      return;
    }

    credits -= currentBet;
    updateDisplay();

    const result = [];

    reels.forEach((reel, i) => {
      setTimeout(() => {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        reel.src = `/assets/${symbol}`;
        result[i] = symbol;
      }, i * 200);
    });

    setTimeout(() => {
      if (result[0] === result[1] && result[1] === result[2]) {
        const payout = currentBet * (payouts[result[0]] || 1) * (winPercentage / 100);
        credits += payout;
        alert(`You won ${payout.toFixed(2)} credits!`);
        updateDisplay();
      }
    }, 1000);
  });

  function updateDisplay() {
    document.getElementById("totalCredits").textContent = `Credits: ${credits.toFixed(2)}`;
  }

  updateDisplay();
});
