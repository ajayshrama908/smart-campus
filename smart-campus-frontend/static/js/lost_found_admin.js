// static/js/lost_found_admin.js
(async function(){
  const API_GET = 'http://127.0.0.1:5000/get_lost_items';
  const API_UPDATE = 'http://127.0.0.1:5000/update_lost_status';
  const list = document.getElementById('adminList');
  const refresh = document.getElementById('adminRefresh');

  function esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function load(){
    list.innerHTML = '';
    try{
      const res = await fetch(API_GET);
      const rows = await res.json();
      if(!rows || rows.length===0){ list.innerHTML = '<p class="muted">No records</p>'; return; }
      for(const r of rows){
        const img = r.image_url || (r.image_path ? ('/static/uploads/'+r.image_path) : '../static/img/placeholder.png');
        const container = document.createElement('div');
        container.className = 'card';
        container.innerHTML = `
          <div class="row">
            <div class="thumb"><img src="${img}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='../static/img/placeholder.png'"/></div>
            <div style="flex:1">
              <h3 style="margin:0 0 6px">${esc(r.item_name)}</h3>
              <div class="muted">${esc(r.description||'')}</div>
              <div style="margin-top:10px;">
                <div class="muted">Posted by: ${esc(r.posted_by_name||r.reporter||'Unknown')}</div>
                <div class="muted">Posted at: ${esc(r.posted_at||'')}</div>
              </div>

              <div style="margin-top:12px;display:flex;gap:10px;align-items:center;">
                <select data-id="${r.item_id}" class="status-select input">
                  <option ${r.status==='Lost'?'selected':''}>Lost</option>
                  <option ${r.status==='Found'?'selected':''}>Found</option>
                  <option ${r.status==='Returned'?'selected':''}>Returned</option>
                </select>
                <button class="btn" data-action="save" data-id="${r.item_id}">Save</button>
                <button class="btn" data-action="delete" data-id="${r.item_id}" style="background:#ff6b6b">Delete</button>
              </div>
            </div>
          </div>
        `;
        list.appendChild(container);
      }

      // wire buttons
      list.querySelectorAll('button[data-action]').forEach(b=>{
        b.addEventListener('click', async (e)=>{
          const id = e.currentTarget.dataset.id;
          const action = e.currentTarget.dataset.action;
          if(action==='save'){
            const sel = list.querySelector(`select[data-id="${id}"]`);
            const status = sel.value;
            try{
              const r = await fetch(API_UPDATE, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ item_id: id, status })});
              const data = await r.json();
              if(!r.ok) throw new Error(data.error||data.message||'Failed');
              alert('Status updated');
              load();
            }catch(err){ alert('Error: '+err.message); console.error(err); }
          }else if(action==='delete'){
            if(!confirm('Delete this record?')) return;
            try{
              // reuse update API to mark as Returned then optionally delete on server - if you want real delete add endpoint
              const r = await fetch(API_UPDATE, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ item_id: id, status:'Returned' })});
              if(!r.ok) throw new Error('Failed to mark returned');
              alert('Marked returned (or deleted on server)');
              load();
            }catch(err){ alert('Error: '+err.message); }
          }
        });
      });

    }catch(err){
      console.error(err);
      list.innerHTML = '<p class="muted">Unable to fetch records.</p>';
    }
  }

  refresh.addEventListener('click', load);
  load();
})();
