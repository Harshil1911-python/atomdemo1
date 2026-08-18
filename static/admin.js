let photoData=null,editId=null,invFilter='all';

function setPage(title,sub){$('#pageTitle').textContent=title;$('#pageSub').textContent=sub||''}
function showAdminView(id){
  $$('.panel-view').forEach(v=>v.classList.remove('on'));
  const el=$(id);if(el)el.classList.add('on');
  if(id==='#viewSessions'){setPage('Sessions','Panel visits in IST');renderSessions()}
  else if(id==='#viewDatabase'){setPage('Database','Backup, restore & import')}
  else if(id==='#viewVariants'){setPage('Variants','Size / colour / weight options');renderVariants()}
  else if(id==='#viewInventory'){setPage('Inventory','Stock levels & adjustments');renderInventory()}
  else if(id==='#viewPurchase'){setPage('Purchases','Supplier buys & stock in');renderPurchases()}
  else {setPage('Admin','Catalog, stock and store controls')}
}

function renderSessions(){
  const list=getSessions(),box=$('#sessList');
  if(!list.length){box.innerHTML='<div class="empty">No sessions logged yet.</div>';return}
  box.innerHTML=list.map(s=>'<div class="sess-item"><span class="pn">'+s.panel+'</span><span class="tm">'+s.ist+' IST</span></div>').join('');
}

async function refresh(){
  const list=await all('products'),total=list.length,out=list.filter(p=>(p.stock||0)<=0).length;
  const inv=list.reduce((a,p)=>a+(p.price||0)*Math.max(0,p.stock||0),0);
  $('#sTotal').textContent=total;$('#sIn').textContent=total-out;$('#sOut').textContent=out;$('#sVal').textContent=fmt(inv);
  const box=$('#plist');
  if(!list.length){box.innerHTML='<div class="empty">No products yet. Tap Add Product.</div>';return}
  list.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  box.innerHTML=list.map(p=>{
    const low=(p.minStock||0)>0&&(p.stock||0)<=(p.minStock||0);
    const meta=(p.cat||'General')+' · Stock '+(p.stock||0)+(p.unit?' '+p.unit:'')+(low?' · Low':'');
    return '<div class="pi" data-id="'+p.id+'"><div class="thumb">'+productIcon(p)+'</div><div class="info"><div class="name">'+esc(p.name)+'</div><div class="meta">'+esc(meta)+'</div></div><div class="price">'+fmt(p.price)+'</div><button class="del" title="Delete" type="button">×</button></div>';
  }).join('');
  $$('.pi .del').forEach(b=>b.onclick=async e=>{
    e.stopPropagation();
    if(!(await appConfirm('Delete','Delete this product?','Delete',true)))return;
    await del('products',+b.closest('.pi').dataset.id);
    toast('Product deleted');refresh();
  });
  $$('.pi').forEach(row=>{
    row.onclick=async e=>{
      if(e.target.closest('.del'))return;
      const p=await getById('products',+row.dataset.id);
      if(p)openProductModal(p);
    };
  });
}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function openProductModal(p){
  editId=p?p.id:null;
  photoData=p&&p.photo?p.photo:null;
  $('#prodModalTitle').textContent=p?'Edit Product':'Add Product';
  $('#pPrev').innerHTML=photoData?'<img src="'+photoData+'" alt="">':'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  $('#pPhoto').value='';
  $('#pName').value=p?p.name||'':'';
  $('#pPrice').value=p&&p.price!=null?p.price:'';
  $('#pCost').value=p&&p.cost!=null?p.cost:'';
  $('#pStock').value=p&&p.stock!=null?p.stock:'';
  $('#pMinStock').value=p&&p.minStock!=null?p.minStock:'';
  $('#pUnit').value=p&&p.unit?p.unit:'pcs';
  $('#pTax').value=p&&p.tax!=null?p.tax:'';
  $('#pCat').value=p&&p.cat?p.cat:'General';
  $('#pBarcode').value=p?p.barcode||'':'';
  $('#pSku').value=p?p.sku||'':'';
  $('#pSupplier').value=p?p.supplier||'':'';
  $('#pExpiry').value=p?p.expiry||'':'';
  $('#pDesc').value=p?p.desc||'':'';
  $('#admM').classList.add('on');
}

/* ---------- Backup with Web Share ---------- */
async function doBackup(){
  const data={
    version:2,
    created:new Date().toISOString(),
    products:await all('products'),
    transactions:await all('transactions'),
    held:await all('held'),
    variants:await all('variants'),
    purchases:await all('purchases')
  };
  const json=JSON.stringify(data);
  const blob=new Blob([json],{type:'application/json'});
  const d=new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).replace(/[\/,\s]+/g,'-');
  const filename='ATOM-backup-'+d+'.json';
  const file=new File([blob],filename,{type:'application/json'});

  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{
      await navigator.share({files:[file],title:'ATOM POS Backup',text:'ATOM POS database backup'});
      toast('Shared successfully');
      return;
    }catch(e){if(e.name==='AbortError')return}
  }
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=filename;a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup downloaded');
}

async function doRestore(file){
  try{
    const data=JSON.parse(await file.text());
    if(!data||!Array.isArray(data.products))return toast('Invalid backup file');
    if(!(await appConfirm('Restore','This will replace all current data. Continue?','Restore',true)))return;
    await clearStore('products');await clearStore('transactions');await clearStore('held');
    try{await clearStore('variants')}catch(e){}
    try{await clearStore('purchases')}catch(e){}
    for(const x of (data.products||[])){const copy=Object.assign({},x);delete copy.id;await put('products',copy)}
    for(const x of (data.transactions||[]))await put('transactions',x);
    for(const x of (data.held||[])){const copy=Object.assign({},x);delete copy.id;await put('held',copy)}
    for(const x of (data.variants||[])){const copy=Object.assign({},x);delete copy.id;await put('variants',copy)}
    for(const x of (data.purchases||[])){const copy=Object.assign({},x);delete copy.id;await put('purchases',copy)}
    toast('Restore complete');refresh();showAdminView('#viewMain');
  }catch(e){toast('Restore failed')}
}

/* ---------- CSV / Excel import ---------- */
function parseCsvText(text){
  const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(Boolean);
  if(lines.length<2)return[];
  const split=row=>{const out=[];let cur='',q=false;for(let i=0;i<row.length;i++){const c=row[i];if(c==='"'){q=!q;continue}if(c===','&&!q){out.push(cur.trim());cur='';continue}cur+=c}out.push(cur.trim());return out};
  const headers=split(lines[0]).map(h=>h.toLowerCase().replace(/\s+/g,''));
  const map={};
  ['name','price','stock','category','expiry','barcode','cost','unit','minstock','sku','tax','supplier','description','desc'].forEach(k=>{
    const i=headers.indexOf(k);if(i>=0)map[k]=i;
  });
  if(map.category===undefined&&headers.indexOf('cat')>=0)map.category=headers.indexOf('cat');
  if(map.minstock===undefined&&headers.indexOf('min_stock')>=0)map.minstock=headers.indexOf('min_stock');
  if(map.name===undefined||map.price===undefined)return null;
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const c=split(lines[i]);if(!c[map.name])continue;
    const g=(k)=>map[k]!==undefined?c[map[k]]:undefined;
    rows.push({
      name:g('name'),
      price:+g('price')||0,
      stock:map.stock!==undefined?(+g('stock')||0):0,
      cat:g('category')||'General',
      expiry:g('expiry')||'',
      barcode:g('barcode')||'',
      cost:+g('cost')||0,
      unit:g('unit')||'pcs',
      minStock:+g('minstock')||0,
      sku:g('sku')||'',
      tax:+g('tax')||0,
      supplier:g('supplier')||'',
      desc:g('description')||g('desc')||'',
      color:COLORS[Math.floor(Math.random()*COLORS.length)]
    });
  }
  return rows;
}

function sheetToRows(wb){
  const sheet=wb.Sheets[wb.SheetNames[0]];
  const aoa=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
  if(!aoa||aoa.length<2)return[];
  const headers=aoa[0].map(h=>String(h||'').toLowerCase().replace(/\s+/g,''));
  const map={};
  ['name','price','stock','category','expiry','barcode','cost','unit','minstock','sku','tax','supplier','description','desc'].forEach(k=>{
    const i=headers.indexOf(k);if(i>=0)map[k]=i;
  });
  if(map.category===undefined&&headers.indexOf('cat')>=0)map.category=headers.indexOf('cat');
  if(map.name===undefined||map.price===undefined)return null;
  const rows=[];
  for(let i=1;i<aoa.length;i++){
    const c=aoa[i];if(!c||!c[map.name])continue;
    const g=(k)=>map[k]!==undefined?c[map[k]]:undefined;
    rows.push({
      name:String(g('name')||'').trim(),
      price:+g('price')||0,
      stock:map.stock!==undefined?(+g('stock')||0):0,
      cat:String(g('category')||'General').trim()||'General',
      expiry:g('expiry')?String(g('expiry')):'',
      barcode:g('barcode')?String(g('barcode')):'',
      cost:+g('cost')||0,
      unit:g('unit')?String(g('unit')):'pcs',
      minStock:+g('minstock')||0,
      sku:g('sku')?String(g('sku')):'',
      tax:+g('tax')||0,
      supplier:g('supplier')?String(g('supplier')):'',
      desc:g('description')||g('desc')?String(g('description')||g('desc')):'',
      color:COLORS[Math.floor(Math.random()*COLORS.length)]
    });
  }
  return rows;
}

async function doImport(file){
  let rows=null;
  const name=(file.name||'').toLowerCase();
  try{
    if(name.endsWith('.xlsx')||name.endsWith('.xls')){
      if(typeof XLSX==='undefined')return toast('Excel library not loaded');
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array'});
      rows=sheetToRows(wb);
    }else{
      rows=parseCsvText(await file.text());
    }
  }catch(e){return toast('Could not read file')}
  if(rows===null)return toast('Need name and price columns');
  if(!rows.length)return toast('No rows found');
  if(!(await appConfirm('Import','Import '+rows.length+' product(s)?','Import',false)))return;
  for(const r of rows)await put('products',r);
  toast('Imported '+rows.length+' products');
  refresh();showAdminView('#viewMain');
}

/* ---------- Variants ---------- */
async function renderVariants(){
  const list=await all('variants'),products=await all('products');
  const pmap={};products.forEach(p=>pmap[p.id]=p.name);
  const box=$('#varList');
  if(!list.length){box.innerHTML='<div class="empty">No variants yet. Tap Add Variant.</div>';return}
  list.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  box.innerHTML=list.map(v=>'<div class="var-item" data-id="'+v.id+'"><div class="vn">'+esc(v.name)+'</div><div class="vm">'+esc(pmap[v.productId]||'Product #'+v.productId)+' · '+fmt(v.price)+' · Stock '+(v.stock||0)+(v.sku?' · '+esc(v.sku):'')+'</div><button class="del" type="button" style="margin-top:8px;width:auto;padding:6px 12px;border:0;border-radius:8px;background:#fee2e2;color:var(--r);font-weight:600;cursor:pointer">Delete</button></div>').join('');
  $$('#varList .del').forEach(b=>b.onclick=async()=>{
    if(!(await appConfirm('Delete','Delete this variant?','Delete',true)))return;
    await del('variants',+b.closest('.var-item').dataset.id);
    toast('Variant deleted');renderVariants();
  });
}

async function fillProductSelect(sel){
  const products=await all('products');
  products.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  sel.innerHTML=products.length?products.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join(''):'<option value="">No products</option>';
}

/* ---------- Inventory ---------- */
async function renderInventory(){
  let list=await all('products');
  if(invFilter==='out')list=list.filter(p=>(p.stock||0)<=0);
  else if(invFilter==='low')list=list.filter(p=>{
    const min=p.minStock||0;return min>0?(p.stock||0)<=min:(p.stock||0)<=5;
  });
  list.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const box=$('#invList');
  if(!list.length){box.innerHTML='<div class="empty">No products match.</div>';return}
  box.innerHTML=list.map(p=>{
    const low=(p.minStock||0)>0&&(p.stock||0)<=(p.minStock||0);
    return '<div class="inv-item" data-id="'+p.id+'"><div class="info"><div class="name" style="font-weight:700;font-size:14px">'+esc(p.name)+'</div><div class="meta" style="font-size:12px;color:var(--m)">'+(low?'Low stock · ':'')+(p.unit||'pcs')+(p.minStock?' · Min '+p.minStock:'')+'</div></div><div class="stk">'+(p.stock||0)+'</div><div class="adj"><button type="button" data-d="-1">−</button><button type="button" data-d="1">+</button></div></div>';
  }).join('');
  $$('#invList .adj button').forEach(b=>b.onclick=async()=>{
    const id=+b.closest('.inv-item').dataset.id;
    const delta=+b.dataset.d;
    const p=await getById('products',id);
    if(!p)return;
    p.stock=Math.max(0,(p.stock||0)+delta);
    await put('products',p);
    renderInventory();refresh();
  });
}

/* ---------- Purchases ---------- */
async function renderPurchases(){
  const list=await all('purchases'),products=await all('products');
  const pmap={};products.forEach(p=>pmap[p.id]=p.name);
  list.sort((a,b)=>(b.at||'').localeCompare(a.at||''));
  const box=$('#purList');
  if(!list.length){box.innerHTML='<div class="empty">No purchases recorded yet.</div>';return}
  box.innerHTML=list.map(pu=>{
    const when=pu.ist||(pu.at?new Date(pu.at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'');
    return '<div class="pur-item" data-id="'+pu.id+'"><div class="pt">'+esc(pmap[pu.productId]||'Product #'+pu.productId)+' × '+(pu.qty||0)+'</div><div class="pm">'+fmt((pu.cost||0)*(pu.qty||0))+' · '+(pu.supplier?esc(pu.supplier)+' · ':'')+when+(pu.ref?' · Ref '+esc(pu.ref):'')+'</div></div>';
  }).join('');
}

/* ---------- Init ---------- */
$('#btnAdd').onclick=()=>openProductModal(null);
$('#admX').onclick=()=>{$('#admM').classList.remove('on');editId=null;photoData=null};
$('#pPhoto').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{photoData=ev.target.result;$('#pPrev').innerHTML='<img src="'+photoData+'" alt="">'};r.readAsDataURL(f)};

$('#pSave').onclick=async()=>{
  const n=$('#pName').value.trim(),pr=+$('#pPrice').value;
  if(!n||!(pr>=0))return toast('Name & price required');
  const data={
    name:n,
    price:pr,
    cost:+$('#pCost').value||0,
    stock:+$('#pStock').value||0,
    minStock:+$('#pMinStock').value||0,
    unit:$('#pUnit').value||'pcs',
    tax:+$('#pTax').value||0,
    cat:$('#pCat').value||'General',
    barcode:$('#pBarcode').value.trim(),
    sku:$('#pSku').value.trim(),
    supplier:$('#pSupplier').value.trim(),
    expiry:$('#pExpiry').value||'',
    desc:$('#pDesc').value.trim(),
    color:COLORS[Math.floor(Math.random()*COLORS.length)]
  };
  if(photoData)data.photo=photoData;
  if(editId){
    const existing=await getById('products',editId);
    if(existing){
      Object.assign(existing,data);
      if(!photoData&&existing.photo){} 
      if(photoData)existing.photo=photoData;
      await put('products',existing);
      toast('Product updated');
    }
  }else{
    await put('products',data);
    toast('Product saved');
  }
  $('#admM').classList.remove('on');editId=null;photoData=null;refresh();
};

$('#btnErase').onclick=async()=>{
  if(!(await appConfirm('Erase All Data','Erase all products, transactions, held bills, variants and purchases? This cannot be undone.','Erase',true)))return;
  await clearStore('products');await clearStore('transactions');await clearStore('held');
  try{await clearStore('variants')}catch(e){}
  try{await clearStore('purchases')}catch(e){}
  toast('All data erased');refresh();
};

$('#btnAddVariant').onclick=async()=>{
  await fillProductSelect($('#vProduct'));
  $('#vName').value='';$('#vPrice').value='';$('#vStock').value='';$('#vSku').value='';
  $('#varM').classList.add('on');
};
$('#varX').onclick=()=>$('#varM').classList.remove('on');
$('#vSave').onclick=async()=>{
  const pid=+$('#vProduct').value,name=$('#vName').value.trim();
  if(!pid||!name)return toast('Product & variant name required');
  await put('variants',{productId:pid,name,price:+$('#vPrice').value||0,stock:+$('#vStock').value||0,sku:$('#vSku').value.trim()});
  toast('Variant saved');$('#varM').classList.remove('on');renderVariants();
};

$('#btnAddPurchase').onclick=async()=>{
  await fillProductSelect($('#purProduct'));
  $('#purQty').value='';$('#purCost').value='';$('#purSupplier').value='';$('#purRef').value='';$('#purNotes').value='';
  $('#purM').classList.add('on');
};
$('#purX').onclick=()=>$('#purM').classList.remove('on');
$('#purSave').onclick=async()=>{
  const pid=+$('#purProduct').value,qty=+$('#purQty').value;
  if(!pid||!(qty>0))return toast('Product & qty required');
  const p=await getById('products',pid);
  if(!p)return toast('Product not found');
  const cost=+$('#purCost').value||0;
  const now=new Date();
  const ist=now.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
  await put('purchases',{
    productId:pid,qty,cost,
    supplier:$('#purSupplier').value.trim(),
    ref:$('#purRef').value.trim(),
    notes:$('#purNotes').value.trim(),
    at:now.toISOString(),ist
  });
  p.stock=(p.stock||0)+qty;
  if(cost>0)p.cost=cost;
  await put('products',p);
  toast('Purchase recorded · stock +'+qty);
  $('#purM').classList.remove('on');
  renderPurchases();refresh();
};

$$('#invFilter .chip').forEach(c=>c.onclick=()=>{
  $$('#invFilter .chip').forEach(x=>x.classList.remove('on'));
  c.classList.add('on');
  invFilter=c.dataset.f;
  renderInventory();
});

(async()=>{
  logSession('Admin');
  $('#drawerBody').innerHTML=adminMenu();
  initShell();
  await openDB();
  await refresh();
  const closeDr=()=>{$('#dr').classList.remove('on');$('#ov').classList.remove('on')};
  if($('#admOverview'))$('#admOverview').onclick=()=>{closeDr();showAdminView('#viewMain');refresh()};
  if($('#admNotif'))$('#admNotif').onclick=()=>{closeDr();toast('No new notifications')};
  $$('.adm-sub button').forEach(b=>b.onclick=async()=>{
    const a=b.dataset.act;closeDr();
    if(a==='add-product'){openProductModal(null);showAdminView('#viewMain')}
    else if(a==='all-products'){showAdminView('#viewMain');refresh()}
    else if(a==='low-stock'){showAdminView('#viewInventory');invFilter='low';$$('#invFilter .chip').forEach(c=>{c.classList.toggle('on',c.dataset.f==='low')});renderInventory()}
    else if(a==='variants'){showAdminView('#viewVariants')}
    else if(a==='inventory'){showAdminView('#viewInventory');invFilter='all';$$('#invFilter .chip').forEach(c=>{c.classList.toggle('on',c.dataset.f==='all')});renderInventory()}
    else if(a==='purchase'){showAdminView('#viewPurchase')}
    else if(a==='database'){showAdminView('#viewDatabase')}
    else if(a==='sessions'){showAdminView('#viewSessions')}
    else if(a==='panel'){location.href='/billing'}
    else if(a==='sales-today'||a==='sales-all'||a==='unpaid'){toast('Sales reports — coming soon')}
    else if(a==='customers'||a==='suppliers'){toast('Relations — coming soon')}
  });
  if($('#btnBackup'))$('#btnBackup').onclick=doBackup;
  if($('#btnRestore'))$('#btnRestore').onclick=()=>$('#restoreFile').click();
  if($('#restoreFile'))$('#restoreFile').onchange=e=>{const f=e.target.files[0];if(f)doRestore(f);e.target.value=''};
  if($('#btnImportCsv'))$('#btnImportCsv').onclick=()=>$('#importFile').click();
  if($('#importFile'))$('#importFile').onchange=e=>{const f=e.target.files[0];if(f)doImport(f);e.target.value=''};
  if($('#btnErase2'))$('#btnErase2').onclick=()=>$('#btnErase').click();
  document.addEventListener('contextmenu',e=>e.preventDefault());
})();
