let photoData=null,editId=null,invFilter='all';

function setPage(title,sub){$('#pageTitle').textContent=title;$('#pageSub').textContent=sub||''}
function showAdminView(id){
  $$('.panel-view').forEach(v=>v.classList.remove('on'));
  const el=$(id);if(el)el.classList.add('on');
  const map={
    '#viewSessions':['Sessions','Panel visits in IST',renderSessions],
    '#viewPrefs':['Preferences','Store profile & defaults',null],'#viewDatabase':['Database','Backup, restore & import',null],
    '#viewVariants':['Variants','Size / colour / weight',renderVariants],
    '#viewInventory':['Inventory','Stock levels & bulk edit',renderInventory],
    '#viewPurchase':['Purchases','POs & finance',renderPurchases],
    '#viewReorder':['Reorder','Suggested purchase qty',renderReorder],
    '#viewExpiring':['Expiring','Within 30 days',renderExpiring],
    '#viewSuppliers':['Suppliers','Vendor list',renderSuppliers],
    '#viewPricelist':['Price list','Default & party prices',renderPricelist],
    '#viewPayLog':['Payment log','All movements',renderPayLog],
    '#viewShift':['Shift info','Live shift status',renderShift],
    '#viewCoupons':['Coupons','Discount codes',renderCoupons],
    '#viewBarcodes':['Barcodes','Codes for scan',renderBarcodes],
    '#viewProducts':['All products','Tap to edit',null],
    '#viewProductInfo':['Product info','Read-only catalog',renderProductInfo],
    '#viewSales':['Sales','Invoices & returns',renderSales],
    '#viewCustomers':['Customers','Relations · buyers',renderCustomers],
    '#viewMain':['Admin','Overview & insights',null]
  };
  const m=map[id];
  if(m){setPage(m[0],m[1]);if(m[2])m[2]()}
  else setPage('Admin','Catalog, stock and store controls');
}

function renderSessions(){
  const list=getSessions(),box=$('#sessList');
  if(!list.length){box.innerHTML='<div class="empty">No sessions logged yet.</div>';return}
  box.innerHTML=list.map(s=>'<div class="sess-item"><span class="pn">'+s.panel+'</span><span class="tm">'+s.ist+' IST</span></div>').join('');
}

let salesFilter='today';
async function refresh(){
  const list=await all('products'),total=list.length,out=list.filter(p=>(p.stock||0)<=0).length;
  const inv=list.reduce((a,p)=>a+(p.price||0)*Math.max(0,p.stock||0),0);
  if($('#sTotal'))$('#sTotal').textContent=total;if($('#sIn'))$('#sIn').textContent=total-out;if($('#sOut'))$('#sOut').textContent=out;if($('#sVal'))$('#sVal').textContent=fmt(inv);
  const txs=await all('transactions');
  const dayStart=new Date();dayStart.setHours(0,0,0,0);
  let todaySale=0,totalSale=0,unpaidAmt=0,paidCnt=0,cashR=0,upiR=0,cardR=0,otherR=0;
  for(const tx of txs){
    const amt=+tx.amount||0;
    if(tx.status==='unpaid')unpaidAmt+=amt;
    else if(amt>0){
      totalSale+=amt;paidCnt++;
      if(tx.date&&new Date(tx.date)>=dayStart)todaySale+=amt;
      const m=(tx.payMethod||'cash').toLowerCase();
      if(m==='upi'||m==='bank')upiR+=amt;else if(m==='card')cardR+=amt;else if(m==='other')otherR+=amt;else cashR+=amt;
    }
  }
  if($('#sToday'))$('#sToday').textContent=fmt(todaySale);
  if($('#sSales'))$('#sSales').textContent=fmt(totalSale);
  if($('#sAvg'))$('#sAvg').textContent=paidCnt?fmt(totalSale/paidCnt):'₹0';
  // To collect = unpaid sales; to pay = ordered POs; balance = paid in - paid out
  let toPay=0,paidOut=0,finIn=0,finOut=0;
  try{
    for(const po of await all('purchases')){
      const tot=+po.total||((+po.cost||0)*(+po.qty||0));
      if((po.status||'received')==='ordered')toPay+=tot; else paidOut+=tot;
    }
  }catch(e){}
  try{
    for(const f of await all('finance')){
      if(f.type==='payment'&&f.direction==='in')finIn+=(+f.amount||0);
      if(f.type==='payment'&&f.direction==='out')finOut+=(+f.amount||0);
    }
  }catch(e){}
  if($('#sCollect'))$('#sCollect').textContent=fmt(unpaidAmt);
  if($('#sPay'))$('#sPay').textContent=fmt(toPay);
  if($('#sBal'))$('#sBal').textContent=fmt(totalSale+finIn-paidOut-finOut);
  if($('#sPaid'))$('#sPaid').textContent=fmt(totalSale);
  if($('#sUnpaidRev'))$('#sUnpaidRev').textContent=fmt(unpaidAmt);
  if($('#sCash'))$('#sCash').textContent=fmt(cashR);
  if($('#sUpi'))$('#sUpi').textContent=fmt(upiR);
  if($('#sCard'))$('#sCard').textContent=fmt(cardR);
  if($('#sOther'))$('#sOther').textContent=fmt(otherR);

  const sold={}; // product name -> qty (approx from cart not stored; use subtitle/title heuristics + amount)
  // Prefer items array if present
  const byProd={}, byCust={};
  for(const tx of txs){
    const cust=(tx.title&&tx.title!=='Cash Sale')?tx.title:'Walk-in';
    byCust[cust]=(byCust[cust]||0)+(+tx.amount||0);
    if(Array.isArray(tx.items)){
      for(const it of tx.items){
        const n=it.name||('#'+it.id);
        byProd[n]=(byProd[n]||0)+(+it.qty||1);
      }
    }
  }
  const topP=Object.entries(byProd).sort((a,b)=>b[1]-a[1])[0];
  const topC=Object.entries(byCust).sort((a,b)=>b[1]-a[1])[0];
  // Fast moving = highest qty sold in last 14 days if dated
  const cut=Date.now()-14*864e5;
  const fast={};
  for(const tx of txs){
    if(tx.date&&new Date(tx.date).getTime()<cut)continue;
    if(Array.isArray(tx.items))for(const it of tx.items){const n=it.name||('#'+it.id);fast[n]=(fast[n]||0)+(+it.qty||1)}
  }
  const topF=Object.entries(fast).sort((a,b)=>b[1]-a[1])[0]||topP;
  if($('#mostSell'))$('#mostSell').textContent=topP?(topP[0]+' · '+topP[1]+' sold'):'No sales data yet';
  if($('#mostCust'))$('#mostCust').textContent=topC?(topC[0]+' · '+fmt(topC[1])):'No customer data yet';
  if($('#mostFast'))$('#mostFast').textContent=topF?(topF[0]+' · '+topF[1]+' units'):'No movement data yet';
  const box=$('#plist');
  if(box){
    list.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    box.innerHTML=list.map(p=>'<div class="pi" data-id="'+p.id+'"><div class="thumb">'+productIcon(p)+'</div><div class="info"><div class="name">'+esc(p.name)+'</div><div class="meta">'+(p.cat||'General')+' · Stock '+(p.stock||0)+'</div></div><div class="price">'+fmt(p.price)+'</div><button class="del" type="button">×</button></div>').join('')||'<div class="empty">No products</div>';
    $$('.pi .del').forEach(b=>b.onclick=async e=>{e.stopPropagation();if(!(await appConfirm('Delete','Delete this product?','Delete',true)))return;await del('products',+b.closest('.pi').dataset.id);toast('Deleted');refresh()});
    $$('.pi').forEach(row=>{row.onclick=e=>{if(e.target.closest('.del'))return;const id=+row.dataset.id;const prod=list.find(x=>+x.id===id);if(prod)openProductModal(prod)}});
  }
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
  $('#pBrand').value=p?p.brand||'':'';
  $('#pHsn').value=p?p.hsn||'':'';
  $('#pReorder').value=p&&p.reorder!=null?p.reorder:'';
  if($('#pTaxInc'))$('#pTaxInc').checked=!!(p&&p.taxInc);
  $('#pSupplier').value=p?p.supplier||'':'';
  $('#pExpiry').value=p?p.expiry||'':'';
  $('#pDesc').value=p?p.desc||'':'';
  $('#admM').classList.add('on');
}

/* ---------- Backup / Share — Web Share files[] (barcode-style) ---------- */
function _capPlugin(n){try{return window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins[n]}catch(e){return null}}
function _blobB64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const s=String(r.result||'');const i=s.indexOf(',');res(i>=0?s.slice(i+1):s)};r.onerror=rej;r.readAsDataURL(blob)})}
function _dlBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{try{document.body.removeChild(a)}catch(e){}URL.revokeObjectURL(url)},800)}
function _u16(n){return new Uint8Array([n&255,(n>>8)&255])}
function _u32(n){return new Uint8Array([n&255,(n>>8)&255,(n>>16)&255,(n>>24)&255])}
function _crc32(buf){let c=~0;for(let i=0;i<buf.length;i++){c^=buf[i];for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1))}return (~c)>>>0}
function _zipOne(name,str){
  const enc=new TextEncoder(),nameB=enc.encode(name),data=enc.encode(str),crc=_crc32(data);
  const local=new Uint8Array([0x50,0x4b,0x03,0x04,..._u16(20),..._u16(0),..._u16(0),..._u16(0),..._u16(0),..._u32(crc),..._u32(data.length),..._u32(data.length),..._u16(nameB.length),..._u16(0),...nameB,...data]);
  const central=new Uint8Array([0x50,0x4b,0x01,0x02,..._u16(20),..._u16(20),..._u16(0),..._u16(0),..._u16(0),..._u16(0),..._u32(crc),..._u32(data.length),..._u32(data.length),..._u16(nameB.length),..._u16(0),..._u16(0),..._u16(0),..._u16(0),..._u32(0),..._u32(0),...nameB]);
  const end=new Uint8Array([0x50,0x4b,0x05,0x06,..._u16(0),..._u16(0),..._u16(1),..._u16(1),..._u32(central.length),..._u32(local.length),..._u16(0)]);
  return new Blob([local,central,end],{type:'application/zip'});
}
let _bakCache=null,_bakAt=0,_bakBusy=null;
async function _backupZip(force){
  if(!force&&_bakCache&&Date.now()-_bakAt<120000)return _bakCache;
  if(_bakBusy)return _bakBusy;
  _bakBusy=(async()=>{
    let finance=[];try{finance=await all('finance')}catch(e){}
    const data={version:2,created:new Date().toISOString(),products:await all('products'),transactions:await all('transactions'),held:await all('held'),variants:await all('variants'),purchases:await all('purchases'),suppliers:await all('suppliers'),coupons:await all('coupons'),parties:await all('parties'),quotations:await all('quotations'),pricelists:await all('pricelists'),finance};
    const json=JSON.stringify(data);
    const d=new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(/[\/,\s:]+/g,'-');
    const filename='ATOM-backup-'+d+'.zip';
    _bakCache={blob:_zipOne('backup.json',json),filename,json};_bakAt=Date.now();_bakBusy=null;
    return _bakCache;
  })();
  return _bakBusy;
}
function prewarmBackup(){try{_backupZip(true)}catch(e){}}
function _shareBusy(on,msg){
  let el=document.getElementById('bakShareBusy');
  if(on){
    if(!el){el=document.createElement('div');el.id='bakShareBusy';el.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:24px';el.innerHTML='<div style="background:#fff;border-radius:16px;padding:22px 24px;max-width:300px;text-align:center;font-weight:600;font-size:14px;line-height:1.45;box-shadow:0 12px 40px rgba(0,0,0,.2)"></div>';document.body.appendChild(el)}
    el.style.display='flex';el.firstChild.textContent=msg||'Creating backup ZIP…';
  }else if(el)el.style.display='none';
}
async function doDownload(){
  try{_shareBusy(1,'Preparing ZIP…');const p=await _backupZip(true);_shareBusy(0);_dlBlob(p.blob,p.filename);toast('Backup ZIP downloaded')}
  catch(e){_shareBusy(0);toast('Download failed')}
}
async function doShare(){
  // Web Share (files) — must stay in the user-gesture chain (no setTimeout)
  if(!window.isSecureContext){toast('Open the app via HTTPS (or installed PWA) to share');return}
  // Reuse the ZIP prewarmed on pointerdown instead of rebuilding it here — rebuilding from
  // scratch (reading every table again) can take long enough to burn the browser's user-gesture
  // window, which makes navigator.share() silently refuse to open. force=false lets the
  // still-fresh prewarmed cache be used so share() fires immediately after the tap.
  let p;
  try{p=await _backupZip(false)}catch(e){_shareBusy(0);toast('Could not create ZIP');return}
  _shareBusy(1,'Opening share… pick WhatsApp');
  const title='ATOM POS Backup';
  const text='*ATOM POS* database backup\n'+p.filename+'\n\nIn ATOM POS: Admin > Database > Restore Backup, then pick this file.';
  // iOS Safari has a long-standing WebKit bug: navigator.share({files, title, ...}) — when
  // BOTH files and title are set — silently shares the title as plain text instead of
  // attaching the file. Confirmed by multiple developer reports (Apple Developer Forums
  // thread 665812 and others). Omitting title and sharing files+text only is the known
  // workaround and makes iOS actually attach the file instead of quietly dropping it.
  // Chromium's Web Share API only allows sharing a small allow-list of file EXTENSIONS —
  // audio/image/pdf/video/text. ".zip" is not on that list, so navigator.canShare()/share()
  // reject a real .zip file no matter what MIME type it's labeled with (relabeling the MIME
  // type, which the old code tried, doesn't help — Chromium checks the filename extension).
  // The bytes are unchanged either way, and Restore already detects the backup by its ZIP
  // magic header rather than by filename, so we share the same bytes under a permitted
  // ".txt" name and Restore accepts ".txt" files too (see restoreFile accept= in admin.html).
  // Only Chromium (Chrome/Edge/Samsung Internet/Android WebView) hard-blocks the .zip
  // extension from Web Share — Safari/WebKit has no such allow-list, so keep the real
  // .zip name there (and on Capacitor, which never reaches this branch anyway).
  const isChromium=!!(window.chrome||/Chrome|Chromium|CriOS|Edg\//.test(navigator.userAgent));
  const shareName=isChromium?p.filename.replace(/\.zip$/i,'')+'.txt':p.filename;
  const shareFile=new File([p.blob],shareName,{type:isChromium?'text/plain':'application/zip'});
  const files=[shareFile];

  const shareFn=navigator.share&&navigator.share.bind(navigator);
  let shareDiag='no navigator.share';
  if(shareFn){
    shareDiag='canShare()=false';
    try{
      if(!navigator.canShare||navigator.canShare({files})){
        await shareFn({files,text});
        _shareBusy(0);toast('Pick WhatsApp — send the file');
        return;
      }
    }catch(e){
      if(e&&e.name==='AbortError'){_shareBusy(0);return}
      shareDiag=(e&&e.name||'Error')+': '+(e&&e.message||'');
    }
  }
  console.warn('[ATOM share] system share sheet unavailable —',shareDiag);
  // Capacitor native (installed app build) — real files aren't restricted here, share the actual .zip
  try{
    const FS=_capPlugin('Filesystem'),Share=_capPlugin('Share');
    if(FS&&Share){
      const b64=await _blobB64(p.blob);
      await FS.writeFile({path:'atom-share/'+p.filename,data:b64,directory:'CACHE',recursive:true});
      const u=await FS.getUri({path:'atom-share/'+p.filename,directory:'CACHE'});
      const uri=u&&(u.uri||u);
      if(uri){await Share.share({title,text,url:uri,files:[uri],dialogTitle:'Share backup'});_shareBusy(0);toast('Pick WhatsApp');return}
    }
  }catch(e){}
  _shareBusy(0);
  _dlBlob(p.blob,p.filename);
  toast('Share sheet unavailable ('+shareDiag+') — ZIP saved to Downloads instead');
}

async function _parseBackupFile(file){
  const buf=await file.arrayBuffer();
  const u8=new Uint8Array(buf);
  // ZIP magic PK
  if(u8[0]===0x50&&u8[1]===0x4b){
    // store-only zip: find local file data after name
    const nameLen=u8[26]|(u8[27]<<8),extraLen=u8[28]|(u8[29]<<8);
    const dataStart=30+nameLen+extraLen;
    const compSize=(u8[18]|(u8[19]<<8)|(u8[20]<<16)|(u8[21]<<24))>>>0;
    const slice=u8.slice(dataStart,dataStart+compSize);
    const text=new TextDecoder().decode(slice);
    return JSON.parse(text);
  }
  return JSON.parse(new TextDecoder().decode(u8));
}

async function doRestore(file){
  try{
    const data=await _parseBackupFile(file);
    if(!data||!Array.isArray(data.products))return toast('Invalid backup file');
    if(!(await appConfirm('Restore','This will replace all current data. Continue?','Restore',true)))return;
    for(const s of ['products','transactions','held','variants','purchases','suppliers','coupons','parties','quotations','pricelists','finance'])try{await clearStore(s)}catch(e){}
    for(const x of (data.products||[])){const c=Object.assign({},x);delete c.id;await put('products',c)}
    for(const x of (data.transactions||[]))await put('transactions',x);
    for(const s of ['held','variants','purchases','suppliers','coupons','parties','quotations','pricelists','finance'])for(const x of (data[s]||[])){const c=Object.assign({},x);delete c.id;await put(s,c)}
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
  else if(invFilter==='low')list=list.filter(p=>{const min=p.minStock||0;return min>0?(p.stock||0)<=min:(p.stock||0)<=5});
  list.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const box=$('#invList');
  if(!list.length){box.innerHTML='<div class="empty">No products match.</div>';return}
  box.innerHTML=list.map(p=>{
    const low=(p.minStock||0)>0&&(p.stock||0)<=(p.minStock||0);
    return '<div class="bulk-row" data-id="'+p.id+'"><div class="bn">'+(low?'⚠ ':'')+esc(p.name)+'<div style="font-size:11px;color:var(--m);font-weight:500">Min '+(p.minStock||0)+'</div></div><input type="number" min="0" class="bulk-stock" value="'+(p.stock||0)+'"></div>';
  }).join('');
}

/* ---------- Purchases ---------- */
async function renderPurchases(){
  const list=await all('purchases');
  list.sort((a,b)=>(b.at||'').localeCompare(a.at||''));
  const spend=list.reduce((a,p)=>a+(+p.total||((+p.cost||0)*(+p.qty||0))),0);
  if($('#poSpend'))$('#poSpend').textContent=fmt(spend);
  let fout=0;
  try{const fin=await all('finance');fout=fin.filter(x=>x.direction==='out').reduce((a,x)=>a+(+x.amount||0),0)}catch(e){}
  if($('#finOut'))$('#finOut').textContent=fmt(fout);
  const box=$('#purList');
  if(!list.length){box.innerHTML='<div class="empty">No purchase orders yet.</div>';return}
  box.innerHTML=list.map(p=>'<div class="sess-item"><div><div class="pn">'+(p.productName||('Product #'+p.productId))+' × '+(p.qty||0)+'</div><div class="tm">'+(p.ist||'')+' · '+(p.status||'received')+(p.supplier?' · '+p.supplier:'')+'</div></div><div class="pn">'+fmt(p.total||((p.cost||0)*(p.qty||0)))+'</div></div>').join('');
}

/* ---------- Init ---------- */
$('#btnAdd').onclick=()=>openProductModal(null);
$('#admX').onclick=()=>{$('#admM').classList.remove('on');editId=null;photoData=null};
$('#pPhoto').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const img=new Image();img.onload=()=>{const max=480,s=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);photoData=c.toDataURL('image/jpeg',0.72);$('#pPrev').innerHTML='<img src="'+photoData+'" alt="">'};img.src=ev.target.result};r.readAsDataURL(f)};

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
    brand:$('#pBrand')?$('#pBrand').value.trim():'',
    hsn:$('#pHsn')?$('#pHsn').value.trim():'',
    reorder:+($('#pReorder')&&$('#pReorder').value)||0,
    taxInc:!!($('#pTaxInc')&&$('#pTaxInc').checked),
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
    try{await clearStore('suppliers')}catch(e){}
    try{await clearStore('coupons')}catch(e){}
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
  const status=($('#purStatus')&&$('#purStatus').value)||'received';
  const now=new Date();
  const ist=now.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
  const total=cost*qty;
  const po={productId:pid,productName:p.name,qty,cost,total,status,supplier:$('#purSupplier').value.trim(),ref:$('#purRef').value.trim(),notes:$('#purNotes').value.trim(),at:now.toISOString(),ist};
  await put('purchases',po);
  if(status==='received'){
    p.stock=(p.stock||0)+qty;
    if(cost>0)p.cost=cost;
    await put('products',p);
    await put('finance',{type:'purchase',direction:'out',amount:total,ref:po.ref||p.name,note:'PO · '+p.name+' x'+qty,at:now.toISOString(),ist});
  }
  toast(status==='received'?('PO received · stock +'+qty):'PO ordered (pending)');
  $('#purM').classList.remove('on');
  renderPurchases();refresh();
};

$$('#invFilter .chip').forEach(c=>c.onclick=()=>{
  $$('#invFilter .chip').forEach(x=>x.classList.remove('on'));
  c.classList.add('on');
  invFilter=c.dataset.f;
  renderInventory();
});

function daysLeft(exp){return Math.ceil((new Date(exp)-new Date())/864e5)}
async function renderReorder(){
  const list=(await all('products')).filter(p=>{const min=+p.minStock||0;return min>0?(+p.stock||0)<=min:(+p.stock||0)<=5});
  const box=$('#reorderList');
  if(!list.length){box.innerHTML='<div class="empty">All stocked up.</div>';return}
  box.innerHTML=list.map(p=>{
    const need=Math.max((+p.reorder||+p.minStock||10)-(+p.stock||0),0);
    return '<div class="sess-item"><div><div class="pn">'+esc(p.name)+'</div><div class="tm">Stock '+(p.stock||0)+' · Min '+(p.minStock||0)+'</div></div><div class="pn">Order '+need+'</div></div>';
  }).join('');
}
async function renderExpiring(){
  const list=(await all('products')).filter(p=>p.expiry).map(p=>({...p,d:daysLeft(p.expiry)})).filter(p=>p.d<=30).sort((a,b)=>a.d-b.d);
  const box=$('#expList');
  if(!list.length){box.innerHTML='<div class="empty">Nothing expiring soon.</div>';return}
  box.innerHTML=list.map(p=>'<div class="sess-item"><div><div class="pn">'+esc(p.name)+'</div><div class="tm">'+(p.d<0?('Expired '+Math.abs(p.d)+'d ago'):(p.d===0?'Expires today':p.d+'d left'))+'</div></div><div class="pn">'+fmt(p.price)+'</div></div>').join('');
}
async function renderSuppliers(){
  const box=$('#supList');
  if(!box)return;
  let list=await all('suppliers');
  try{const parties=(await all('parties')).filter(p=>(p.type||'')==='supplier');
    for(const p of parties){if(!list.some(s=>(s.name||'').toLowerCase()===(p.name||'').toLowerCase()))list.push({id:'p'+p.id,name:p.name,phone:p.phone,city:'',partyId:p.id})}
  }catch(e){}
  if(!list.length){box.innerHTML='<div class="empty">No suppliers yet.</div>';return}
  box.innerHTML=list.map(s=>'<div class="sess-item"><div><div class="pn">'+esc(s.name)+'</div><div class="tm">'+(s.phone?esc(s.phone):'')+(s.city?' · '+esc(s.city):'')+'</div></div></div>').join('');
}
async function renderPricelist(){
  const parties=await all('parties');
  const sel=$('#plParty');
  if(sel){const cur=sel.value;sel.innerHTML='<option value="">Default (all)</option>'+parties.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');sel.value=cur||'';if(!sel._bound){sel._bound=1;sel.onchange=()=>renderPricelist()}}
  const partyId=sel&&sel.value?+sel.value:null;
  const list=(await all('products')).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const pls=await all('pricelists');
  const box=$('#priceList');
  if(!list.length){box.innerHTML='<div class="empty">No products.</div>';return}
  box.innerHTML=list.map(p=>{
    let price=p.price||0;
    if(partyId){const pl=pls.find(x=>+x.partyId===partyId&&+x.productId===+p.id);if(pl)price=pl.price}
    return '<div class="bulk-row" data-id="'+p.id+'"><div class="bn">'+esc(p.name)+'<div style="font-size:11px;color:var(--m)">Base '+fmt(p.price||0)+'</div></div><input type="number" min="0" step="0.01" class="bulk-price" value="'+price+'"></div>';
  }).join('');
}

function shiftData(){try{return JSON.parse(localStorage.getItem('atom_shift_data')||'null')}catch(e){return null}}
async function renderShift(){
  const s=shiftData(),box=$('#shiftStats');if(!box)return;
  const open=!!(s&&s.open);
  const ist=t=>{try{return new Date(t).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true})}catch(e){return '—'}}
  const exp=(+((s&&s.openingCash)||0))+(+(s&&s.cash||0))-(+(s&&s.returns||0));
  box.innerHTML=
    '<div class="stat '+(open?'green':'')+'"><div class="lbl">Status</div><div class="val" style="font-size:16px">'+(open?'Open':'Closed')+'</div></div>'+
    '<div class="stat purple"><div class="lbl">Sales</div><div class="val" style="font-size:16px">'+fmt((s&&s.sales)||0)+'</div></div>'+
    '<div class="stat"><div class="lbl">Opening cash</div><div class="val" style="font-size:16px">'+fmt((s&&s.openingCash)||0)+'</div></div>'+
    '<div class="stat green"><div class="lbl">Cash</div><div class="val" style="font-size:16px">'+fmt((s&&s.cash)||0)+'</div></div>'+
    '<div class="stat purple"><div class="lbl">UPI</div><div class="val" style="font-size:16px">'+fmt((s&&s.upi)||0)+'</div></div>'+
    '<div class="stat"><div class="lbl">Card</div><div class="val" style="font-size:16px">'+fmt((s&&s.card)||0)+'</div></div>'+
    '<div class="stat"><div class="lbl">Other</div><div class="val" style="font-size:16px">'+fmt((s&&s.other)||0)+'</div></div>'+
    '<div class="stat red"><div class="lbl">Returns</div><div class="val" style="font-size:16px">'+fmt((s&&s.returns)||0)+'</div></div>'+
    '<div class="stat green"><div class="lbl">Expected cash</div><div class="val" style="font-size:16px">'+fmt(exp)+'</div></div>'+
    '<div class="stat"><div class="lbl">Opened</div><div class="val" style="font-size:12px">'+(s&&s.openedAt?ist(s.openedAt):'—')+'</div></div>'+
    '<div class="stat"><div class="lbl">Closed</div><div class="val" style="font-size:12px">'+(s&&s.closedAt?ist(s.closedAt):'—')+'</div></div>';
}

async function renderProductInfo(){
  const listBox=$('#piList'),det=$('#piDetail');if(!listBox)return;
  det.style.display='none';listBox.style.display='block';
  if($('#piTitle'))$('#piTitle').textContent='Product info';
  const list=(await all('products')).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  if(!list.length){listBox.innerHTML='<div class="empty">No products.</div>';return}
  listBox.innerHTML=list.map(p=>'<div class="pi-card" data-id="'+p.id+'"><div style="display:flex;justify-content:space-between;gap:10px"><div><div class="pn">'+esc(p.name)+'</div><div class="tm">'+(p.cat||'General')+' · Stock '+(p.stock||0)+'</div></div><div class="pn">'+fmt(p.price)+'</div></div></div>').join('');
  $$('#piList .pi-card').forEach(c=>c.onclick=()=>showProductInfo(+c.dataset.id));
}
async function showProductInfo(id){
  const p=await getById('products',id);if(!p)return;
  const listBox=$('#piList'),det=$('#piDetail');
  listBox.style.display='none';det.style.display='block';
  if($('#piTitle'))$('#piTitle').textContent=p.name;
  const rows=[
    ['Name',p.name],['Category',p.cat||'General'],['Brand',p.brand||'—'],['SKU',p.sku||'—'],['Barcode',p.barcode||'—'],
    ['HSN/SAC',p.hsn||'—'],['Unit',p.unit||'pcs'],['Sell price',fmt(p.price)],['Cost',fmt(p.cost||0)],
    ['Stock',String(p.stock||0)],['Min stock',String(p.minStock||0)],['Reorder qty',String(p.reorderQty||0)],
    ['Tax %',String(p.taxPct||0)],['Tax inclusive',p.taxInclusive?'Yes':'No'],['Supplier',p.supplier||'—'],
    ['Expiry',p.expiry||'—'],['Description',p.desc||p.description||'—']
  ];
  det.innerHTML=(p.photo?'<img class="thumb" src="'+p.photo+'" alt="">':'')+
    '<button type="button" class="btn" id="piBack" style="margin-bottom:12px">← Back to list</button>'+
    rows.map(r=>'<div class="row"><span>'+r[0]+'</span><b>'+esc(String(r[1]))+'</b></div>').join('');
  $('#piBack').onclick=()=>renderProductInfo();
}

async function renderSales(){
  const box=$('#salesList'),st=$('#salesStats');if(!box)return;
  $$('#salesFilter .chip').forEach(c=>c.classList.toggle('on',c.dataset.sf===salesFilter));
  if($('#salesTitle'))$('#salesTitle').textContent={today:'Today sales',all:'All sales',unpaid:'Unpaid',returns:'Returns'}[salesFilter]||'Sales';
  let txs=await all('transactions');
  const dayStart=new Date();dayStart.setHours(0,0,0,0);
  if(salesFilter==='today')txs=txs.filter(t=>t.date&&new Date(t.date)>=dayStart);
  else if(salesFilter==='unpaid')txs=txs.filter(t=>t.status==='unpaid');
  else if(salesFilter==='returns')txs=txs.filter(t=>(+t.amount||0)<0||/return/i.test(t.title||''));
  txs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  let sum=0,unpaid=0,cnt=0;
  for(const t of txs){const a=+t.amount||0;sum+=a;cnt++;if(t.status==='unpaid')unpaid+=a}
  if(st)st.innerHTML='<div class="stat green"><div class="lbl">Total</div><div class="val" style="font-size:15px">'+fmt(sum)+'</div></div><div class="stat"><div class="lbl">Bills</div><div class="val">'+cnt+'</div></div><div class="stat red"><div class="lbl">Unpaid</div><div class="val" style="font-size:15px">'+fmt(unpaid)+'</div></div>';
  if(!txs.length){box.innerHTML='<div class="empty">No sales in this view.</div>';return}
  box.innerHTML=txs.map(t=>{
    const a=+t.amount||0;
    const when=t.date?new Date(t.date).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}):'';
    return '<div class="sess-item"><div><div class="pn">'+esc(t.title||'Sale')+'</div><div class="tm">'+esc(t.subtitle||'')+' · '+when+(t.status==='unpaid'?' · Unpaid':'')+'</div></div><div class="pn" style="color:'+(a<0?'var(--r)':(t.status==='unpaid'?'var(--m)':'var(--g)'))+'">'+fmt(a)+'</div></div>';
  }).join('');
}
async function renderCustomers(){
  const box=$('#custList');if(!box)return;
  const list=(await all('parties')).filter(p=>(p.type||'customer')!=='supplier').sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  if(!list.length){box.innerHTML='<div class="empty">No customers yet. Add from here or Billing → Create party.</div>';return}
  box.innerHTML=list.map(p=>'<div class="sess-item"><div><div class="pn">'+esc(p.name)+'</div><div class="tm">'+(p.phone?esc(p.phone)+' · ':'')+'Credit '+fmt(p.credit||0)+'</div></div><button type="button" class="del" data-id="'+p.id+'" style="width:32px;height:32px;border:0;border-radius:8px;background:#fee2e2;color:var(--r)">×</button></div>').join('');
  $$('#custList .del').forEach(b=>b.onclick=async()=>{if(!(await appConfirm('Delete','Remove customer?','Delete',true)))return;await del('parties',+b.dataset.id);renderCustomers()});
}

async function renderPayLog(){
  const rows=[];
  for(const t of await all('transactions')){
    rows.push({at:t.date,ist:t.date?new Date(t.date).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'',dir:(+t.amount||0)<0?'out':'in',amount:Math.abs(+t.amount||0),note:(t.title||'Sale')+' · '+(t.subtitle||''),source:'invoice'});
  }
  for(const f of await all('finance')){
    rows.push({at:f.at,ist:f.ist||'',dir:f.direction||'out',amount:+f.amount||0,note:(f.note||f.type||'Payment')+(f.partyName?' · '+f.partyName:''),source:f.source||f.type||'misc'});
  }
  for(const p of await all('purchases')){
    const tot=+p.total||((+p.cost||0)*(+p.qty||0));
    rows.push({at:p.at,ist:p.ist||'',dir:'out',amount:tot,note:'PO · '+(p.productName||'')+' × '+(p.qty||0)+' · '+(p.status||''),source:'purchase'});
  }
  rows.sort((a,b)=>(b.at||'').localeCompare(a.at||''));
  const box=$('#payLogList');
  if(!rows.length){box.innerHTML='<div class="empty">No movements yet.</div>';return}
  box.innerHTML=rows.slice(0,200).map(r=>'<div class="sess-item"><div><div class="pn">'+(r.dir==='in'?'↓ ':'↑ ')+esc(r.note)+'</div><div class="tm">'+(r.ist||'')+' · '+r.source+'</div></div><div class="pn" style="color:'+(r.dir==='in'?'var(--g)':'var(--r)')+'">'+(r.dir==='in'?'+':'−')+fmt(r.amount)+'</div></div>').join('');
}
async function renderCoupons(){
  const list=await all('coupons');
  const box=$('#couponList');
  if(!list.length){box.innerHTML='<div class="empty">No coupons yet.</div>';return}
  box.innerHTML=list.map(c=>'<div class="sess-item"><div><div class="pn">'+esc(c.code)+'</div><div class="tm">'+(c.type==='pct'?c.value+'%':'₹'+c.value)+' off · Min ₹'+(c.min||0)+(c.active?' · Active':' · Off')+'</div></div><button type="button" class="del" data-id="'+c.id+'" style="width:32px;height:32px;border:0;border-radius:8px;background:#fee2e2;color:var(--r)">×</button></div>').join('');
  $$('#couponList .del').forEach(b=>b.onclick=async()=>{if(!(await appConfirm('Delete','Delete coupon?','Delete',true)))return;await del('coupons',+b.dataset.id);renderCoupons()});
}
function _randBc(){let s='';for(let i=0;i<12;i++)s+=Math.floor(Math.random()*10);return s}
function _stampWm(ctx,w,h){
  ctx.save();ctx.globalAlpha=.18;ctx.fillStyle='#0f172a';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  const t='ATOM POS';
  for(let y=h*0.28;y<=h*0.72;y+=16){for(let x=w*0.2;x<=w*0.8;x+=52){ctx.fillText(t,x,y)}}
  ctx.restore();
}
function _drawBc(c,code){
  const ctx=c.getContext('2d'),w=c.width,h=c.height;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
  let x=10;ctx.fillStyle='#000';
  for(let i=0;i<String(code).length;i++){const n=String(code).charCodeAt(i)%7+1;for(let b=0;b<n;b++){ctx.fillRect(x,8,1.8,h-36);x+=2.2}x+=1.6}
  _stampWm(ctx,w,h-28);
  ctx.fillStyle='#000';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText(String(code),w/2,h-18);
  ctx.font='bold 10px sans-serif';ctx.fillStyle='#0f172a';ctx.fillText('ATOM POS',w/2,h-4);
}
async function _qrBlobWm(code,size){
  size=size||200;
  try{
    const r=await fetch('https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(code));
    const blob=await r.blob();
    const bmp=await createImageBitmap(blob);
    const c=document.createElement('canvas');c.width=size;c.height=size;
    const ctx=c.getContext('2d');ctx.drawImage(bmp,0,0,size,size);
    _stampWm(ctx,size,size);
    return await new Promise(res=>c.toBlob(res,'image/png'));
  }catch(e){return null}
}
function _bcCardHTML(p,code){return '<div class="bc-card" style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin:8px 0;text-align:center;background:#fff"><div style="font-weight:700;font-size:13px;margin-bottom:8px">'+esc(p.name)+'</div><canvas width="240" height="90" style="max-width:100%;display:block;margin:0 auto"></canvas><div style="position:relative;display:inline-block;margin:10px auto"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data='+encodeURIComponent(code)+'" alt="QR" width="120" height="120" style="display:block;border-radius:6px"><div style="position:absolute;left:0;right:0;bottom:4px;text-align:center;font-size:9px;font-weight:800;color:#0f172a;background:rgba(255,255,255,.85);padding:2px 0">ATOM POS</div></div><div style="font-family:ui-monospace;font-size:12px;margin-top:4px">'+esc(code)+'</div></div>'}
function _codesOf(p){const a=String(p.barcode||'').split(/[,;|]+/).map(s=>s.trim()).filter(Boolean);if(!a.length&&p.sku)a.push(String(p.sku));return a}
async function _ensureBarcodes(){const list=await all('products');let n=0;for(const p of list){if(_codesOf(p).length)continue;p.barcode=_randBc();await put('products',p);n++}return n}
function _fillCanvases(root){root.querySelectorAll('.bc-card').forEach(card=>{const cv=card.querySelector('canvas'),code=(card.querySelector('img')||{}).src||'';const m=/data=([^&]+)/.exec(code);if(cv&&m)_drawBc(cv,decodeURIComponent(m[1]))})}
async function renderBarcodes(){
  const gen=await _ensureBarcodes(),list=await all('products'),box=$('#barcodeList');
  if(!list.length){box.innerHTML='<div class="empty">No products yet.</div>';return}
  if(gen)toast('Auto-generated '+gen+' random barcode(s)');
  box.innerHTML=list.map(p=>{const codes=_codesOf(p);return '<div class="sess-item" style="flex-wrap:wrap;gap:6px"><div style="flex:1;min-width:120px"><div class="pn">'+esc(p.name)+'</div><div class="tm" style="font-family:ui-monospace,monospace">'+esc(codes.join(', ')||'—')+(p.sku?' · SKU '+esc(p.sku):'')+'</div></div><div style="display:flex;gap:6px"><button type="button" class="btn" data-bc-view="'+p.id+'" style="padding:6px 10px;font-size:12px">View</button><button type="button" class="btn btn-g" data-bc-wa="'+p.id+'" style="padding:6px 10px;font-size:12px">WhatsApp</button></div></div>'}).join('');
  $$('[data-bc-view]').forEach(b=>b.onclick=async()=>{
    const p=(await all('products')).find(x=>+x.id===+b.dataset.bcView);if(!p)return;
    const codes=_codesOf(p),body=$('#bcViewBody');body.innerHTML='';
    codes.forEach(code=>{const d=document.createElement('div');d.innerHTML=_bcCardHTML(p,code);const card=d.firstChild;body.appendChild(card);_drawBc(card.querySelector('canvas'),code)});
    const btn=document.createElement('button');btn.type='button';btn.className='btn btn-p';btn.id='bcPrintOne';btn.style.cssText='width:100%;margin-top:8px';btn.textContent='Print';
    btn.onclick=()=>{const w=window.open('','_blank');w.document.write('<html><head><title>ATOM POS</title><style>body{font-family:sans-serif;text-align:center;padding:16px}.bc-card{page-break-inside:avoid;margin:12px auto}</style></head><body></body></html>');const b=w.document.body;body.querySelectorAll('.bc-card').forEach(c=>b.appendChild(c.cloneNode(true)));_fillCanvases(b);setTimeout(()=>w.print(),300)};
    body.appendChild(btn);$('#bcViewM').classList.add('on');
  });
  $$('[data-bc-wa]').forEach(b=>b.onclick=async()=>{
    const p=(await all('products')).find(x=>+x.id===+b.dataset.bcWa);if(!p)return;
    const code=_codesOf(p)[0]||'';const text='*ATOM POS*\n'+p.name+'\nBarcode: '+code+'\nPrice: '+fmt(p.price);
    try{
      const c=document.createElement('canvas');c.width=280;c.height=100;_drawBc(c,code);
      const bcBlob=await new Promise(r=>c.toBlob(r,'image/png'));
      const qrBlob=await _qrBlobWm(code,200);
      const files=[new File([bcBlob],'barcode-'+code+'.png',{type:'image/png'})];
      if(qrBlob)files.push(new File([qrBlob],'qr-'+code+'.png',{type:'image/png'}));
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files}))){await navigator.share({files,title:p.name,text});toast('Pick WhatsApp — images attached');return}
    }catch(e){if(e&&e.name==='AbortError')return}
    window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
  });
}
async function bulkPrintBarcodes(){
  await _ensureBarcodes();const list=await all('products');if(!list.length)return toast('No products');
  const w=window.open('','_blank');w.document.write('<html><head><title>ATOM POS Barcodes</title><style>body{font-family:sans-serif;padding:12px}.bc-card{page-break-inside:avoid;border:1px solid #ddd;border-radius:8px;padding:10px;margin:8px;display:inline-block;width:240px;text-align:center;vertical-align:top}</style></head><body><h2 style="font-size:14px;color:#64748b">ATOM POS – Barcode / QR</h2></body></html>');
  const b=w.document.body;
  list.forEach(p=>_codesOf(p).forEach(code=>{const d=document.createElement('div');d.innerHTML=_bcCardHTML(p,code);b.appendChild(d.firstChild)}));
  setTimeout(()=>{_fillCanvases(b);w.print()},500);
}


function loadPrefs(){
  try{
    const s=JSON.parse(localStorage.getItem('atom_prefs')||'{}');
    if($('#prefStore'))$('#prefStore').value=s.store||'';
    if($('#prefPhone'))$('#prefPhone').value=s.phone||'';
    if($('#prefAddr'))$('#prefAddr').value=s.addr||'';
    if($('#prefGst'))$('#prefGst').value=s.gst!=null?s.gst:'';
    if($('#prefLow'))$('#prefLow').value=s.low!=null?s.low:5;
  }catch(e){}
}
function savePrefs(){
  const s={store:($('#prefStore')?.value||'').trim(),phone:($('#prefPhone')?.value||'').trim(),addr:($('#prefAddr')?.value||'').trim(),gst:+($('#prefGst')?.value||0),low:+($('#prefLow')?.value||5)};
  localStorage.setItem('atom_prefs',JSON.stringify(s));
  toast('Preferences saved');
}

(async()=>{
  logSession('Admin');
  $('#drawerBody').innerHTML=adminMenu();
  initShell();
  const closeDr=()=>closeShell();
  const _m=$('#btnMenu'),_d=$('#dr'),_o=$('#ov');
  if(_m&&_d)_m.onclick=e=>{e.preventDefault();e.stopPropagation();if(_d.classList.contains('on'))closeShell();else{_d.classList.add('on');if(_o)_o.classList.add('on')}};
  if($('#admOverview'))$('#admOverview').onclick=()=>{closeDr();showAdminView('#viewMain');refresh()};
  if($('#admNotif'))$('#admNotif').onclick=async()=>{closeDr();const ok=await askNotify();if(ok){notify('ATOM POS','Notifications are working');toast('Test notification sent')}else toast('Allow notifications to enable alerts')};
  $$('.adm-sub button').forEach(b=>{
    b.onclick=()=>{
      const a=b.dataset.act;closeDr();
      if(a==='add-product'){openProductModal(null);showAdminView('#viewProducts')}
      else if(a==='all-products'){showAdminView('#viewProducts');refresh()}
      else if(a==='product-info')showAdminView('#viewProductInfo')
      else if(a==='low-stock'){showAdminView('#viewInventory');invFilter='low';$$('#invFilter .chip').forEach(c=>c.classList.toggle('on',c.dataset.f==='low'));renderInventory()}
      else if(a==='variants')showAdminView('#viewVariants')
      else if(a==='inventory'){showAdminView('#viewInventory');invFilter='all';$$('#invFilter .chip').forEach(c=>c.classList.toggle('on',c.dataset.f==='all'));renderInventory()}
      else if(a==='purchase')showAdminView('#viewPurchase')
      else if(a==='suppliers')showAdminView('#viewSuppliers')
      else if(a==='reorder')showAdminView('#viewReorder')
      else if(a==='expiring')showAdminView('#viewExpiring')
      else if(a==='pricelist')showAdminView('#viewPricelist')
      else if(a==='coupons')showAdminView('#viewCoupons')
      else if(a==='barcodes')showAdminView('#viewBarcodes')
      else if(a==='prefs'){showAdminView('#viewPrefs');loadPrefs()}
      else if(a==='database'){showAdminView('#viewDatabase');prewarmBackup();const b=$('#btnShare');if(b){b.textContent='Share Backup';b.disabled=false}}
      else if(a==='payment-log')showAdminView('#viewPayLog')
      else if(a==='shift')showAdminView('#viewShift')
      else if(a==='sessions')showAdminView('#viewSessions')
      else if(a==='panel')location.href='/billing'
      else if(a==='sales-today'){salesFilter='today';showAdminView('#viewSales')}
      else if(a==='sales-all'){salesFilter='all';showAdminView('#viewSales')}
      else if(a==='unpaid'){salesFilter='unpaid';showAdminView('#viewSales')}
      else if(a==='sales-returns'){salesFilter='returns';showAdminView('#viewSales')}
      else if(a==='customers')showAdminView('#viewCustomers')
    };
  });
  try{await openDB();await refresh()}catch(e){console.error(e)}
  if($('#btnSavePrefs'))$('#btnSavePrefs').onclick=savePrefs;
  if($('#btnDownload'))$('#btnDownload').onclick=doDownload;
  if($('#btnShare')){const b=$('#btnShare');b.onpointerdown=()=>prewarmBackup();b.onclick=()=>doShare()}
  if($('#btnRestore'))$('#btnRestore').onclick=()=>$('#restoreFile').click();
  if($('#restoreFile'))$('#restoreFile').onchange=e=>{const f=e.target.files[0];if(f)doRestore(f);e.target.value=''};
  if($('#btnBulkPrintBc'))$('#btnBulkPrintBc').onclick=bulkPrintBarcodes;
  if($('#bcViewX'))$('#bcViewX').onclick=()=>$('#bcViewM').classList.remove('on');
  
  if($('#pQrGallery'))$('#pQrGallery').onchange=async e=>{
    const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
    try{
      if(!('BarcodeDetector' in window)){toast('Gallery decode needs Chrome/Edge');return}
      const bmp=await createImageBitmap(f);
      const det=new BarcodeDetector({formats:['qr_code','ean_13','ean_8','code_128','code_39','upc_a','upc_e','itf']});
      const codes=await det.detect(bmp);
      if(!codes||!codes[0]||!codes[0].rawValue){toast('No QR/barcode found in image');return}
      const code=codes[0].rawValue;
      const cur=($('#pBarcode').value||'').trim();
      const parts=cur?cur.split(/[,;|]/).map(s=>s.trim()).filter(Boolean):[];
      if(!parts.includes(code))parts.push(code);
      $('#pBarcode').value=parts.join(',');
      toast('Saved from gallery: '+code);
    }catch(err){toast('Could not read image')}
  };

if($('#pScanBc'))$('#pScanBc').onclick=async()=>{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return toast('Camera not available');
    let ov=document.getElementById('admScanOv');
    if(!ov){ov=document.createElement('div');ov.id='admScanOv';ov.style.cssText='position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column';ov.innerHTML='<video id="admScanVid" playsinline muted autoplay style="flex:1;width:100%;object-fit:cover"></video><div style="padding:14px;background:#111;color:#fff;text-align:center;font-weight:600" id="admScanHint">Point at barcode / QR</div><button type="button" id="admScanClose" style="margin:0 14px 14px;padding:12px;border:0;border-radius:10px;background:#fff;font-weight:700">Close</button>';document.body.appendChild(ov)}
    ov.style.display='flex';
    const v=$('#admScanVid'),hint=$('#admScanHint');
    let stream=null,loop=1,busy=0;
    const stop=()=>{loop=0;try{if(stream)stream.getTracks().forEach(t=>t.stop())}catch(e){}ov.style.display='none';if(v)v.srcObject=null};
    $('#admScanClose').onclick=stop;
    try{
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
      v.srcObject=stream;await v.play();
      if(!('BarcodeDetector' in window)){hint.textContent='Live scan needs Chrome/Edge. Type barcode instead.';return}
      const det=new BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','upc_a','upc_e','qr_code','itf']});
      const tick=async()=>{
        if(!loop)return;
        if(!busy&&v.readyState>=2){busy=1;try{const codes=await det.detect(v);if(codes&&codes[0]&&codes[0].rawValue){const code=codes[0].rawValue;const cur=($('#pBarcode').value||'').trim();const parts=cur?cur.split(/[,;|]/).map(s=>s.trim()).filter(Boolean):[];if(!parts.includes(code))parts.push(code);$('#pBarcode').value=parts.join(',');toast('Barcode / QR saved: '+code);stop();return}}catch(e){}busy=0}
        if(loop)setTimeout(tick,120);
      };
      setTimeout(tick,200);
    }catch(e){hint.textContent='Camera blocked — allow camera permission';toast('Camera blocked')}
  };
  if($('#btnImportCsv'))$('#btnImportCsv').onclick=()=>$('#importFile').click();
  if($('#importFile'))$('#importFile').onchange=e=>{const f=e.target.files[0];if(f)doImport(f);e.target.value=''};
  if($('#btnErase2'))$('#btnErase2').onclick=()=>$('#btnErase').click();
  document.addEventListener('contextmenu',e=>e.preventDefault());

  
  if($('#btnAddSupplier'))$('#btnAddSupplier').onclick=async()=>{
    const name=prompt('Supplier name');if(!name)return;
    const phone=prompt('Phone','')||'';const city=prompt('City','')||'';
    await put('suppliers',{name:name.trim(),phone,city});await put('parties',{name:name.trim(),phone,type:'supplier',credit:0});toast('Supplier added');renderSuppliers();
  };
  if($('#btnAddCoupon'))$('#btnAddCoupon').onclick=async()=>{
    const code=(prompt('Coupon code')||'').trim().toUpperCase();if(!code)return;
    const type=(prompt('Type: pct or flat','pct')||'pct').toLowerCase();
    const value=+prompt('Value','10')||0;const min=+prompt('Min order ₹','0')||0;
    await put('coupons',{code,type:type==='flat'?'flat':'pct',value,min,active:true});toast('Coupon saved');renderCoupons();
  };
  if($('#btnPriceSave'))$('#btnPriceSave').onclick=async()=>{
    const partyId=$('#plParty')&&$('#plParty').value?+$('#plParty').value:null;let n=0;
    for(const row of $$('#priceList .bulk-row')){
      const id=+row.dataset.id,val=+(row.querySelector('.bulk-price')||{}).value;
      if(!(id>0)||isNaN(val))continue;
      if(partyId){
        const allp=await all('pricelists');const ex=allp.find(x=>+x.partyId===partyId&&+x.productId===id);
        if(ex){ex.price=val;await put('pricelists',ex)}else await put('pricelists',{partyId,productId:id,price:val});
      }else{const pr=await getById('products',id);if(!pr)continue;pr.price=Math.max(0,val);await put('products',pr)}
      n++;
    }toast('Updated '+n+' prices');renderPricelist();refresh();
  };

  if($('#btnShiftOpen'))$('#btnShiftOpen').onclick=async()=>{const v=await appPrompt('Open shift','Opening cash in drawer (₹)','0');if(v===null)return;localStorage.setItem('atom_shift_data',JSON.stringify({open:true,openedAt:new Date().toISOString(),openingCash:+v||0,sales:0,cash:0,upi:0,card:0,other:0,returns:0}));localStorage.setItem('atom_shift','1');toast('Shift opened');renderShift()};
  if($('#btnShiftClose'))$('#btnShiftClose').onclick=()=>{const s=shiftData()||{};s.open=false;s.closedAt=new Date().toISOString();localStorage.setItem('atom_shift_data',JSON.stringify(s));localStorage.setItem('atom_shift','0');toast('Shift closed');renderShift()};
  if($('#btnBulkSave'))$('#btnBulkSave').onclick=async()=>{
    const rows=$$('#invList .bulk-row');
    if(!rows.length)return toast('Nothing to save');
    let n=0;
    for(const row of rows){
      const id=+row.dataset.id;
      const val=+(row.querySelector('.bulk-stock')||{}).value;
      if(!(id>0)||isNaN(val))continue;
      const p=await getById('products',id);
      if(!p)continue;
      p.stock=Math.max(0,val);
      await put('products',p);n++;
    }
    toast('Updated '+n+' products');
    renderInventory();refresh();
  };
})();