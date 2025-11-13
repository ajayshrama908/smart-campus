// ground_booking_view.js
document.addEventListener('DOMContentLoaded', () => {
  const roleSelect = document.getElementById('roleSelect');
  const statusSelect = document.getElementById('statusSelect');
  const refreshBtn = document.getElementById('refreshBtn');
  const bookingsList = document.getElementById('bookingsList');
  const serverMsg = document.getElementById('serverMsg');

  // If user is logged, default role to stored role
  const storedRole = (localStorage.getItem('role') || '').toLowerCase();
  if (storedRole) {
    if (storedRole === 'faculty') roleSelect.value = 'faculty';
    else if (storedRole === 'admin') roleSelect.value = 'admin';
    else roleSelect.value = 'student';
  }

  refreshBtn.addEventListener('click', load);

  // reload when selects change
  roleSelect.addEventListener('change', load);
  statusSelect.addEventListener('change', load);

  async function load() {
    serverMsg.textContent = '';
    bookingsList.innerHTML = 'Loading...';
    const role = roleSelect.value;
    const status = statusSelect.value;
    const user_id = localStorage.getItem('user_id') || '';

    let url = `http://127.0.0.1:5000/get_ground_bookings?role=${encodeURIComponent(role)}`;
    if (status && status !== 'All') url += `&status=${encodeURIComponent(status)}`;
    if (role === 'faculty') url += `&user_id=${encodeURIComponent(user_id)}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        serverMsg.textContent = `Server error: ${res.status}`;
        bookingsList.innerHTML = '';
        return;
      }
      const data = await res.json();
      renderList(data, role);
    } catch (err) {
      console.error(err);
      serverMsg.textContent = 'Network error — check backend.';
      bookingsList.innerHTML = '';
    }
  }

  function renderList(items, role) {
    if (!items || items.length === 0) {
      bookingsList.innerHTML = '<div class="small">No bookings found.</div>';
      return;
    }
    bookingsList.innerHTML = '';
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'booking-item';

      const left = document.createElement('div');
      left.className = 'booking-left';
      left.innerHTML = `<strong>${escapeHtml(it.event_name)}</strong>
        <div class="small">Date: ${it.date || '-'} &middot; ${formatTime(it.start_time)} - ${formatTime(it.end_time)}</div>
        <div class="small">Requested by: ${escapeHtml(it.requester_name || '')} ${it.user_id ? `(id:${it.user_id})` : ''}</div>
        <div class="small">Status: ${it.status || 'Unknown'}</div>`;

      const actions = document.createElement('div');
      actions.className = 'booking-actions';

      // if admin, show Approve/Reject for Pending items
      if (role === 'admin') {
        if ((it.status || '').toLowerCase() === 'pending') {
          const approve = document.createElement('button');
          approve.className = 'approve';
          approve.textContent = 'Approve';
          approve.addEventListener('click', () => updateStatus(it.id, 'Approved', approve));

          const reject = document.createElement('button');
          reject.className = 'reject';
          reject.textContent = 'Reject';
          reject.addEventListener('click', () => updateStatus(it.id, 'Rejected', reject));

          actions.appendChild(approve);
          actions.appendChild(reject);
        } else {
          const span = document.createElement('span');
          span.className = 'small';
          span.textContent = it.status;
          actions.appendChild(span);
        }
      }

      div.appendChild(left);
      div.appendChild(actions);
      bookingsList.appendChild(div);
    });
  }

  function formatTime(t) {
    if (!t) return '--:--';
    // t might be "HH:MM:SS" or "HH:MM"
    return t.length > 5 ? t.slice(0,5) : t;
  }

  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  async function updateStatus(bookingId, status, btn) {
    if (!confirm(`Set booking ${bookingId} to ${status}?`)) return;
    btn.disabled = true;
    btn.textContent = status + 'ing...';
    try {
      const res = await fetch('http://127.0.0.1:5000/update_ground_booking_status', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ booking_id: bookingId, status })
      });
      if (res.ok) {
        load();
      } else {
        const txt = await res.text();
        console.error('status update failed', txt);
        serverMsg.textContent = 'Unable to update status.';
      }
    } catch (err) {
      console.error(err);
      serverMsg.textContent = 'Network error.';
    } finally {
      btn.disabled = false;
      btn.textContent = status;
    }
  }

  // initial load
  load();
});
