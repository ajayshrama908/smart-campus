// ground_booking.js
// Final cleaned version for your project.
// Works with backend expecting: event_name, date, start_time, end_time

const BACKEND = "http://127.0.0.1:5000";

(function () {
  const role = (localStorage.getItem("role") || "student").toLowerCase();
  const user_id = localStorage.getItem("user_id") || "";
  const user_name = localStorage.getItem("user_name") || "";

  const requestPanel = document.getElementById("facultyForm");
  const infoEl = document.getElementById("info");
  const bookingsList = document.getElementById("bookingsList");
  const statusFilter = document.getElementById("statusFilter");
  const refreshBtn = document.getElementById("refreshBtn");
  const requestBtn = document.getElementById("requestBtn");

  // -------------------------------
  // ROLE-BASED UI
  // -------------------------------
  function applyRoleUI() {
    if (role === "faculty" || role === "admin") {
      requestPanel.style.display = "";
      infoEl.textContent = "";
    } else {
      requestPanel.style.display = "none";
      infoEl.style.color = "#b00020";
      infoEl.textContent =
        "Viewing as student — only approved bookings are visible.";
    }
  }
  applyRoleUI();

  // -------------------------------
  // HELPERS
  // -------------------------------
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  async function fetchBookings(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = `${BACKEND}/get_ground_bookings?${qs}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Server " + res.status);
    return await res.json();
  }

  function renderBookings(rows, opts = {}) {
    if (!rows || rows.length === 0) {
      bookingsList.innerHTML = `<div class="muted">No bookings</div>`;
      return;
    }

    bookingsList.innerHTML = rows
      .map((r) => {
        const id = r.id || r.booking_id;
        const title = escapeHtml(r.event_name);
        const date = escapeHtml(r.date);
        const st = escapeHtml(r.start_time);
        const et = escapeHtml(r.end_time);
        const posted = escapeHtml(r.requester_name || "Unknown");
        const status = escapeHtml(r.status);

        let actions = "";

        if (opts.canApprove && status === "Pending") {
          actions = `
            <button class="action-btn approve" data-id="${id}">Approve</button>
            <button class="action-btn action-ghost reject" data-id="${id}">Reject</button>
          `;
        } else if (opts.canCancel && status === "Pending") {
          actions = `
            <button class="action-btn action-ghost cancel" data-id="${id}">Cancel</button>
          `;
        }

        return `
          <div class="booking">
            <div style="font-weight:700">${title}</div>
            <div class="meta">• ${date} ${st} - ${et} • Posted by: ${posted} • ${status}</div>
            ${actions ? `<div style="margin-top:8px">${actions}</div>` : ""}
          </div>
        `;
      })
      .join("");
  }

  // -------------------------------
  // LOAD BOOKINGS
  // -------------------------------
  async function loadBookings() {
    bookingsList.innerHTML = `<div class="muted">Loading...</div>`;

    let filter = statusFilter.value === "All" ? "" : statusFilter.value;

    try {
      if (role === "student") {
        const rows = await fetchBookings({
          role: "student",
          status: "Approved",
        });
        renderBookings(rows, {});
        return;
      }

      if (role === "faculty") {
        const rows = await fetchBookings({
          role: "faculty",
          status: filter,
          user_id,
        });
        renderBookings(rows, { canCancel: true });
        return;
      }

      if (role === "admin") {
        const rows = await fetchBookings({ role: "admin", status: filter });
        renderBookings(rows, { canApprove: true });
      }
    } catch (err) {
      console.error(err);
      bookingsList.innerHTML = `<div class="muted">Unable to load bookings</div>`;
    }
  }

  loadBookings();

  // -------------------------------
  // REQUEST BOOKING (Faculty)
  // -------------------------------
  if (requestBtn) {
    requestBtn.addEventListener("click", async () => {
      const event_name = document.getElementById("eventName").value.trim();
      const date = document.getElementById("eventDate").value;
      const start_time = document.getElementById("startTime").value;
      const end_time = document.getElementById("endTime").value;

      if (!event_name || !date || !start_time || !end_time) {
        infoEl.style.color = "#b00020";
        infoEl.textContent = "Missing fields";
        return;
      }

      try {
        const res = await fetch(`${BACKEND}/book_ground`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id,
            event_name,
            date,
            start_time,
            end_time,
          }),
        });

        const j = await res.json();

        if (res.ok) {
          infoEl.style.color = "green";
          infoEl.textContent = j.message || "Requested";
          document.getElementById("eventName").value = "";
          document.getElementById("eventDate").value = "";
          document.getElementById("startTime").value = "";
          document.getElementById("endTime").value = "";
          loadBookings();
        } else {
          infoEl.style.color = "#b00020";
          infoEl.textContent = j.error || j.message || "Error";
        }
      } catch (err) {
        console.error(err);
        infoEl.style.color = "#b00020";
        infoEl.textContent = "Network error";
      }
    });
  }

  // -------------------------------
  // APPROVE / REJECT / CANCEL
  // -------------------------------
  bookingsList.addEventListener("click", async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    if (e.target.classList.contains("approve")) {
      if (confirm("Approve this booking?"))
        await updateStatus(id, "Approved");
    }
    if (e.target.classList.contains("reject")) {
      if (confirm("Reject this booking?")) await updateStatus(id, "Rejected");
    }
    if (e.target.classList.contains("cancel")) {
      if (confirm("Cancel your request?"))
        await updateStatus(id, "Rejected");
    }
  });

  async function updateStatus(id, status) {
    const res = await fetch(`${BACKEND}/update_ground_booking_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: id, status }),
    });

    if (!res.ok) alert("Error updating booking");

    loadBookings();
  }

  if (refreshBtn) refreshBtn.addEventListener("click", loadBookings);
  if (statusFilter) statusFilter.addEventListener("change", loadBookings);
})();
