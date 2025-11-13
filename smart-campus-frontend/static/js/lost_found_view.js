// static/js/lost_found_view.js
(async function(){
  const API = 'http://127.0.0.1:5000/get_lost_items';
  const grid = document.getElementById('viewGrid');
  const empty = document.getElementById('viewEmpty');
  const filter = document.getElementById('viewFilter');
  const refresh = document.getElementById('viewRefresh');

  function esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function load(){
    grid.innerHTML = ''; empty.style.display='none';
    const status = filter.value;
    const url = API + (status ? '?status='+encodeURIComponent(status) : '');
    try{
      const res = await fetch(url);
      const rows = await res.json();
      if(!rows || rows.length===0){ empty.style.display='block'; return; }
      rows.forEach(r=>{
        const img = r.image_url || (r.image_path ? ('/static/uploads/'+r.image_path) : '../static/img/placeholder.png');
        const el = document.createElement('div');
        el.className='card';
        el.innerHTML = `
          <div class="thumb"><img src="${img}" alt="${esc(r.item_name)}" onerror="this.src='../static/img/placeholder.png'"/></div>
          <h4 style="margin:8px 0 4px;">${esc(r.item_name)}</h4>
          <div class="small-muted">${esc(r.description||'—')}</div>
          <div style="margin-top:8px; font-size:0.9rem;">
            <div>Posted by: ${esc(r.posted_by_name||r.reporter||'Unknown')}</div>
            <div class="small-muted">${esc(r.status||'Lost')} • ${esc(r.posted_at||'')}</div>
          </div>
        `;
        grid.appendChild(el);
      });
    }catch(err){
      console.error(err);
      empty.textContent = 'Unable to fetch items.';
      empty.style.display='block';
    }
  }

  refresh.addEventListener('click', load);
  filter.addEventListener('change', load);
  load();
})();
