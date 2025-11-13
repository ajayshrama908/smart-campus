// static/js/lost_found.js
const BACKEND = "http://127.0.0.1:5000"; // must match your Flask host:port

// utility
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function fetchList(status) {
  const url = new URL(BACKEND + "/get_lost_items");
  if (status) url.searchParams.set("status", status);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch list: " + res.status);
  return res.json();
}

function renderReportCard(item) {
  const container = document.createElement('div');
  container.className = 'module-card';

  const img = document.createElement('img');
  img.className = 'thumb';
  // backend should return full absolute image_url (http://127.0.0.1:5000/...)
  img.src = item.image_url || '../static/img/placeholder.png';
  img.alt = item.item_name || 'photo';
  img.onerror = () => img.src = '../static/img/placeholder.png';

  const right = document.createElement('div');
  right.style.flex = '1';

  const title = document.createElement('div');
  title.innerHTML = `<strong style="color:#0b3b4b">${escapeHtml(item.item_name || '')}</strong>`;

  const desc = document.createElement('div');
  desc.className = 'meta';
  desc.style.margin = '6px 0';
  desc.textContent = item.description || '';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const postedBy = escapeHtml(item.posted_by_name || 'Unknown');
  const status = escapeHtml(item.status || '');
  const postedAt = item.posted_at ? ` • ${escapeHtml(item.posted_at)}` : '';
  meta.textContent = `Posted by: ${postedBy} • ${status}${postedAt}`;

  right.appendChild(title);
  right.appendChild(desc);
  right.appendChild(meta);

  container.appendChild(img);
  container.appendChild(right);
  return container;
}

async function loadReports() {
  const status = document.getElementById('filterStatus').value;
  const container = document.getElementById('reports');
  const no = document.getElementById('noReports');
  container.innerHTML = '';
  no.textContent = 'Loading reports...';
  no.style.display = 'block';

  try {
    const items = await fetchList(status || undefined);
    if (!items || items.length === 0) {
      no.textContent = 'No reports';
      container.innerHTML = '';
      return;
    }
    no.style.display = 'none';
    items.forEach(it => container.appendChild(renderReportCard(it)));
  } catch (err) {
    console.error('loadReports error', err);
    no.style.display = 'block';
    no.textContent = `Unable to load reports (check backend at ${BACKEND})`;
  }
}

function showMessageEl(text, cls) {
  const el = document.getElementById('lfMessage');
  el.textContent = text || '';
  el.className = 'message ' + (cls || '');
}

// handle form submit (multipart)
async function initLostFound() {
  const form = document.getElementById('lfForm');
  if (!form) return;
  const refreshBtn = document.getElementById('refreshList');
  const filter = document.getElementById('filterStatus');
  const openAll = document.getElementById('openAllImages');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessageEl('', '');
    const btn = form.querySelector('button[type="submit"]');
    try {
      btn.disabled = true;
      btn.textContent = 'Adding...';

      const fd = new FormData(form);
      // optionally attach logged in user id
      const localUser = localStorage.getItem('user_id');
      if (localUser) fd.set('user_id', localUser);

      const res = await fetch(BACKEND + '/add_lost_item', { method: 'POST', body: fd });
      let result;
      try { result = await res.json(); } catch (e) { result = { error: 'Invalid server response' }; }
      if (!res.ok) {
        showMessageEl(result.error || ('Server error: ' + res.status), 'error');
        return;
      }
      showMessageEl('Item added — refreshing list...', 'success');
      form.reset();
      await loadReports();
      setTimeout(()=> showMessageEl('', ''), 2400);
    } catch (err) {
      console.error('submit error', err);
      showMessageEl(`Network error — check backend at ${BACKEND}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add Record';
    }
  });

  refreshBtn.addEventListener('click', loadReports);
  filter.addEventListener('change', loadReports);

  openAll.addEventListener('click', () => {
    // open all image urls in new tabs (if present)
    const imgs = Array.from(document.querySelectorAll('#reports img'))
      .map(i => i.src).filter(Boolean);
    if (imgs.length === 0) return alert('No images to open');
    imgs.forEach(src => window.open(src, '_blank'));
  });

  // initial load
  await loadReports();
}

document.addEventListener('DOMContentLoaded', initLostFound);
