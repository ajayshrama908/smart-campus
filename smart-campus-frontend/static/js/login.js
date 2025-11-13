// static/js/login.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const msg = document.getElementById('loginMessage');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      msg.textContent = 'Please enter email and password';
      msg.style.color = 'red';
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:5000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.message || data.error || 'Login failed';
        msg.style.color = 'red';
        return;
      }

      const user = data.user;
      if (!user) {
        msg.textContent = 'Login succeeded but no user returned';
        msg.style.color = 'orange';
        return;
      }

      const role = (user.role || '').toString().toLowerCase();

      // Save to localStorage
      localStorage.setItem('user_id', user.user_id ?? user.id ?? '');
      localStorage.setItem('user_name', user.name ?? '');
      localStorage.setItem('user_email', user.email ?? '');
      localStorage.setItem('role', role || 'student');

      msg.textContent = 'Login successful! Redirecting...';
      msg.style.color = 'green';

      // Redirect by role (adjust to match your file paths)
      if (role === 'admin') {
        window.location.href = '/smart-campus-frontend/dashboard/admin_dashboard.html';
      } else if (role === 'faculty') {
        window.location.href = '/smart-campus-frontend/dashboard/faculty_dashboard.html';
      } else {
        window.location.href = '/smart-campus-frontend/dashboard/student_dashboard.html';
      }
    } catch (err) {
      console.error('Login error', err);
      msg.textContent = 'Server not reachable.';
      msg.style.color = 'red';
    }
  });
});
