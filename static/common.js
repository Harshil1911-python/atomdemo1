const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const toast=(m,t=1800)=>{const e=$('#toast');if(!e)return;e.textContent=m;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),t)};
const fmt=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const COLORS=['#dbeafe','#dcfce7','#fef3c7','#fce7f3','#e0e7ff','#ffedd5','#f3e8ff','#ecfdf5'];
let db;

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

function initShell(){
  const menu=$('#btnMenu'),ov=$('#ov'),dr=$('#dr'),tog=$('#btnChangePanel'),opts=$('#panelOpts');
  if(menu)menu.onclick=()=>{dr.classList.add('on');ov.classList.add('on')};
  if(ov)ov.onclick=()=>{dr.classList.remove('on');ov.classList.remove('on');opts&&opts.classList.remove('show');tog&&tog.classList.remove('open')};
  if(tog)tog.onclick=()=>{opts.classList.toggle('show');tog.classList.toggle('open')};
  let deferred=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;const b=$('#installBanner');b&&b.classList.add('show')});
  const ib=$('#btnInstallPwa');
  if(ib)ib.onclick=async()=>{if(!deferred){toast('Use browser menu: Install app');return}$('#installBanner').classList.remove('show');deferred.prompt();await deferred.userChoice;deferred=null};
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

function panelLinks(active){
  return `<div class="install-banner" id="installBanner"><p>Install ATOM POS on this device</p><button type="button" id="btnInstallPwa">Add to Home Screen</button></div>
<div class="panel-group"><button type="button" class="panel-toggle" id="btnChangePanel">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
Change Panel<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"/></svg></button>
<div class="panel-opts" id="panelOpts">
<a href="/admin"${active==='admin'?' class="active"':''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Admin<small>Manage products &amp; store</small></span></a>
<a href="/billing"${active==='billing'?' class="active"':''}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span>Billing<small>Point of sale</small></span></a>
<a href="/accountant" class="paused${active==='accountant'?' active':''}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Accountant<small>Paused · coming soon</small></span></a>
</div></div>`;
}
