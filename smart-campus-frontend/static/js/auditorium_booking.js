// static/js/auditorium_booking.js
// Shared JS for request, view, admin pages
(() => {
  const apiBase = ''; // same origin; if backend on different origin, set full base like 'http://127.0.0.1:5000'

  function q(sel, ctx){ return (ctx || document).querySelector(sel); }
  function qa(sel, ctx){ return Array.from((ctx || document).querySelectorAll(sel)); }
  function safeText(s){ return String(s||''); }

  // ---------- Request form ----------
  const form = q('#audForm');
  if (form) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const eventName = q('#eventName').value.trim();
      const date = q('#date').value;
      const start_time = q('#startTime').value;
      const end_time = q('#endTime').value;
      const msgEl = q('#formMsg');

      // basic validation
      if (!eventName || !date || !start_time || !end_time) {
        msgEl.style.display = 'block'; msgEl.textContent = 'Please fill all fields.';
        return;
      }

      // user id from login (localStorage)
      const user_id = localStorage.getItem('user_id') || null;
      const payload = { user_id, event_name: eventName, date, start_time, end_time };

      try {
        const res = await fetch(apiBase + '/book_auditorium', {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          msgEl.style.display = 'block'; msgEl.style.color = '#0b3a66';
          msgEl.textContent = data.message || 'Requested — pending approval.';
          // clear form
          q('#eventName').value=''; q('#date').value=''; q('#startTime').value=''; q('#endTime').value='';
        } else {
          msgEl.style.display = 'block'; msgEl.style.color = '#b00020';
          msgEl.textContent = data.error || (data.message || `Server error: ${res.status}`);
        }
      } catch(err) {
        console.error(err);
        msgEl.style.display = 'block'; msgEl.style.color = '#b00020';
        msgEl.textContent = 'Unable to send request. Check backend.';
      }
    });
  }

  // ---------- View bookings (student/faculty) ----------
  async function loadViewBookings() {
    const list = q('#list');
    if (!list) return;
    list.innerHTML = 'Loading...';
    const statusSelect = q('#roleFilter');
    let status = statusSelect ? statusSelect.value : 'All';

    // role & user id from localStorage
    const roleStored = (localStorage.getItem('role') || 'student').toLowerCase();
    const user_id = localStorage.getItem('user_id') || null;

    // for student: always show Approved unless they choose All/other in UI
    let roleParam = (roleStored === 'admin') ? 'admin' : (roleStored === 'faculty' ? 'faculty' : 'student');

    // build query
    const params = new URLSearchParams();
    params.set('role', roleParam);
    if (roleParam === 'faculty' && user_id) params.set('user_id', user_id);
    if (status && status !== 'All') params.set('status', status);

    try {
      const res = await fetch(apiBase + '/get_auditorium_bookings?' + params.toString());
      if (!res.ok) {
        list.innerHTML = `<div class="muted">Server error: ${res.status}</div>`;
        return;
      }
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        list.innerHTML = `<div class="muted">No bookings</div>`;
        return;
      }

      const html = rows.map(r => {
        const date = r.date || '';
        const st = r.start_time || '';
        const et = r.end_time || '';
        const requester = r.requester_name || r.name || 'Unknown';
        return `<div class="booking">
          <div class="meta">
            <div style="font-weight:700">${escapeHtml(r.event_name || 'Event')}</div>
            <div class="muted">${escapeHtml(requester)}</div>
            <div style="margin-top:6px">${escapeHtml(date)} • ${escapeHtml(st)} — ${escapeHtml(et)}</div>
            <div style="margin-top:6px">Status: <strong>${escapeHtml(r.status || '')}</strong></div>
          </div>
        </div>`;
      }).join('');
      list.innerHTML = html;
    } catch(err) {
      console.error(err);
      list.innerHTML = `<div class="muted">Unable to load bookings (see console)</div>`;
    }
  }

  if (q('#refreshBtn')) q('#refreshBtn').addEventListener('click', loadViewBookings);
  if (q('#roleFilter')) q('#roleFilter').addEventListener('change', loadViewBookings);
  // initial load on view page
  if (q('#list')) loadViewBookings();

  // ---------- Admin listing and actions ----------
  async function loadAdminBookings() {
    const list = q('#adminList');
    if (!list) return;
    list.innerHTML = 'Loading...';

    const status = q('#statusFilter') ? q('#statusFilter').value : 'Pending';
    const params = new URLSearchParams();
    params.set('role', 'admin');
    if (status && status !== 'All') params.set('status', status);

    try {
      const res = await fetch(apiBase + '/get_auditorium_bookings?' + params.toString());
      if (!res.ok) {
        list.innerHTML = `<div class="muted">Server error: ${res.status}</div>`;
        return;
      }
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        list.innerHTML = `<div class="muted">No bookings</div>`;
        return;
      }

      const html = rows.map(r => {
        const date = r.date || '';
        const st = r.start_time || '';
        const et = r.end_time || '';
        const requester = r.requester_name || r.name || 'Unknown';
        return `<div class="booking" data-id="${r.id || r.booking_id || r.id}">
          <div class="meta">
            <div style="font-weight:700">${escapeHtml(r.event_name || 'Event')}</div>
            <div class="muted">${escapeHtml(requester)}</div>
            <div style="margin-top:6px">${escapeHtml(date)} • ${escapeHtml(st)} — ${escapeHtml(et)}</div>
            <div style="margin-top:6px">Status: <strong>${escapeHtml(r.status || '')}</strong></div>
          </div>
          <div class="actions">
            <button class="approve" data-id="${r.id || r.booking_id || r.id}">Approve</button>
            <button class="reject" data-id="${r.id || r.booking_id || r.id}">Reject</button>
          </div>
        </div>`;
      }).join('');
      list.innerHTML = html;

      // attach event listeners
      qa('.approve', list).forEach(btn => btn.addEventListener('click', () => updateStatus(btn.dataset.id, 'Approved')));
      qa('.reject', list).forEach(btn => btn.addEventListener('click', () => updateStatus(btn.dataset.id, 'Rejected')));
    } catch(err) {
      console.error(err);
      list.innerHTML = `<div class="muted">Unable to load bookings (see console)</div>`;
    }
  }

  if (q('#refreshAdmin')) q('#refreshAdmin').addEventListener('click', loadAdminBookings);
  if (q('#statusFilter')) q('#statusFilter').addEventListener('change', loadAdminBookings);
  if (q('#adminList')) loadAdminBookings();

  // updates status (admin)
  async function updateStatus(booking_id, status) {
    if (!confirm(`Mark booking ${booking_id} as ${status}?`)) return;
    try {
      const res = await fetch(apiBase + '/update_auditorium_booking_status', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ booking_id, status })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Updated');
        // reload lists on admin + public view pages
        if (q('#adminList')) loadAdminBookings();
        if (q('#list')) loadViewBookings();
      } else {
        alert(data.error || data.message || `Server error: ${res.status}`);
      }
    } catch(err) {
      console.error(err);
      alert('Unable to update status (see console).');
    }
  }

  // small escape helper
  function escapeHtml(s) {
    return String(s||'').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // expose for debugging
  window.AudBooking = { loadViewBookings, loadAdminBookings, updateStatus };
})();

// small centralized helper file in case you want to add shared utils later.
// For now just provide a safe console wrapper.
(function(){
  window.__ac = window.__ac || {};
  window.__ac.debug = function(...args){ console.log('[aud]', ...args); };
})();
