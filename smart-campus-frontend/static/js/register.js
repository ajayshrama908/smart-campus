// static/js/register.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  const msg = document.getElementById('message');

  function toTitleCase(s) {
    return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.style.color = '';

    const fullnameRaw = document.getElementById('fullname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    if (!fullnameRaw || !email || !password || !role) {
      msg.textContent = '⚠️ Please fill all fields.';
      msg.style.color = 'red';
      return;
    }

    // Name validation: letters and spaces only
    if (!/^[A-Za-z\s]+$/.test(fullnameRaw)) {
      msg.textContent = '⚠️ Name should contain letters and spaces only.';
      msg.style.color = 'red';
      return;
    }

    const fullname = toTitleCase(fullnameRaw);

    try {
      const res = await fetch('http://127.0.0.1:5000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullname, email, password, role })
      });
      const data = await res.json();

      if (res.ok) {
        msg.textContent = '✅ User registered successfully — redirecting to login...';
        msg.style.color = 'green';
        setTimeout(() => window.location.href = 'login.html', 900);
      } else {
        msg.textContent = data.message || data.error || 'Registration failed';
        msg.style.color = 'red';
      }
    } catch (err) {
      console.error(err);
      msg.textContent = '⚠️ Server not reachable.';
      msg.style.color = 'red';
    }
  });
});
