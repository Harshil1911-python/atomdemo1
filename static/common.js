const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const toast=(m,t=1800)=>{const e=$('#toast');if(!e)return;e.textContent=m;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),t)};
const fmt=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const COLORS=['#dbeafe','#dcfce7','#fef3c7','#fce7f3','#e0e7ff','#ffedd5','#f3e8ff','#ecfdf5'];
let db,_dlgResolve=null;

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open('AtomPOS',4);r.onupgradeneeded=e=>{const d=e.target.result;
  if(!d.objectStoreNames.contains('products')){const s=d.createObjectStore('products',{keyPath:'id',autoIncrement:true});s.createIndex('name','name')}
  if(!d.objectStoreNames.contains('transactions'))d.createObjectStore('transactions',{keyPath:'id'});
  if(!d.objectStoreNames.contains('held'))d.createObjectStore('held',{keyPath:'id',autoIncrement:true});
};r.onsuccess=e=>{db=e.target.result;res(db)};r.onerror=e=>rej(e.target.error)})}
const all=s=>new Promise((res,rej)=>{const t=db.transaction(s,'readonly').objectStore(s).getAll();t.onsuccess=()=>res(t.result||[]);t.onerror=()=>rej(t.error)});
const put=(s,d)=>new Promise((res,rej)=>{const t=db.transaction(s,'readwrite').objectStore(s).put(d);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)});
const del=(s,id)=>new Promise((res,rej)=>{const t=db.transaction(s,'readwrite').objectStore(s).delete(id);t.onsuccess=()=>res();t.onerror=()=>rej(t.error)});
const clearStore=s=>new Promise((res,rej)=>{const t=db.transaction(s,'readwrite').objectStore(s).clear();t.onsuccess=()=>res();t.onerror=()=>rej(t.error)});

function productIcon(p){
  if(p&&p.photo)return `<img src="${p.photo}" alt="">`;
  const c=(p&&p.color)||COLORS[0];
  return `<div class="ico" style="background:${c}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>`;
}

function ensureDlg(){
  if($('#appDlg'))return;
  const d=document.createElement('div');
  d.id='appDlg';d.className='dlg';
  d.innerHTML='<div class="dlg-box"><h3 id="dlgTitle">Confirm</h3><p id="dlgMsg"></p><div class="dlg-actions"><button type="button" class="dlg-cancel" id="dlgCancel">Cancel</button><button type="button" class="dlg-ok" id="dlgOk">OK</button></div></div>';
  ($('.app')||document.body).appendChild(d);
  $('#dlgCancel').onclick=()=>{d.classList.remove('on');if(_dlgResolve)_dlgResolve(false);_dlgResolve=null};
  $('#dlgOk').onclick=()=>{d.classList.remove('on');if(_dlgResolve)_dlgResolve(true);_dlgResolve=null};
}
function appConfirm(title,msg,okLabel,danger){
  ensureDlg();
  $('#dlgTitle').textContent=title;
  $('#dlgMsg').textContent=msg;
  const ok=$('#dlgOk');ok.textContent=okLabel||'OK';ok.className='dlg-ok'+(danger===false?' primary':'');
  $('#appDlg').classList.add('on');
  return new Promise(r=>{_dlgResolve=r});
}

function initShell(){
  const menu=$('#btnMenu'),ov=$('#ov'),dr=$('#dr');
  if(menu)menu.onclick=()=>{dr.classList.add('on');ov.classList.add('on')};
  if(ov)ov.onclick=()=>{
    dr.classList.remove('on');ov.classList.remove('on');
    $$('.panel-opts,.adm-sub').forEach(e=>e.classList.remove('show'));
    $$('.panel-toggle,.adm-drop').forEach(e=>e.classList.remove('open'));
  };
  const tog=$('#btnChangePanel'),opts=$('#panelOpts');
  if(tog)tog.onclick=()=>{opts.classList.toggle('show');tog.classList.toggle('open')};
  $$('.adm-drop').forEach(btn=>{
    btn.onclick=()=>{
      const sub=btn.nextElementSibling;
      const open=sub&&sub.classList.contains('show');
      $$('.adm-sub').forEach(s=>s.classList.remove('show'));
      $$('.adm-drop').forEach(b=>b.classList.remove('open'));
      if(sub&&!open){sub.classList.add('show');btn.classList.add('open')}
    };
  });
  let deferred=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;const b=$('#installBanner');b&&b.classList.add('show')});
  const ib=$('#btnInstallPwa');
  if(ib)ib.onclick=async()=>{if(!deferred){toast('Use browser menu: Install app');return}$('#installBanner').classList.remove('show');deferred.prompt();await deferred.userChoice;deferred=null};
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

function panelLinks(active){
  return '<div class="install-banner" id="installBanner"><p>Install ATOM POS on this device</p><button type="button" id="btnInstallPwa">Add to Home Screen</button></div>'+
'<div class="panel-group"><button type="button" class="panel-toggle" id="btnChangePanel">'+
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'+
'Change Panel<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"/></svg></button>'+
'<div class="panel-opts" id="panelOpts">'+
'<a href="/admin"'+(active==='admin'?' class="active"':'')+'><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Admin<small>Manage products &amp; store</small></span></a>'+
'<a href="/billing"'+(active==='billing'?' class="active"':'')+'><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span>Billing<small>Point of sale</small></span></a>'+
'<a href="/accountant" class="paused'+(active==='accountant'?' active':'')+'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Accountant<small>Paused · coming soon</small></span></a>'+
'</div></div>';
}

function adminMenu(){
  const chev='<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"/></svg>';
  return '<div class="install-banner" id="installBanner"><p>Install ATOM POS on this device</p><button type="button" id="btnInstallPwa">Add to Home Screen</button></div>'+
'<button type="button" class="adm-link" id="admOverview">Overview</button>'+
'<button type="button" class="adm-link" id="admNotif">Notifications</button>'+
'<button type="button" class="adm-drop" data-g="products">Products'+chev+'</button>'+
'<div class="adm-sub" id="sub-products"><button type="button" data-act="add-product">Add Product</button><button type="button" data-act="all-products">All Products</button><button type="button" data-act="low-stock">Low Stock</button></div>'+
'<button type="button" class="adm-drop" data-g="sales">Sales'+chev+'</button>'+
'<div class="adm-sub" id="sub-sales"><button type="button" data-act="sales-today">Today</button><button type="button" data-act="sales-all">All Sales</button><button type="button" data-act="unpaid">Unpaid</button></div>'+
'<button type="button" class="adm-drop" data-g="relations">Relations'+chev+'</button>'+
'<div class="adm-sub" id="sub-relations"><button type="button" data-act="customers">Customers</button><button type="button" data-act="suppliers">Suppliers</button></div>'+
'<button type="button" class="adm-drop" data-g="settings">Settings'+chev+'</button>'+
'<div class="adm-sub" id="sub-settings"><button type="button" data-act="database">Database</button><button type="button" data-act="sessions">Sessions</button><button type="button" data-act="panel">Change Panel</button></div>';
}


function logSession(panel){
  try{
    const key='atom_sessions';
    const list=JSON.parse(localStorage.getItem(key)||'[]');
    const now=new Date();
    const ist=now.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
    list.unshift({panel,at:now.toISOString(),ist});
    localStorage.setItem(key,JSON.stringify(list.slice(0,200)));
  }catch(e){}
}
function getSessions(){try{return JSON.parse(localStorage.getItem('atom_sessions')||'[]')}catch(e){return[]}}
