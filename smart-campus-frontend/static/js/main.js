document.addEventListener("DOMContentLoaded", () => {
  console.log("Smart Campus frontend loaded");

  // REGISTER FORM
  const registerForm = document.getElementById("registerForm");
  const registerMsg = document.getElementById("message");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullname = document.getElementById("fullname").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();
      const role = document.getElementById("role").value;

      if (!fullname || !email || !password || !role) {
        registerMsg.textContent = "⚠️ Please fill all fields.";
        registerMsg.style.color = "red";
        return;
      }

      try {
        const res = await fetch("http://127.0.0.1:5000/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullname, email, password, role }),
        });

        const data = await res.json();
        if (res.ok) {
          registerMsg.textContent = "✅ " + data.message;
          registerMsg.style.color = "green";
          registerForm.reset();
        } else {
          registerMsg.textContent = "❌ Registration failed.";
          registerMsg.style.color = "red";
        }
      } catch (err) {
        registerMsg.textContent = "⚠️ Server not reachable.";
        registerMsg.style.color = "red";
      }
    });
  }

  // LOGIN FORM
  const loginForm = document.getElementById("loginForm");
  const loginMsg = document.getElementById("loginMessage");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();

      if (!email || !password) {
        loginMsg.textContent = "⚠️ Please enter your credentials.";
        loginMsg.style.color = "red";
        return;
      }

      try {
        const res = await fetch("http://127.0.0.1:5000/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (res.ok && data.user) {
          loginMsg.textContent = "✅ " + data.message;
          loginMsg.style.color = "green";
          // Optionally redirect:
          // window.location.href = "dashboard.html";
        } else {
          loginMsg.textContent = "❌ Invalid email or password.";
          loginMsg.style.color = "red";
        }
      } catch (err) {
        loginMsg.textContent = "⚠️ Server not reachable.";
        loginMsg.style.color = "red";
      }
    });
  }
});






document.addEventListener('DOMContentLoaded', () => {
  // update year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Smooth scroll for Get Started
  const getStarted = document.getElementById('getStarted');
  if (getStarted) {
    getStarted.addEventListener('click', (e) => {
      e.preventDefault();
      const href = getStarted.getAttribute('href') || '#register';
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
  }

  // Form submit
  const form = document.getElementById('registerForm');
  const msg = document.getElementById('registerMessage');
  const btn = document.getElementById('registerBtn');
  const clearBtn = document.getElementById('clearBtn');

  function setMessage(text, ok = false) {
    msg.style.color = ok ? 'green' : '#c0392b';
    msg.textContent = text;
  }

  clearBtn && clearBtn.addEventListener('click', () => {
    form.reset();
    setMessage('');
  });

  form && form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setMessage('');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    if (!name || !email || !password || !role) {
      setMessage('Please fill all fields.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Registering...';

    try {
      const res = await fetch('/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ fullname: name, email, password, role })
      });

      const j = await res.json().catch(()=>({}));
      if (res.ok) {
        // success
        setMessage(j.message || 'Registration successful — you can now login.', true);
        form.reset();
        // optionally redirect to login after short delay
        setTimeout(()=>{ window.location.href = 'login.html'; }, 1400);
      } else {
        // show backend error message
        setMessage(j.error || j.message || `Server error ${res.status}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('Network error or backend not running. Check console.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Register';
    }
  });

  // Make login link show login page (if login.html exists)
  const loginLink = document.getElementById('loginLink');
  if (loginLink) loginLink.addEventListener('click', (e) => {
    // default behavior is fine; but ensure relative path correct
  });

});
