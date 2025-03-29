document.addEventListener("DOMContentLoaded", function () {
  let credits = 1000; // Starting credits for free game
  let currentBet = 0;
  let winPercentage = 30; // Default admin win percentage for free version

  const balanceDisplay = document.getElementById("creditsDisplay");
  const spinBtn = document.getElementById("spinBtn");
  const betButtons = document.querySelectorAll(".bet");
  const reels = document.querySelectorAll(".reel img");
  const resetBtn = document.getElementById("resetBtn");

  // Updated payouts
  const payouts = {
    "ch": 50, 
    "s7": 10, 
    "sc": 5, 
    "b3": 4, 
    "b2": 3, 
    "b1": 2
  };

  // Fetch win percentage for free version
  fetch('/api/get-win-percentage-free')
    .then(res => res.json())
    .then(data => winPercentage = data.percentage);

  function updateBalance() {
    balanceDisplay.textContent = credits;
  }

  betButtons.forEach((button, index) => {
    const betValues = [1, 5, 10, 50, 100, 1000];
    button.addEventListener("click", () => {
      currentBet = betValues[index];
      console.log(`Bet set to ${currentBet}`);
    });
  });

  function spinReels() {
    if (credits < currentBet || currentBet <= 0) {
      alert("Not enough credits or no bet selected!");
      return;
    }

    credits -= currentBet;
    updateBalance();

    const result = [];
    const symbolFiles = ["b1.png", "b2.png", "b3.png", "ch.png", "s7.png", "sc.png"];

    reels.forEach((reel, idx) => {
      setTimeout(() => {
        let symbol = symbolFiles[Math.floor(Math.random() * symbolFiles.length)];
        reel.src = `/assets/${symbol}`;
        result[idx] = symbol;
      }, idx * 150);
    });

    setTimeout(() => {
      if (result[0] === result[1] && result[1] === result[2]) {
        const basePayout = payouts[result[0]] || 1;
        const winAmount = currentBet * basePayout * (winPercentage / 100);
        credits += winAmount;
      }
      updateBalance();
    }, 900);
  }

  spinBtn.addEventListener("click", spinReels);
  resetBtn.addEventListener("click", () => {
    credits = 1000;
    updateBalance();
  });

  updateBalance();
});
