document.getElementById("contactForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const message = document.getElementById("message").value;
  
  try {
    const response = await fetch("/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message })
    });
    const data = await response.json();
    if (data.success) {
      document.getElementById("successMessage").style.display = "block";
      document.getElementById("contactForm").reset();
    } else {
      alert("Failed to send message.");
    }
  } catch (error) {
    alert("Error sending message.");
  }
});
