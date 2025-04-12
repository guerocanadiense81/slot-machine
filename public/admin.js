// public/admin.js

document.addEventListener("DOMContentLoaded", () => {
  // Determine if we are on the admin login page or the admin panel page.
  const isLoginPage = document.getElementById("adminLoginForm") !== null;
  const isAdminPanel = document.getElementById("houseFundsSection") !== null;

  // Helper functions for JWT token management.
  function saveToken(token) {
    localStorage.setItem("adminToken", token);
  }
  
  function getToken() {
    return localStorage.getItem("adminToken");
  }

  // ADMIN LOGIN LOGIC (for admin-login.html)
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

  // ADMIN PANEL LOGIC (for admin.html)
  if (isAdminPanel) {
    const token = getToken();
    if (!token) {
      alert("You must be logged in as admin to view this page.");
      window.location.href = "/admin-login.html";
      return;
    }
    
    // Function to fetch and display the aggregated house funds
    async function fetchHouseFunds() {
      try {
        const res = await fetch("/api/admin/house-funds", {
          headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) {
          console.error("Failed to fetch house funds.");
          return;
        }
        const data = await res.json();
        console.log("House funds fetched:", data);
        const houseFundsDisplay = document.getElementById("houseFundsDisplay");
        if (houseFundsDisplay) {
          houseFundsDisplay.innerText = data.houseFunds;
        }
      } catch (error) {
        console.error("Error fetching house funds:", error);
      }
    }
    fetchHouseFunds();

    // Cash-out button handler for the aggregated house funds.
    const cashOutHouseBtn = document.getElementById("cashOutHouseButton");
    if (cashOutHouseBtn) {
      cashOutHouseBtn.addEventListener("click", async () => {
        try {
          const response = await fetch("/api/admin/cashout-house", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": "Bearer " + token
            },
            body: JSON.stringify({}) // no additional data required
          });
          if (!response.ok) {
            const errData = await response.json();
            document.getElementById("houseCashoutMessage").innerText = "Cash out failed: " + errData.error;
            return;
          }
          const result = await response.json();
          document.getElementById("houseCashoutMessage").innerText = "Cash out of " + result.cashedOut + " MET processed.";
          // Refresh the house funds display
          fetchHouseFunds();
        } catch (error) {
          console.error("Error during house funds cash out:", error);
          document.getElementById("houseCashoutMessage").innerText = "Error during cash out. Check console for details.";
        }
      });
    } else {
      console.error("Cash out button not found in admin panel.");
    }

    // Logout functionality.
    const logoutBtn = document.getElementById("logoutButton");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("adminToken");
        window.location.href = "/admin-login.html";
      });
    }

    // Fetch transaction logs to display.
    async function fetchTransactionLogs() {
      try {
        const res = await fetch("/api/transactions");
        if (!res.ok) {
          console.error("Failed to fetch transactions.");
          return;
        }
        const data = await res.json();
        console.log("Fetched transaction logs:", data);
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
    fetchTransactionLogs();
  }
});
