document.addEventListener("DOMContentLoaded", async () => {
  const facultyName = "Ajay"; // Replace dynamically after login
  const badge = document.getElementById("statusBadge");
  const toggleBtn = document.getElementById("toggleStatus");

  async function loadStatus() {
    const res = await fetch(`http://127.0.0.1:5000/get_availability?faculty_name=${facultyName}`);
    const data = await res.json();
    setStatus(data.status);
  }

  function setStatus(status) {
    badge.textContent = status;
    badge.className = "status-badge " + 
      (status === "Available" ? "available" :
       status === "Busy" ? "busy" : "onleave");
  }

  toggleBtn.addEventListener("click", async () => {
    const current = badge.textContent;
    const next =
      current === "Available" ? "Busy" :
      current === "Busy" ? "On Leave" : "Available";
    setStatus(next);

    await fetch("http://127.0.0.1:5000/update_availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faculty_name: facultyName, status: next }),
    });
  });

  await loadStatus();
});
