const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const toast=(m,t=1800)=>{const e=$('#toast');if(!e)return;e.textContent=m;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),t)};
const fmt=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const COLORS=['#dbeafe','#dcfce7','#fef3c7','#fce7f3','#e0e7ff','#ffedd5','#f3e8ff','#ecfdf5'];
let db,_dlgResolve=null;

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open('AtomPOS',9);r.onupgradeneeded=e=>{const d=e.target.result;
  if(!d.objectStoreNames.contains('products')){const s=d.createObjectStore('products',{keyPath:'id',autoIncrement:true});s.createIndex('name','name')}
  if(!d.objectStoreNames.contains('transactions'))d.createObjectStore('transactions',{keyPath:'id'});
  if(!d.objectStoreNames.contains('held'))d.createObjectStore('held',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('variants')){const s=d.createObjectStore('variants',{keyPath:'id',autoIncrement:true});s.createIndex('productId','productId')}
  if(!d.objectStoreNames.contains('purchases'))d.createObjectStore('purchases',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('finance'))d.createObjectStore('finance',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('suppliers'))d.createObjectStore('suppliers',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('coupons'))d.createObjectStore('coupons',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('parties'))d.createObjectStore('parties',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('quotations'))d.createObjectStore('quotations',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('pricelists'))d.createObjectStore('pricelists',{keyPath:'id',autoIncrement:true});
};r.onsuccess=e=>{db=e.target.result;res(db)};r.onerror=e=>rej(e.target.error)})}
const all=s=>new Promise((res,rej)=>{const t=db.transaction(s,'readonly').objectStore(s).getAll();t.onsuccess=()=>res(t.result||[]);t.onerror=()=>rej(t.error)});
const put=(s,d)=>new Promise((res,rej)=>{const t=db.transaction(s,'readwrite').objectStore(s).put(d);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)});
const del=(s,id)=>new Promise((res,rej)=>{const t=db.transaction(s,'readwrite').objectStore(s).delete(id);t.onsuccess=()=>res();t.onerror=()=>rej(t.error)});
const clearStore=s=>new Promise((res,rej)=>{const t=db.transaction(s,'readwrite').objectStore(s).clear();t.onsuccess=()=>res();t.onerror=()=>rej(t.error)});
const getById=(s,id)=>new Promise((res,rej)=>{const t=db.transaction(s,'readonly').objectStore(s).get(id);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)});

function productIcon(p){
  if(p&&p.photo)return '<img src="'+p.photo+'" alt="" loading="lazy">';
  const c=(p&&p.color)||COLORS[0];
  return '<div class="ico" style="background:'+c+'"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>';
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
  const msgEl=$('#dlgMsg');msgEl.innerHTML='';msgEl.textContent=msg;
  const inp=$('#dlgInput');if(inp)inp.style.display='none';
  const ok=$('#dlgOk');ok.textContent=okLabel||'OK';ok.className='dlg-ok'+(danger===false?' primary':'');
  $('#appDlg').classList.add('on');
  return new Promise(r=>{_dlgResolve=r});
}
function appPrompt(title,msg,def){
  ensureDlg();
  $('#dlgTitle').textContent=title;
  const msgEl=$('#dlgMsg');msgEl.textContent=msg||'';
  let inp=$('#dlgInput');
  if(!inp){inp=document.createElement('input');inp.id='dlgInput';inp.type='number';inp.style.cssText='width:100%;margin:12px 0 4px;padding:12px;border:1px solid var(--bd,#e2e8f0);border-radius:10px;font-size:16px;font-family:inherit;font-weight:700';msgEl.after(inp)}
  inp.style.display='block';inp.value=def!=null?def:'0';
  const ok=$('#dlgOk');ok.textContent='Continue';ok.className='dlg-ok primary';
  $('#appDlg').classList.add('on');
  setTimeout(()=>{try{inp.focus();inp.select()}catch(e){}},100);
  return new Promise(r=>{_dlgResolve=v=>{r(v===false?null:inp.value);_dlgResolve=null}});
}
async function askNotify(){
  try{
    if(!('Notification' in window)){toast('Notifications not supported');return false}
    if(Notification.permission==='granted')return true;
    if(Notification.permission==='denied'){toast('Enable notifications in browser settings');return false}
    const p=await Notification.requestPermission();
    if(p==='granted'){toast('Notifications enabled');return true}
    toast('Notification permission denied');return false;
  }catch(e){return false}
}
async function notify(title,body){
  const msg=(body||'').slice(0,120);
  try{
    if('Notification' in window){
      if(Notification.permission==='default')await Notification.requestPermission();
      if(Notification.permission==='granted'){
        if(navigator.serviceWorker){
          const reg=await navigator.serviceWorker.getRegistration();
          if(reg&&reg.showNotification){await reg.showNotification(title,{body:msg,icon:'/static/icon-192.png',badge:'/static/icon-192.png',tag:title.slice(0,32),renotify:true});return}
        }
        new Notification(title,{body:msg,icon:'/static/icon-192.png',tag:title.slice(0,32)});
        return;
      }
    }
  }catch(e){}
  toast(title+(msg?': '+msg:''));
}

function closeShell(){
  const ov=$('#ov'),dr=$('#dr');
  if(dr)dr.classList.remove('on');
  if(ov)ov.classList.remove('on');
  $$('.panel-opts,.adm-sub').forEach(e=>e.classList.remove('show'));
  $$('.panel-toggle,.adm-drop').forEach(e=>e.classList.remove('open'));
}
function initShell(){
  const menu=$('#btnMenu'),ov=$('#ov'),dr=$('#dr');
  closeShell();
  if(menu&&dr){
    menu.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      if(dr.classList.contains('on'))closeShell();
      else{dr.classList.add('on');if(ov)ov.classList.add('on')}
    };
  }
  if(ov)ov.onclick=()=>closeShell();
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
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)closeShell()});
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
'<div class="adm-sub" id="sub-products">'+
'<button type="button" data-act="add-product">Add Product</button>'+
'<button type="button" data-act="all-products">All Products</button>'+
'<button type="button" data-act="product-info">Product info</button>'+
'<button type="button" data-act="variants">Variants</button>'+
'<button type="button" data-act="inventory">Inventory</button>'+
'<button type="button" data-act="purchase">Purchases</button>'+
'<button type="button" data-act="suppliers">Suppliers</button>'+
'<button type="button" data-act="reorder">Reorder</button>'+
'<button type="button" data-act="pricelist">Price list</button>'+
'<button type="button" data-act="coupons">Coupons</button>'+
'<button type="button" data-act="barcodes">Barcodes</button>'+
'</div>'+
'<button type="button" class="adm-drop" data-g="sales">Sales'+chev+'</button>'+
'<div class="adm-sub" id="sub-sales"><button type="button" data-act="sales-today">Today</button><button type="button" data-act="sales-all">All Sales</button><button type="button" data-act="unpaid">Unpaid</button><button type="button" data-act="sales-returns">Returns</button></div>'+
'<button type="button" class="adm-drop" data-g="relations">Relations'+chev+'</button>'+
'<div class="adm-sub" id="sub-relations"><button type="button" data-act="customers">Customers</button><button type="button" data-act="suppliers">Suppliers</button></div>'+
'<button type="button" class="adm-drop" data-g="settings">Settings'+chev+'</button>'+
'<div class="adm-sub" id="sub-settings"><button type="button" data-act="prefs">Preferences</button><button type="button" data-act="invoice">Invoice design</button><button type="button" data-act="database">Database</button><button type="button" data-act="payment-log">Payment log</button><button type="button" data-act="shift">Shift info</button><button type="button" data-act="sessions">Sessions</button><button type="button" data-act="panel">Change Panel</button></div>';
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


function getBrand(){try{const s=JSON.parse(localStorage.getItem('atom_prefs')||'{}');return{store:s.store||'ATOM POS',phone:s.phone||'',addr:s.addr||'',gstin:s.gstin||'',gst:+(s.gst||0),footer:s.footer||'Thank you!',color:s.color||'#4f46e5',logo:s.logo||'',layout:s.layout||'classic',paper:+(s.paper||80),blocks:s.blocks||['logo','store','addr','phone','gstin','line','inv','customer','pay','line','items','line','totals','footer']}}catch(e){return{store:'ATOM POS',phone:'',addr:'',gstin:'',gst:0,footer:'Thank you!',color:'#4f46e5',logo:'',layout:'classic',paper:80,blocks:['logo','store','addr','phone','gstin','line','inv','customer','pay','line','items','line','totals','footer']}}}
function invW(mm){return(+mm===58)?384:576}
async function renderThermalPng(meta,items,mm){
  const b=getBrand();mm=+(mm||b.paper||80);const W=invW(mm),pad=Math.round(W*0.06);
  const n=(items||[]).length,H=Math.max(480,200+n*30+220);
  const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#0f172a';ctx.textAlign='center';
  let y=pad;const cx=W/2,fs=mm===58?13:15,fs2=mm===58?11:13;
  const line=()=>{ctx.strokeStyle='#cbd5e1';ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();y+=10};
  for(const bl of(b.blocks||['store','items','totals','footer'])){
    if(bl==='logo'&&b.logo){await new Promise(res=>{const img=new Image();img.onload=()=>{const s=mm===58?40:56;ctx.drawImage(img,cx-s/2,y,s,s);y+=s+8;res()};img.onerror=res;img.src=b.logo});continue}
    if(bl==='store'){ctx.font='bold '+(fs+4)+'px system-ui,sans-serif';ctx.fillText(String(b.store||'ATOM POS').slice(0,mm===58?22:30),cx,y+fs);y+=fs+12;continue}
    if(bl==='addr'&&b.addr){ctx.font=fs2+'px system-ui';ctx.fillStyle='#475569';String(b.addr).match(/.{1,28}/g)?.slice(0,3).forEach(t=>{ctx.fillText(t,cx,y);y+=fs2+4});ctx.fillStyle='#0f172a';y+=4;continue}
    if(bl==='phone'&&b.phone){ctx.font=fs2+'px system-ui';ctx.fillStyle='#475569';ctx.fillText(String(b.phone),cx,y);y+=fs2+8;ctx.fillStyle='#0f172a';continue}
    if(bl==='gstin'&&b.gstin){ctx.font=fs2+'px system-ui';ctx.fillStyle='#475569';ctx.fillText('GSTIN: '+b.gstin,cx,y);y+=fs2+8;ctx.fillStyle='#0f172a';continue}
    if(bl==='line'){line();continue}
    if(bl==='inv'){ctx.font='bold '+fs+'px system-ui';ctx.fillText('INV #'+(meta.invNo||''),cx,y);y+=fs+6;ctx.font=fs2+'px system-ui';ctx.fillStyle='#64748b';ctx.fillText(meta.dateStr||'',cx,y);y+=fs2+10;ctx.fillStyle='#0f172a';continue}
    if(bl==='customer'){ctx.font=fs2+'px system-ui';ctx.fillText('To: '+(meta.customer||'Walk-in'),cx,y);y+=fs2+8;continue}
    if(bl==='pay'){ctx.font=fs2+'px system-ui';ctx.fillStyle='#64748b';ctx.fillText((meta.status==='unpaid'?'UNPAID':'PAID')+(meta.payMethod?' · '+String(meta.payMethod).toUpperCase():''),cx,y);y+=fs2+10;ctx.fillStyle='#0f172a';continue}
    if(bl==='items'){ctx.font='bold '+fs2+'px system-ui';ctx.textAlign='left';ctx.fillText('Item',pad,y);ctx.textAlign='center';ctx.fillText('Qty',W*0.62,y);ctx.textAlign='right';ctx.fillText('Amt',W-pad,y);y+=fs2+6;ctx.font=fs2+'px system-ui';(items||[]).forEach(it=>{const amt=(+it.qty||0)*(+it.price||0);ctx.textAlign='left';ctx.fillText(String(it.name||'').slice(0,mm===58?16:22),pad,y);ctx.textAlign='center';ctx.fillText(String(it.qty||0),W*0.62,y);ctx.textAlign='right';ctx.fillText('₹'+amt.toFixed(2),W-pad,y);y+=fs2+8});ctx.textAlign='center';y+=4;continue}
    if(bl==='totals'){ctx.textAlign='left';ctx.font=fs2+'px system-ui';ctx.fillStyle='#64748b';if(meta.sub!=null){ctx.fillText('Subtotal',pad,y);ctx.textAlign='right';ctx.fillText('₹'+(+meta.sub).toFixed(2),W-pad,y);ctx.textAlign='left';y+=fs2+6}if(+meta.disc){ctx.fillText('Discount',pad,y);ctx.textAlign='right';ctx.fillText('-₹'+(+meta.disc).toFixed(2),W-pad,y);ctx.textAlign='left';y+=fs2+6}ctx.fillStyle='#0f172a';ctx.font='bold '+(fs+2)+'px system-ui';ctx.fillText('TOTAL',pad,y);ctx.textAlign='right';ctx.fillText('₹'+(+meta.total).toFixed(2),W-pad,y);ctx.textAlign='center';y+=fs+14;continue}
    if(bl==='footer'){ctx.font=fs2+'px system-ui';ctx.fillStyle='#64748b';ctx.fillText(String(b.footer||'Thank you!').slice(0,mm===58?24:36),cx,y);y+=fs2+10;ctx.font='10px system-ui';ctx.fillText(mm+'mm · ATOM POS',cx,y);y+=14}
  }
  const out=document.createElement('canvas');out.width=W;out.height=Math.min(H,Math.max(y+pad,200));out.getContext('2d').drawImage(c,0,0);
  return await new Promise(r=>out.toBlob(r,'image/png'));
}