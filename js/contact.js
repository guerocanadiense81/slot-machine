// /js/contact.js
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

    const payload = { name, email, message };

    try {
      const response = await fetch("https://slot-machine-a08c.onrender.com/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        alert("Message sent! We'll get back to you shortly.");
        contactForm.reset();
      } else {
        alert("Something went wrong: " + result.error);
      }
    } catch (err) {
      console.error("Error sending contact form:", err);
      alert("Network error. Please try again later.");
    }
  });
});
