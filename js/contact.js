// /js/contact.js
const API_URL = 'https://slot-machine-a08c.onrender.com';
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("nameInput").value.trim();
    const email = document.getElementById("emailInput").value.trim();
    const message = document.getElementById("messageInput").value.trim();
    if (!name || !email || !message) {
      alert("Please fill all fields.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message })
      });
      const data = await res.json();
      if (data.success) {
        alert("Message sent!");
        form.reset();
      } else {
        alert("Failed to send message.");
      }
    } catch (err) {
      console.error("Contact error:", err);
      alert("Error sending message.");
    }
  });
});
