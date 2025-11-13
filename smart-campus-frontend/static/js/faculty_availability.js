// static/js/faculty_availability.js
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('facultyName');
  const statusSelect = document.getElementById('statusSelect');
  const updateBtn = document.getElementById('updateBtn');
  const listContainer = document.getElementById('listContainer');
  const userDisplay = document.getElementById('userDisplay');
  const localName = localStorage.getItem('user_name') || '';
  if (userDisplay) userDisplay.textContent = localName;

  async function refreshList(){
    // get all faculty availability from backend (simple query)
    // We don't have a dedicated GET all endpoint; reuse /get_availability by faculty_name not ideal.
    // Instead call backend get_availability for a few names — but simpler: show values from DB via /get_availability?faculty_name=
    // To list, we'll request a small set of known names: first, show current user only then stop.
    const faculty = localName ? [localName] : ['John Doe'];
    listContainer.innerHTML = '';
    for (const f of faculty) {
      const res = await fetch(`http://127.0.0.1:5000/get_availability?faculty_name=${encodeURIComponent(f)}`);
      const data = await res.json();
      const div = document.createElement('div');
      div.className = 'prof';
      div.innerHTML = `<strong>${f}</strong> — <em>${data.status||'Available'}</em>`;
      listContainer.appendChild(div);
    }
  }

  updateBtn.addEventListener('click', async () => {
    const faculty_name = nameInput.value.trim() || localName || prompt('Enter faculty name:');
    const status = statusSelect.value;
    if (!faculty_name) return alert('Provide name');
    const res = await fetch('http://127.0.0.1:5000/update_faculty_availability', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ faculty_name, status })
    });
    const data = await res.json();
    if (res.ok) { alert(data.message || 'Updated'); nameInput.value = faculty_name; refreshList(); }
    else alert(data.error || JSON.stringify(data));
  });

  window.logout = () => { localStorage.clear(); window.location.href = '/smart-campus-frontend/login.html'; };

  // prefill with logged user
  if (localName) nameInput.value = localName;
  refreshList();
});
