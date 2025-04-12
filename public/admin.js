// public/admin.js

document.addEventListener("DOMContentLoaded", () => {
  // Determine if we are on the admin login page or the admin panel page.
  const isLoginPage = document.getElementById("adminLoginForm") !== null;
  const isAdminPanel = document.getElementById("transactionLogs") !== null;

  // Helper function: Save token to localStorage.
  function saveToken(token) {
    localStorage.setItem("adminToken", token);
  }
  
  // Helper function: Get token from localStorage.
  function getToken() {
    return localStorage.getItem("adminToken");
  }

  // Admin login handler.
  if (isLoginPage) {
    document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
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
          saveToken(data.token);
          document.getElementById("loginMessage").innerText = "Login successful! Redirecting...";
          setTimeout(() => {
            window.location.href = "/admin.html";
          }, 1000);
        } else {
          document.getElementById("loginMessage").innerText = "Login failed. Please check your credentials.";
        }
      } catch (error) {
        console.error("Error during admin login:", error);
        document.getElementById("loginMessage").innerText = "Error during login. Please try again.";
      }
    });
  }

  // Protect admin panel: Redirect to login if token is missing.
  if (isAdminPanel) {
    const token = getToken();
    if (!token) {
      alert("You must be logged in as admin to view this page.");
      window.location.href = "/admin-login.html";
    } else {
      // Fetch and display transaction logs.
      fetchTransactionLogs();
      
      // Set up cash-out button handler.
      const cashoutBtn = document.getElementById("cashoutButton");
      cashoutBtn.addEventListener("click", async () => {
        const playerWallet = document.getElementById("playerWallet").value;
        if (!playerWallet) {
          alert("Please enter a player wallet address.");
          return;
        }
        try {
          const response = await fetch("/api/admin/cashout", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ wallet: playerWallet })
          });
          if (!response.ok) {
            const errData = await response.json();
            document.getElementById("cashoutMessage").innerText = "Cash out failed: " + errData.error;
            return;
          }
          const data = await response.json();
          document.getElementById("cashoutMessage").innerText = "Cash out of " + data.cashedOut + " MET processed for " + data.wallet;
        } catch (error) {
          console.error("Error during cash out:", error);
          document.getElementById("cashoutMessage").innerText = "Error during cash out. Check console for details.";
        }
      });

      // Optionally, implement logout
      const logoutBtn = document.getElementById("logoutButton");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
          localStorage.removeItem("adminToken");
          window.location.href = "/admin-login.html";
        });
      }
    }
  }

  // Function to fetch transaction logs from your backend and display them.
  async function fetchTransactionLogs() {
    try {
      const response = await fetch("/api/transactions");
      const data = await response.json();
      // Assume data.transactions is an array.
      const logContainer = document.getElementById("logContainer");
      if (logContainer) {
        if (data.transactions && data.transactions.length > 0) {
          logContainer.innerHTML = data.transactions
            .map(tx => `
              <div>
                <strong>${tx.address}</strong> - ${tx.amount} MET - ${tx.status} - ${new Date(tx.date).toLocaleString()}
              </div>
            `).join('');
        } else {
          logContainer.innerText = "No transactions recorded.";
        }
      }
    } catch (error) {
      console.error("Error fetching transaction logs:", error);
    }
  }
});
