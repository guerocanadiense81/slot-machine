const API_URL = 'https://slot-machine-a08c.onrender.com';

document.addEventListener("DOMContentLoaded", () => {
  const contactForm = document.getElementById("contactForm");
  if (!contactForm) return;

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("nameInput").value.trim();
    const email = document.getElementById("emailInput").value.trim();
    const message = document.getElementById("messageInput").value.trim();

    if (!name || !email || !message) {
      alert("Please fill out all fields.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      const result = await res.json();
      if (result.success) {
        alert("Message sent!");
        contactForm.reset();
      } else {
        alert("Error: " + result.error);
      }
    } catch (err) {
      console.error("Error:", err);
      alert("Failed to send. Try again.");
    }
  });
});
