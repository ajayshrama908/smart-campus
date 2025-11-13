// simple frontend for ground booking
const BACKEND = "http://127.0.0.1:5000";

function qs(id){ return document.getElementById(id); }

async function fetchBookings(role, user_id, status) {
  const u = new URL(BACKEND + "/get_ground_bookings");
  u.searchParams.set("role", role);
  if (user_id) u.searchParams.set("user_id", user_id);
  if (status) u.searchParams.set("status", status);
  const r = await fetch(u);
  if (!r.ok) throw new Error("Failed to fetch bookings");
  return r.json();
}

function renderBooking(b, role){
  const item = document.createElement('div');
  item.className = 'item';

  const dateBox = document.createElement('div');
  dateBox.style.width = '90px';
  dateBox.style.textAlign = 'center';
  dateBox.innerHTML = `<div style="font-weight:700">${b.date}</div><div class="small-muted">${b.start_time}–${b.end_time}</div>`;
  item.appendChild(dateBox);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<div class="title">${escapeHtml(b.event_name)}</div>
    <div class="small-muted">Posted by: ${escapeHtml(b.requester_name || 'Unknown')} • ${escapeHtml(b.status || '')}</div>`;
  item.appendChild(meta);

  const controls = document.createElement('div');
  controls.className = 'controls';

  // Admin: approve/reject for pending items
  if (role === 'admin' && b.status === 'Pending') {
    const a = document.createElement('button');
    a.className = 'btn';
    a.textContent = 'Approve';
    a.onclick = () => updateStatus(b.id, 'Approved');
    const rj = document.createElement('button');
    rj.className = 'btn';
    rj.textContent = 'Reject';
    rj.style.background = '#ffd'; rj.onclick = () => updateStatus(b.id, 'Rejected');
    controls.appendChild(a);
    controls.appendChild(rj);
  }

  item.appendChild(controls);
  return item;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function loadList(){
  const role = qs('roleSelect').value;
  // demo user_id: in real app use actual logged user id
  const user_id = localStorage.getItem('user_id') || (role === 'faculty' ? '2' : '');
  const status = qs('statusFilter').value;
  const container = qs('bookingsList');
  container.innerHTML = 'Loading...';

  try {
    const rows = await fetchBookings(role, user_id, status === 'All' ? undefined : status);
    if (!rows || rows.length === 0) {
      container.innerHTML = '<div class="small-muted">No bookings found.</div>';
      return;
    }
    container.innerHTML = '';
    rows.forEach(r => {
      // ensure id property name consistent: some DB returns 'id', others 'ID' — normalize
      if (!r.id && r.id !== 0 && r.hasOwnProperty('booking_id')) r.id = r.booking_id;
      container.appendChild(renderBooking(r, role));
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="small-muted">Unable to load bookings: ${err.message}</div>`;
  }
}

async function updateStatus(booking_id, status){
  try {
    const res = await fetch(BACKEND + '/update_ground_booking_status', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({booking_id, status})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    loadList();
  } catch (err) {
    alert('Error updating status: ' + err.message);
  }
}

async function requestBooking(){
  const role = qs('roleSelect').value;
  if (role !== 'faculty') {
    qs('info').textContent = 'You must be logged in as faculty to request bookings.';
    qs('info').style.color = '#b43030';
    return;
  }
  const event_name = qs('eventName').value.trim();
  const date = qs('eventDate').value;
  const start_time = qs('startTime').value;
  const end_time = qs('endTime').value;

  if (!event_name || !date || !start_time || !end_time) {
    qs('info').textContent = 'Please fill all fields.';
    qs('info').style.color = '#b43030';
    return;
  }

  // demo user_id (replace with real user id)
  const user_id = localStorage.getItem('user_id') || '2';

  const payload = { user_id, event_name, date, start_time, end_time };

  try {
    qs('requestBtn').disabled = true;
    qs('requestBtn').textContent = 'Requesting...';
    const res = await fetch(BACKEND + '/book_ground', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      // conflict response 409 contains conflicts array
      qs('info').textContent = data.error || 'Server error';
      qs('info').style.color = '#b43030';
      return;
    }
    qs('info').textContent = data.message || 'Requested';
    qs('info').style.color = '#106f3a';
    // clear fields (optionally)
    qs('eventName').value = ''; qs('startTime').value = ''; qs('endTime').value = ''; // keep date maybe
    loadList();
  } catch (err) {
    qs('info').textContent = 'Network error — check backend at ' + BACKEND;
    qs('info').style.color = '#b43030';
  } finally {
    qs('requestBtn').disabled = false;
    qs('requestBtn').textContent = 'Request Booking';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  qs('refreshBtn').addEventListener('click', loadList);
  qs('statusFilter').addEventListener('change', loadList);
  qs('requestBtn').addEventListener('click', requestBooking);
  qs('roleSelect').addEventListener('change', e => {
    const role = e.target.value;
    // show/hide the form (demo)
    qs('facultyForm').style.display = role === 'faculty' ? 'block' : 'none';
    loadList();
  });

  // initialize: hide form when not faculty
  qs('facultyForm').style.display = qs('roleSelect').value === 'faculty' ? 'block' : 'none';
  loadList();
});
