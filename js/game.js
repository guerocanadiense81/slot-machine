document.addEventListener("DOMContentLoaded", function () {
  let credits = 50;
  let currentBet = 0;
  let winPercentage = 30; // Default win percentage

  const creditDisplay = document.getElementById("totalCredits");
  const spinButton = document.getElementById("spinBtn");
  const resetButton = document.getElementById("resetBtn");
  const betButtons = document.querySelectorAll(".bet");

  const reel1 = document.getElementById("reel1");
  const reel2 = document.getElementById("reel2");
  const reel3 = document.getElementById("reel3");

  const symbols = ["b1", "b2", "b3", "ch", "s7", "sc"];

  // Winning payout table: multiplier per bet if all reels match
  const payouts = {
    "ch,ch,ch": 150,
    "s7,s7,s7": 50,
    "sc,sc,sc": 20,
    "b3,b3,b3": 10,
    "b2,b2,b2": 5,
    "b1,b1,b1": 2
  };

  function updateCredits() {
    creditDisplay.textContent = `Credits: $${credits}`;
  }

  // Set bet amount when bet button is clicked
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
    // Deduct bet
    credits -= currentBet;
    updateCredits();

    // Spin reels with a rolling effect
    const spinReel = (reelElement, finalSymbol, delay) => {
      let interval = setInterval(() => {
        let randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
        reelElement.innerHTML = `<img src="/assets/${randomSymbol}.png" alt="${randomSymbol}" width="80px">`;
      }, 100);
      setTimeout(() => {
        clearInterval(interval);
        reelElement.innerHTML = `<img src="/assets/${finalSymbol}.png" alt="${finalSymbol}" width="80px">`;
      }, delay);
    };

    let result1 = symbols[Math.floor(Math.random() * symbols.length)];
    let result2 = symbols[Math.floor(Math.random() * symbols.length)];
    let result3 = symbols[Math.floor(Math.random() * symbols.length)];

    spinReel(reel1, result1, 1000);
    spinReel(reel2, result2, 1300);
    spinReel(reel3, result3, 1600);

    setTimeout(() => {
      let resultKey = `${result1},${result2},${result3}`;
      if (payouts[resultKey] && Math.random()*100 < winPercentage) {
        let winnings = currentBet * payouts[resultKey];
        credits += winnings;
      }
      updateCredits();
    }, 1700);
  }

  spinButton.addEventListener("click", spinReels);

  resetButton.addEventListener("click", () => {
    credits = 50;
    currentBet = 0;
    updateCredits();
  });

  updateCredits();
});
