document.addEventListener("DOMContentLoaded", () => {
  let credits = 10;
  let currentBet = 1;

  const spinBtn = document.getElementById("spinBtn");
  const totalCredits = document.getElementById("totalCredits");
  const reels = document.querySelectorAll(".reel img");
  const betButtons = document.querySelectorAll(".bet");

  const symbols = [
    "seven.png",
    "coins1.png",
    "crown.png",
    "goldbar.png"
  ];

  function updateCredits() {
    totalCredits.textContent = `Credits: ${credits}`;
  }

  function spinReels() {
    if (credits < currentBet) {
      alert("Not enough credits.");
      return;
    }

    credits -= currentBet;
    const result = [];

    reels.forEach((reel, i) => {
      reel.classList.add("spinning"); // animation class
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      setTimeout(() => {
        reel.src = `/assets/${symbol}`;
        reel.classList.remove("spinning");
        result[i] = symbol;
      }, i * 200);
    });

    setTimeout(() => {
      if (result[0] === result[1] && result[1] === result[2]) {
        const payout = currentBet * 10;
        credits += payout;
        alert(`🎉 You win ${payout} credits!`);
      }
      updateCredits();
    }, 700);
  }

  // Spin button event
  spinBtn.addEventListener("click", spinReels);

  // Bet button event
  betButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const betValue = parseInt(btn.textContent);
      if (!isNaN(betValue)) {
        currentBet = betValue;
        console.log(`Current Bet: ${currentBet}`);
      }
    });
  });

  updateCredits();
});
