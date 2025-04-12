document.addEventListener("DOMContentLoaded", async () => {
  // Check if the admin login form exists (i.e. if we are on admin-login.html)
  const loginForm = document.getElementById("adminLoginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;
      try {
        const res = await fetch("/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
          // Save the token in localStorage and redirect to admin panel
          localStorage.setItem("adminToken", data.token);
          window.location.href = "/admin.html";
        } else {
          document.getElementById("adminLoginMessage").innerText = "Login failed.";
        }
      } catch (error) {
        document.getElementById("adminLoginMessage").innerText = "Error during login.";
      }
    });
  }

  // If we are on admin.html (admin panel)...
  const winInput = document.getElementById("winPercentageInput");
  if (winInput) {
    // Check for a valid admin token
    const token = localStorage.getItem("adminToken");
    if (!token) {
      window.location.href = "/admin-login.html";
      return;
    }
    
    // Load current win percentage
    try {
      const res = await fetch("/api/get-win-percentage");
      const data = await res.json();
      winInput.value = data.percentage;
    } catch (error) {
      console.error("Error loading win percentage:", error);
    }
    
    // Load transaction log
    const logDiv = document.getElementById("transactionLog");
    try {
      const res = await fetch("/api/transactions", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      logDiv.innerHTML = data.transactions
        .map(tx => `
          <div>
            <strong>${tx.address}</strong> - ${tx.amount} MET - ${tx.status} - ${new Date(tx.date).toLocaleString()}
          </div>
        `)
        .join('');
    } catch (error) {
      console.error("Error loading transactions:", error);
    }
  }
});

// Updates win percentage via the admin panel
async function updateWinPercentage() {
  const percentage = parseInt(document.getElementById("winPercentageInput").value);
  if (isNaN(percentage) || percentage < 0 || percentage > 100) {
    alert("Please enter a valid percentage between 0 and 100");
    return;
  }
  try {
    const res = await fetch("/api/set-win-percentage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percentage })
    });
    const data = await res.json();
    if (data.success) {
      alert("Win percentage updated!");
    }
  } catch (error) {
    console.error("Error updating win percentage:", error);
  }
}

// Download transactions as CSV
function downloadCSV() {
  window.location.href = "/api/download-transactions";
}
