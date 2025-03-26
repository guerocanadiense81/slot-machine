document.addEventListener("DOMContentLoaded", function () {
  let credits = 100; // Placeholder initial MET balance
  let currentBet = 0;
  let winPercentage = 30; // Default win percentage; will be fetched from backend

  const API_URL = 'https://slot-machine-a08c.onrender.com'; // Update with your Render backend URL
  const balanceDisplay = document.getElementById("metBalance");
  const spinBtn = document.getElementById("spinBtn");
  const betButtons = document.querySelectorAll(".bet");
  const reels = document.querySelectorAll(".reel img");

  // Fetch win percentage from backend
  fetch(`${API_URL}/api/get-win-percentage`)
    .then(res => res.json())
    .then(data => winPercentage = data.percentage);

  function updateBalance() {
    balanceDisplay.textContent = credits;
  }

  betButtons.forEach((button, index) => {
    const betValues = [1, 5, 10, 50, 100, 1000];
    button.addEventListener("click", () => {
      currentBet = betValues[index];
      console.log(`Bet set to ${currentBet} MET`);
    });
  });

  function spinReels() {
    if (credits < currentBet || currentBet <= 0) {
      alert("Not enough MET tokens or no bet selected!");
      return;
    }
    credits -= currentBet;
    updateBalance();

    let result = [];
    const symbols = ["b1.png", "b2.png", "b3.png", "ch.png", "s7.png", "sc.png"];

    reels.forEach((reel, idx) => {
      setTimeout(() => {
        let randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
        reel.src = `/assets/${randomSymbol}`;
        result[idx] = randomSymbol;
      }, idx * 200);
    });

    setTimeout(() => {
      if (result[0] === result[1] && result[1] === result[2] && Math.random()*100 < winPercentage) {
        let multiplier = 1;
        if (result[0] === "ch.png") multiplier = 150;
        else if (result[0] === "s7.png") multiplier = 50;
        else if (result[0] === "sc.png") multiplier = 20;
        else if (result[0] === "b3.png") multiplier = 10;
        else if (result[0] === "b2.png") multiplier = 5;
        else if (result[0] === "b1.png") multiplier = 2;
        let winnings = currentBet * multiplier;
        credits += winnings;
      }
      updateBalance();
    }, 1000);
  }

  spinBtn.addEventListener("click", spinReels);

  updateBalance();
});
