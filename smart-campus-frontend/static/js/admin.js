// static/js/admin.js (improved)
document.addEventListener("DOMContentLoaded", () => {
  const usersBody = document.getElementById("usersBody");
  const refreshBtn = document.getElementById("refreshBtn");
  const searchInput = document.getElementById("searchInput");

  async function fetchUsers() {
    usersBody.innerHTML = `<tr><td colspan="5" class="small">Loading...</td></tr>`;
    try {
      const res = await fetch("http://127.0.0.1:5000/get_users");
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      renderUsers(data || []);
    } catch (err) {
      console.error("Failed to fetch users", err);
      usersBody.innerHTML = `<tr><td colspan="5" class="small">Unable to load users.</td></tr>`;
    }
  }

  function renderUsers(users) {
    const q = (searchInput.value || "").trim().toLowerCase();
    const filtered = users.filter(u => {
      if (!q) return true;
      return (u.name && u.name.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q));
    });

    if (!filtered.length) {
      usersBody.innerHTML = `<tr><td colspan="5" class="small">No users found.</td></tr>`;
      return;
    }

    // Build rows
    usersBody.innerHTML = filtered.map(u => {
      const created = u.created_at ? new Date(u.created_at).toLocaleString() : "";
      // note: Create select with value set using selected attributes for safety
      return `
        <tr data-user-id="${u.user_id}">
          <td><div style="font-weight:600">${escapeHtml(u.name || "")}</div></td>
          <td class="small">${escapeHtml(u.email || "")}</td>
          <td>
            <select class="role-select" data-user-id="${u.user_id}">
              <option value="student"${u.role==="student" ? " selected":""}>Student</option>
              <option value="faculty"${u.role==="faculty" ? " selected":""}>Faculty</option>
              <option value="admin"${u.role==="admin" ? " selected":""}>Admin</option>
            </select>
          </td>
          <td class="small">${escapeHtml(created)}</td>
          <td>
            <div class="actions">
              <button class="btn btn-save" data-save-id="${u.user_id}">Save</button>
              <button class="btn btn-delete" data-del-id="${u.user_id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    attachRowListeners();
  }

  function attachRowListeners() {
    // Save buttons
    document.querySelectorAll(".btn-save").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = btn.getAttribute("data-save-id");
        const select = document.querySelector(`select[data-user-id="${id}"]`);
        if (!select) return;
        const role = select.value;

        // UX feedback
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Saving...";

        try {
          const res = await fetch("http://127.0.0.1:5000/update_user_role", {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ user_id: Number(id), role })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Update failed");
          alert(json.message || "Updated");
          // optionally refresh users to reflect any server-side changes
          fetchUsers();
        } catch (err) {
          console.error(err);
          alert("Failed to update role");
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    });

    // Delete buttons
    document.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = btn.getAttribute("data-del-id");
        if (!confirm("Delete this user? This action cannot be undone.")) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Deleting...";

        try {
          const res = await fetch("http://127.0.0.1:5000/delete_user", {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({ user_id: Number(id) })
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || "Delete failed");
          alert(j.message || "Deleted");
          fetchUsers();
        } catch (err) {
          console.error(err);
          alert("Failed to delete");
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    });
  }

  // utilities
  function escapeHtml(s) {
    if (!s) return "";
    return s.replaceAll("&", "&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  }

  refreshBtn.addEventListener("click", fetchUsers);
  searchInput.addEventListener("input", () => fetchUsers());

  // initial load
  fetchUsers();
});
