const API_URL = 'https://slot-machine-a08c.onrender.com';

document.addEventListener("DOMContentLoaded", function () {
  let credits = 1000; // Default starting credits
  let currentBet = 0;
  let winPercentage = 30;

  const balanceDisplay = document.getElementById("totalCredits");
  const spinBtn = document.getElementById("spinBtn");
  const resetBtn = document.getElementById("resetBtn");
  const reels = document.querySelectorAll(".reel img");
  const betButtons = document.querySelectorAll(".bet");

  const payouts = {
    "ch": 50,
    "s7": 10,
    "sc": 5,
    "b3": 4,
    "b2": 3,
    "b1": 2
  };

  // Update UI
  function updateBalance() {
    balanceDisplay.textContent = `${credits.toFixed(2)} Credits`;
  }

  // Fetch win % for Free Game
  fetch(`${API_URL}/api/get-win-percentages`)
    .then(res => res.json())
    .then(data => winPercentage = data.free || 30);

  // Bet selection
  const betValues = [1, 5, 10, 50, 100, 1000];
  betButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      currentBet = betValues[index];
      console.log(`Selected bet: ${currentBet} credits`);
    });
  });

  // Reset button logic
  resetBtn.addEventListener("click", () => {
    credits = 1000;
    updateBalance();
    alert("Credits have been reset!");
  });

  // Spin Logic
  spinBtn.addEventListener("click", () => {
    if (credits < currentBet || currentBet <= 0) {
      alert("Insufficient credits or bet not selected.");
      return;
    }

    const symbols = ["b1", "b2", "b3", "ch", "s7", "sc"];
    const result = [];

    credits -= currentBet;
    updateBalance();

    // Spin animation
    reels.forEach((reel, i) => {
      setTimeout(() => {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        reel.src = `/assets/${symbol}.png`;
        result[i] = symbol;
      }, i * 200);
    });

    setTimeout(() => {
      // Check win condition (3 of a kind)
      if (result[0] === result[1] && result[1] === result[2]) {
        const basePayout = payouts[result[0]] || 1;
        const winAmount = currentBet * basePayout * (winPercentage / 100);
        credits += winAmount;
        updateBalance();
        console.log(`Win! ${result[0]} x3 pays ${winAmount}`);
      } else {
        console.log("No win this round.");
      }
    }, 1000);
  });

  updateBalance();
});
