const API_URL = 'https://slot-machine-a08c.onrender.com';

document.addEventListener("DOMContentLoaded", function () {
  fetch(`${API_URL}/api/get-win-percentages`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("paidWinPercent").value = data.paid;
      document.getElementById("freeWinPercent").value = data.free;
    });

  document.getElementById("updateWinBtn").addEventListener("click", () => {
    const paid = parseInt(document.getElementById("paidWinPercent").value);
    const free = parseInt(document.getElementById("freeWinPercent").value);

    fetch(`${API_URL}/api/update-win-percent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "paid", percent: paid }),
    });

    fetch(`${API_URL}/api/update-win-percent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "free", percent: free }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) alert("Win percentages updated!");
        else alert("Failed to update.");
      });
  });
});
​
