// static/js/auth.js
// simple client-side auth helpers (localStorage)

function logout() {
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_email');
  localStorage.removeItem('role');
  // redirect to login (adjust path if your folder layout differs)
  // dashboards live in /dashboard/, login at project root, so go up one level
  const base = (window.location.pathname.includes('/dashboard/') ? '../' : '');
  window.location.href = base + 'login.html';
}

// allowed: array of roles allowed to view the page (lowercase strings)
function requireRole(allowed = []) {
  const role = (localStorage.getItem('role') || '').toLowerCase();
  if (!role) {
    const base = (window.location.pathname.includes('/dashboard/') ? '../' : '');
    window.location.href = base + 'login.html';
    return;
  }
  if (Array.isArray(allowed) && allowed.length && !allowed.includes(role)) {
    // redirect user to their role dashboard
    const base = (window.location.pathname.includes('/dashboard/') ? '' : 'dashboard/');
    if (role === 'admin') window.location.href = base + 'admin_dashboard.html';
    else if (role === 'faculty') window.location.href = base + 'faculty_dashboard.html';
    else window.location.href = base + 'student_dashboard.html';
    return;
  }
  // show name + role if element exists
  const name = localStorage.getItem('user_name') || '';
  const userEl = document.getElementById('userDisplay');
  if (userEl) userEl.textContent = name ? `${name} (${role})` : role;
}

// static/js/auth.js
function requireRole(allowed = []) {
  const role = (localStorage.getItem('role') || '').toLowerCase();
  if (!allowed.includes(role)) {
    // not authorized, go to login
    alert('You must be logged in with the right role to access this page.');
    window.location.href = '/smart-campus-frontend/login.html';
  } else {
    const user = localStorage.getItem('user_name') || localStorage.getItem('user_email') || 'User';
    const display = document.getElementById('userDisplay');
    if (display) display.textContent = `${user} (${role})`;
  }
}
