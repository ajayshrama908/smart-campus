// static/js/ground_booking_admin.js
document.addEventListener('DOMContentLoaded', () => {
  const listDiv = document.getElementById('adminRequests');
  const statusSelect = document.getElementById('adminStatusFilter');
  const refreshBtn = document.getElementById('adminRefresh');

  async function loadPending() {
    listDiv.innerHTML = 'Loading...';
    const status = statusSelect ? statusSelect.value : 'Pending';
    const params = new URLSearchParams({ role: 'admin', status });
    try {
      const res = await fetch('/get_ground_bookings?' + params.toString());
      const rows = await res.json();
      if (!Array.isArray(rows)) {
        listDiv.innerHTML = 'Invalid server response';
        console.error(rows);
        return;
      }
      if (rows.length === 0) {
        listDiv.innerHTML = '<div class="module-card"><p>No requests.</p></div>';
        return;
      }
      const html = rows.map(r => {
        return `
          <div class="module-card" style="padding:12px;margin-bottom:12px;">
            <h3>${escapeHtml(r.event_name)}</h3>
            <p>By: ${escapeHtml(r.requester_name)} (ID: ${escapeHtml(r.user_id)})</p>
            <p>${escapeHtml(r.date)} ${escapeHtml(r.start_time)} - ${escapeHtml(r.end_time)}</p>
            <p>Status: <strong>${escapeHtml(r.status)}</strong></p>
            <div style="margin-top:8px">
              <button class="approve-btn" data-id="${r.id}">Approve</button>
              <button class="reject-btn" data-id="${r.id}" style="margin-left:8px">Reject</button>
            </div>
          </div>
        `;
      }).join('');
      listDiv.innerHTML = html;

      // attach listeners
      document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', () => updateStatus(btn.dataset.id, 'Approved'));
      });
      document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', () => updateStatus(btn.dataset.id, 'Rejected'));
      });
    } catch (err) {
      listDiv.innerHTML = 'Unable to load requests (see console)';
      console.error(err);
    }
  }

  async function updateStatus(id, status) {
    if (!confirm(`Change status to ${status}?`)) return;
    try {
      const res = await fetch('/update_ground_booking_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: id, status })
      });
      const j = await res.json();
      if (res.ok) {
        alert(j.message || 'Updated');
        loadPending();
      } else {
        alert(j.error || 'Failed to update');
        console.error(j);
      }
    } catch (err) {
      alert('Network error');
      console.error(err);
    }
  }

  if (refreshBtn) refreshBtn.addEventListener('click', loadPending);
  if (statusSelect) statusSelect.addEventListener('change', loadPending);

  loadPending();

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
});
