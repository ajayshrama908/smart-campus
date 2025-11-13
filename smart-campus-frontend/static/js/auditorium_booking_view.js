// auditorium_booking_view.js
// Render auditorium bookings for student/faculty/admin

document.addEventListener('DOMContentLoaded', () => {
  const listDiv = document.getElementById('audListBookings');
  const statusFilter = document.getElementById('audStatusFilter');
  const refreshBtn = document.getElementById('audRefreshBtn');

  const roleRaw = (localStorage.getItem('role') || 'student').toLowerCase();
  const role = roleRaw === 'admin' ? 'admin' : (roleRaw === 'faculty' ? 'faculty' : 'student');
  const userId = localStorage.getItem('user_id') || null;

  async function loadBookings() {
    try {
      listDiv.innerHTML = 'Loading...';
      const params = new URLSearchParams();
      params.set('role', role);
      if (role === 'faculty') {
        if (!userId) { listDiv.innerHTML = 'Please login.'; return; }
        params.set('user_id', userId);
        if (statusFilter && statusFilter.value && statusFilter.value !== 'All') params.set('status', statusFilter.value);
      } else if (role === 'student') {
        if (statusFilter && statusFilter.value && statusFilter.value !== 'All') params.set('status', statusFilter.value);
        else params.set('status', 'Approved');
      } else {
        if (statusFilter && statusFilter.value && statusFilter.value !== 'All') params.set('status', statusFilter.value);
      }

      const res = await fetch('/get_auditorium_bookings?' + params.toString());
      if (!res.ok) { listDiv.innerHTML = `Server error: ${res.status}`; return; }
      const rows = await res.json();
      if (!Array.isArray(rows)) { listDiv.innerHTML = 'Invalid server response'; console.error(rows); return; }
      if (rows.length === 0) { listDiv.innerHTML = '<p>No bookings found.</p>'; return; }

      const html = rows.map(r => {
        const date = r.date || '-';
        const st = r.start_time || '';
        const et = r.end_time || '';
        const eventName = escapeHtml(r.event_name || 'Event');
        const requester = escapeHtml(r.requester_name || r.requester || 'Unknown');
        const status = escapeHtml(r.status || 'Unknown');

        return `
          <div style="background:#fff;padding:12px;border-radius:10px;margin-bottom:12px;box-shadow:0 6px 18px rgba(0,0,0,0.06)">
            <h3 style="margin:0;color:#0b83a6">${eventName}</h3>
            <p style="margin:6px 0 0">Requested by: <strong>${requester}</strong></p>
            <p style="margin:6px 0 0">Date: <strong>${date}</strong> — ${st} to ${et}</p>
            <div style="margin-top:8px;font-weight:700;color:#0b83a6">Status: ${status}</div>
            ${role === 'admin' ? adminControls(r) : ''}
          </div>
        `;
      }).join('');
      listDiv.innerHTML = html;
    } catch (err) {
      console.error(err);
      listDiv.innerHTML = 'Unable to load bookings (see console)';
    }
  }

  function adminControls(r) {
    return `
      <div style="margin-top:8px;display:flex;gap:8px;">
        <button class="btn small" onclick="audUpdateBookingStatus(${r.id}, 'Approved')">Approve</button>
        <button class="btn small" style="background:#ff6b6b;color:#fff" onclick="audUpdateBookingStatus(${r.id}, 'Rejected')">Reject</button>
      </div>
    `;
  }

  window.audUpdateBookingStatus = async function(bookingId, newStatus) {
    try {
      const res = await fetch('/update_auditorium_booking_status', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ booking_id: bookingId, status: newStatus })
      });
      if (!res.ok) { alert('Failed: ' + res.status); return; }
      await loadBookings();
    } catch (err) {
      console.error(err);
      alert('Error (see console).');
    }
  };

  if (refreshBtn) refreshBtn.addEventListener('click', loadBookings);
  if (statusFilter) statusFilter.addEventListener('change', loadBookings);

  loadBookings();
  function escapeHtml(s){ return String(s || '').replace(/[&<>"'`]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c])); }
});
