const $=s=>document.querySelector(s);
let S,view='sell',q='',sq='',cart=[],NF=null,tt,wt,kt,me=null,cerr='';
const fmt=n=>'KSh '+Math.round(n).toLocaleString('en-US');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const it=id=>S.items.find(i=>i.id==id);
const same=t=>new Date(t).toDateString()==new Date().toDateString();
const nz=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const mt=(t,s)=>{const w=String(t).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),h=nz(s);return w.every(x=>h.includes(x))};
const DB={open(){return new Promise((res,rej)=>{const r=indexedDB.open('shoptill',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
async get(k){const db=await this.open();return new Promise((res,rej)=>{const g=db.transaction('kv').objectStore('kv').get(k);g.onsuccess=()=>res(g.result);g.onerror=()=>rej(g.error)})},
async set(k,v){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}};
const blank=()=>({shop:'',setup:false,items:[],sales:[],nid:1,lastBackup:0,ob:[],dirty:false,rev:0});
const uid=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c=='x'?r:r&3|8).toString(16)});
function obPut(k,row){S.ob=(S.ob||[]).filter(o=>!(o.k==k&&o.u==row.u));S.ob.push({k,op:'put',u:row.u,row})}
function obDel(k,u){S.ob=(S.ob||[]).filter(o=>!(o.k==k&&o.u==u));S.ob.push({k,op:'del',u})}
const saleRow=x=>({u:x.u,t:x.t,m:x.m,total:x.total,profit:x.profit,lines:x.lines});
function sell(l,m){let total=0,profit=0;const lines=l.map(([id,n])=>{const i=it(id);i.s-=n;total+=n*i.p;profit+=n*(i.p-i.k);return{id,q:n,p:i.p,k:i.k}});const sa={u:uid(),t:Date.now(),m,lines,total,profit};S.sales.push(sa);obPut('sales',saleRow(sa));return total}
async function load(){let ses=null;try{ses=await Sync.session()}catch(e){}
if(ses&&ses.role=='viewer'){try{S=await DB.get('view')}catch(e){}if(!S||!S.items)S=Object.assign(blank(),{setup:true});S.viewer=true;view='rpt';return}
try{S=await DB.get('state')}catch(e){}if(!S||!S.items)S=blank();S.ob=S.ob||[];try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}}
function flush(){clearTimeout(wt);return DB.set(S.viewer?'view':'state',JSON.parse(JSON.stringify(S))).catch(()=>toast('Could not save on this device. Download a backup now.'))}
function save(){S.dirty=true;S.rev=(S.rev||0)+1;clearTimeout(wt);wt=setTimeout(flush,150);clearTimeout(kt);kt=setTimeout(syncNow,3000)}
async function syncNow(){const r=await Sync.push();chip();return r}
function chipState(){if(!navigator.onLine)return{t:'Offline: saved on this device',c:'off'};if(!Sync.configured())return{t:'Online',c:''};const tm=x=>new Date(x).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
if(!me)return{t:'Online: not signed in to the cloud',c:'off'};if(S.viewer)return{t:S.pulledAt?'Updated '+tm(S.pulledAt):'Not loaded yet',c:''};
const n=(S.ob||[]).length+(S.dirty?1:0);if(S.lock)return{t:'Cloud already has data: open Settings',c:'off'};if(S.syncErr)return{t:'Cloud sync problem',c:'off'};if(n)return{t:'Waiting to sync ('+n+')',c:'off'};return{t:'Synced '+tm(S.syncAt||Date.now()),c:''}}
function chip(){const e=$('#sy');if(!e)return;const s=chipState();e.textContent=s.t;e.className='sync '+s.c}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2400)}
function nav(){const t=S.viewer?[['rpt','Reports'],['stock','Stock'],['set','Account']]:[['sell','Sell'],['stock','Stock'],['rpt','Reports'],['set','Settings']],s=chipState();
return`<header><b class="brand">${esc(S.shop||'ShopTill')}</b><nav>${t.map(([v,n])=>`<button class="${view==v?'on':''}" data-a="nav" data-v="${v}">${n}</button>`).join('')}</nav><span id="sy" class="sync ${s.c}">${s.t}</span></header>`}
function vSetup(){return`<main><div class="pnl" style="max-width:520px;margin:40px auto"><h1>Set up your shop</h1><div><label for="sn">Shop name</label><input id="sn" placeholder="Your shop name"></div><button class="sold" data-a="start" data-v="empty">Start</button><p class="mut">Add items one by one in Stock, or import a list from Excel in Settings.</p></div></main>`}
function ranked(){const c={};S.sales.forEach(s=>s.lines.forEach(l=>c[l.id]=(c[l.id]||0)+l.q));return[...S.items].sort((a,b)=>(c[b.id]||0)-(c[a.id]||0))}
function found(){return q?S.items.filter(i=>mt(q,i.n+i.v+(i.al||''))):ranked().slice(0,12)}
function vSell(){const f=found(),tot=cart.reduce((a,l)=>a+l.q*it(l.id).p,0),ls=S.sales[S.sales.length-1],last=ls&&same(ls.t)?ls:null;
return`<div class="sell"><section><input id="q" aria-label="Search items" placeholder="Type an item name, then press Enter" value="${esc(q)}">
<div class="sub">${q?'Results':'Quick sale: your best sellers'}</div>
<div class="grid">${f.map(i=>`<button class="card" data-a="add" data-v="${i.id}" ${i.s<1?'disabled':''}><b>${esc(i.n)}</b><span class="mut">${esc(i.v)}</span><span class="sp"></span><span class="pr"><b>${fmt(i.p)}</b>${i.s<1?'<span class="tag bad">Sold out</span>':i.s<=i.m?`<span class="tag">${i.s} left</span>`:`${i.s} in stock`}</span></button>`).join('')||(S.items.length?'<p class="mut">No item matches. Check the spelling or add it in Stock.</p>':'<p class="mut">No items yet. Open Stock and add your first item.</p>')}</div></section>
<aside class="cart"><div class="row"><h2>Current sale</h2><button class="lnk" data-a="clear">Clear</button></div>
${cart.map(l=>{const i=it(l.id);return`<div class="ln"><span>${esc(i.n)}<small>${fmt(i.p)} each</small></span><span class="qty"><button aria-label="Less" data-a="dec" data-v="${l.id}">-</button>${l.q}<button aria-label="More" data-a="add" data-v="${l.id}">+</button></span><b>${fmt(l.q*i.p)}</b></div>`}).join('')||'<p class="mut">Tap an item to start a sale.</p>'}
<div class="tot"><span class="mut">Total</span><b>${fmt(tot)}</b></div>
<div class="fin"><button class="sold" data-a="fin" data-v="Cash" ${cart.length?'':'disabled'}>Sold: Cash</button><button class="sold alt" data-a="fin" data-v="Pochi" ${cart.length?'':'disabled'}>Sold: Pochi</button></div>
${last?`<button class="lnk" data-a="undo">Undo last sale (${fmt(last.total)})</button>`:''}</aside></div>`}
function vStock(){if(S.viewer)return vStockRO();const t=sq.trim(),its=t?S.items.filter(i=>mt(t,i.n+' '+i.v+' '+(i.al||''))):[],cats=[...new Set(S.items.map(i=>i.c))],nf=NF||{n:t,v:'',c:'',k:'',p:'',m:''};
return`<h1>Stock</h1><div class="pnl"><h2>Add stock or a new item</h2>
<input id="sq" aria-label="Search stock" placeholder="Type an item name to add stock or create a new item" value="${esc(sq)}">
${S.items.length?'':'<p class="mut">No items yet. Type a name above, then fill in the form that appears.</p>'}
${its.slice(0,10).map(i=>`<div class="pnl" style="padding:12px"><b>${esc(i.n)}</b><span class="mut">${esc(i.v)}. In stock: ${i.s}</span>
<div class="frm"><div><label for="rq${i.id}">Quantity to add</label><input id="rq${i.id}" type="number" min="1"></div>
<div><label for="rk${i.id}">New buying price</label><input id="rk${i.id}" type="number" min="0" placeholder="same as before"></div>
<button class="btn" data-a="restock" data-v="${i.id}">Add stock</button><button class="btn" data-a="clone" data-v="${i.id}" style="background:none;border:1px solid var(--line);color:var(--ink)">Add another type</button></div></div>`).join('')}
${t||NF?`<div class="pnl" style="padding:12px"><b>${NF?'New type of '+esc(NF.n):'Not found? Create "'+esc(t)+'"'}</b><span class="mut">Fill this once. Next time you only enter the quantity.</span><div class="frm">
<div><label for="nn">Name</label><input id="nn" value="${esc(nf.n)}"></div>
<div><label for="nv">Description (write it your way)</label><input id="nv" value="${esc(nf.v)}" placeholder="Type, size, model, colour or quality"></div>
<div><label for="nc">Category</label><input id="nc" list="cats" value="${esc(nf.c)}" placeholder="Group for similar items"><datalist id="cats">${cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div>
<div><label for="nk">Buying price</label><input id="nk" type="number" min="0" value="${esc(nf.k)}"></div><div><label for="np">Selling price</label><input id="np" type="number" min="0" value="${esc(nf.p)}"></div>
<div><label for="ns">Quantity</label><input id="ns" type="number" min="0"></div><div><label for="nm">Minimum stock</label><input id="nm" type="number" min="0" value="${esc(nf.m)}"></div>
<button class="btn" data-a="newitem">Create item</button></div></div>`:''}</div>
<div class="pnl" style="margin-top:16px"><h2>All stock (${S.items.length} items)</h2><div class="scroll"><table><tr><th>Item</th><th>In stock</th><th>Buying price</th><th>Selling price</th><th>Profit each</th><th>Minimum</th></tr>
${[...S.items].sort((a,b)=>a.n.localeCompare(b.n)||a.v.localeCompare(b.v)).map(i=>`<tr><td><b>${esc(i.n)}</b><br><span class="mut">${esc(i.v)}</span></td><td>${i.s}</td>
<td><input type="number" min="0" aria-label="Buying price" data-f="k" data-id="${i.id}" value="${i.k}"></td>
<td><input type="number" min="0" aria-label="Selling price" data-f="p" data-id="${i.id}" value="${i.p}"></td>
<td>${fmt(i.p-i.k)}</td>
<td><input type="number" min="0" aria-label="Minimum stock" data-f="m" data-id="${i.id}" value="${i.m}"></td></tr>`).join('')}</table></div></div>`}
function vSet(){const lb=S.lastBackup?new Date(S.lastBackup).toLocaleDateString():'never';
if(S.viewer)return'<h1>Account</h1><div class="cols">'+cloudPanel()+'</div>';return`<h1>Settings</h1><div class="cols">${cloudPanel()}<div class="pnl"><h2>Shop</h2><div><label for="shn">Shop name</label><input id="shn" data-s="shop" value="${esc(S.shop)}"></div></div>
<div class="pnl"><h2>Backup</h2><span class="mut">Last backup: ${lb}. Until cloud sync is added, this is your safety copy. Download one every week and keep it on a flash disk or email it to yourself.</span><button class="btn" data-a="export">Download backup</button><div><label for="rf">Restore from a backup file</label><input id="rf" type="file" accept=".json"></div></div>
<div class="pnl"><h2>Import items from Excel</h2><span class="mut">Save your sheet as CSV with these columns: name, description, category, buying, selling, quantity, minimum.</span><button class="btn" data-a="tpl">Download template</button><div><label for="cf">Choose your CSV file</label><input id="cf" type="file" accept=".csv"></div></div>
<div class="pnl"><h2>Start over</h2><span class="mut">Type DELETE to erase all items and sales on this device.</span><input id="del" aria-label="Type DELETE"><button class="btn" data-a="wipe" style="background:var(--bad);color:#fff">Erase everything</button></div></div>`}
function nag(){if(S.viewer)return'';if(!S.sales.length)return'';const d=S.lastBackup?Math.floor((Date.now()-S.lastBackup)/864e5):null;if(d!==null&&d<7)return'';return`<div class="pnl" style="margin-bottom:16px;background:var(--warnbg);color:var(--warn)"><b>${d===null?'No backup yet.':'Last backup was '+d+' days ago.'}</b> Open Settings and tap Download backup.</div>`}
function parseCSV(t){const rows=[];let r=[],c='',q=false;for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=ch}else if(ch=='"')q=true;else if(ch==','||ch==';'){r.push(c);c=''}else if(ch=='\n'||ch=='\r'){if(ch=='\r'&&t[i+1]=='\n')i++;r.push(c);rows.push(r);r=[];c=''}else c+=ch}
if(c!==''||r.length){r.push(c);rows.push(r)}return rows.filter(r=>r.some(x=>x.trim()!==''))}
function importCSV(text){const rows=parseCSV(text.replace(/^\uFEFF/,''));if(rows.length&&/^name$/i.test(rows[0][0].trim()))rows.shift();let add=0,upd=0,bad=0;
rows.forEach(r=>{const[n,v='',c='',k='',p='',s='',m='']=r.map(x=>x.trim());if(!n){bad++;return}const i=S.items.find(x=>nz(x.n)==nz(n)&&nz(x.v)==nz(v));
if(i){restock(i,+s||0,k);if(p!=='')i.p=+p;upd++}else if(k!==''&&p!==''&&!isNaN(+k)&&!isNaN(+p)){S.items.push({id:S.nid++,n,v,c:c||'Other',al:'',k:+k,p:+p,s:+s||0,m:+m||0});add++}else bad++});
save();return{add,upd,bad}}
function download(name,text,type){try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/plain'}));a.download=name;document.body.appendChild(a);a.click();a.remove()}catch(e){toast('Download is not supported here')}}
function vRpt(){const ts=S.sales.filter(s=>same(s.t));
const cash=ts.filter(s=>s.m=='Cash').reduce((a,s)=>a+s.total,0),poc=ts.filter(s=>s.m=='Pochi').reduce((a,s)=>a+s.total,0);
const prof=ts.reduce((a,s)=>a+s.profit,0);
const sold=ts.reduce((a,s)=>a+s.lines.reduce((b,l)=>b+l.q,0),0);
const low=S.items.filter(i=>i.s<=i.m).map(i=>({i,b:Math.max(i.m*2-i.s,1)}));
const wk={};S.sales.filter(s=>Date.now()-s.t<6048e5).forEach(s=>s.lines.forEach(l=>wk[l.id]=(wk[l.id]||0)+l.q));
const tp=Object.entries(wk).sort((a,b)=>b[1]-a[1]).slice(0,5),mx=tp.length?tp[0][1]:1;
return`<h1>Today</h1>${nag()}<div class="kpis">
<div class="kpi"><span>Item sales</span><b>${fmt(cash+poc)}</b><span>Cash ${fmt(cash)} / Pochi ${fmt(poc)}</span></div>
<div class="kpi"><span>Gross profit</span><b>${fmt(prof)}</b><span>Before expenses</span></div>
<div class="kpi"><span>Items sold</span><b>${sold}</b><span>${S.items.filter(i=>i.s<1).length} sold out now</span></div></div>
<div class="cols"><div class="pnl"><h2>Restock this week</h2><div class="scroll"><table><tr><th>Item</th><th>Left</th><th>Min</th><th>Buy</th></tr>
${low.map(({i,b})=>`<tr><td>${esc(i.n)}</td><td><b style="color:var(--${i.s<1?'bad':'warn'})">${i.s}</b></td><td>${i.m}</td><td><b>${b}</b></td></tr>`).join('')||'<tr><td colspan="4" class="mut">Nothing to restock.</td></tr>'}</table></div>
<div class="row tot"><span class="mut">Estimated restock cost</span><b style="font-size:18px">${fmt(low.reduce((a,{i,b})=>a+b*i.k,0))}</b></div></div>
<div class="pnl"><h2>Best sellers this week</h2>${tp.map(([id,n])=>`<div>${esc(it(id).n)} <span class="mut">(${n})</span><div class="bar"><i style="width:${n/mx*100}%"></i></div></div>`).join('')||'<p class="mut">No sales yet.</p>'}</div>
<div class="pnl"><h2>Stock worth</h2><div class="row"><span class="mut">At buying price</span><b>${fmt(S.items.reduce((a,i)=>a+i.s*i.k,0))}</b></div><div class="row"><span class="mut">At selling price</span><b>${fmt(S.items.reduce((a,i)=>a+i.s*i.p,0))}</b></div></div></div>`}
function restock(i,n,k){if(k!==''&&+k>=0&&+k!=i.k){const s=Math.max(i.s,0);i.k=Math.round((s*i.k+n*+k)/(s+n))}i.s+=n}
function render(){if(S.viewer&&!['rpt','stock','set'].includes(view))view='rpt';if(!S.setup){$('#app').innerHTML=vSetup();return}$('#app').innerHTML=nav()+'<main>'+({sell:vSell,stock:vStock,rpt:vRpt,set:vSet}[view])()+'</main>'}
function addItem(v){const i=it(v),l=cart.find(l=>l.id==v);if(l){if(l.q<i.s)l.q++}else if(i.s>0)cart.push({id:+v,q:1})}
function act(a,v){
if(a=='nav'){view=v}
else if(a=='start'){S.shop=$('#sn').value.trim();S.setup=true;save()}
else if(a=='add'){addItem(v)}
else if(a=='dec'){const l=cart.find(l=>l.id==v);if(l&&--l.q<1)cart=cart.filter(x=>x!==l)}
else if(a=='clear'){cart=[]}
else if(a=='fin'){if(!cart.length)return;const t=sell(cart.map(l=>[l.id,l.q]),v);save();toast('Sold '+fmt(t)+' ('+v+')');cart=[];q=''}
else if(a=='undo'){const s=S.sales.pop();if(s.u)obDel('sales',s.u);s.lines.forEach(l=>it(l.id).s+=l.q);save();toast('Last sale undone: '+fmt(s.total))}
else if(a=='restock'){const i=it(v),n=+$('#rq'+v).value;if(!(n>0)){toast('Enter how many you are adding');return}restock(i,n,$('#rk'+v).value);save();toast('Added '+n+' to '+i.n+'. Now '+i.s)}
else if(a=='clone'){const i=it(v);NF={n:i.n,v:'',c:i.c,k:i.k,p:i.p,m:i.m};sq='';setTimeout(()=>{const n=$('#nv');if(n)n.focus()},0)}
else if(a=='newitem'){const g=x=>$('#'+x).value.trim();if(!g('nn')){toast('Enter an item name');return}
if(S.items.some(i=>nz(i.n)==nz(g('nn'))&&nz(i.v)==nz(g('nv')))){toast('That item already exists. Use Add stock above.');return}
if(g('nk')===''||g('np')===''){toast('Enter the buying and selling price');return}
S.items.push({id:S.nid++,n:g('nn'),v:g('nv'),c:g('nc')||'Other',al:'',k:+g('nk'),p:+g('np'),s:+g('ns')||0,m:+g('nm')||0});save();toast('Item created: '+g('nn')+(g('nv')?' ('+g('nv')+')':''));NF=null;sq=''}
else if(a=='export'){S.lastBackup=Date.now();save();download('shop-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(S),'application/json');toast('Backup downloaded')}
else if(a=='tpl'){download('items-template.csv','name,description,category,buying,selling,quantity,minimum\nExample item,Size or type,Category,100,150,10,2\n','text/csv')}
else if(a=='signin'){signIn();return}
else if(a=='signout'){signOut();return}
else if(a=='syncnow'){doSync();return}
else if(a=='cloudrestore'){restoreCloud();return}
else if(a=='cloudreplace'){if($('#rp2').value!='REPLACE'){toast('Type REPLACE first');return}S.lock=null;S.sales.forEach(x=>obPut('sales',saleRow(x)));S.dirty=true;S.rev=(S.rev||0)+1;save();toast('This device is now the master copy. Uploading...')}
else if(a=='wipe'){if($('#del').value!='DELETE'){toast('Type DELETE first');return}S=blank();cart=[];q='';sq='';NF=null;flush();toast('Everything erased')}
render()}
function keep(id,val){const n=$('#'+id);if(n){n.focus();n.setSelectionRange(val.length,val.length)}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(b)act(b.dataset.a,b.dataset.v)});
document.addEventListener('input',e=>{const t=e.target;
if(t.id=='q'){q=t.value;render();keep('q',q)}
else if(t.id=='sq'){sq=t.value;render();keep('sq',sq)}
else if(t.dataset.s){S[t.dataset.s]=t.value;save()}});
document.addEventListener('change',e=>{const t=e.target;
if(t.dataset.f){it(t.dataset.id)[t.dataset.f]=+t.value||0;save();toast('Saved');render()}
else if(t.dataset.s){render()}
else if(t.id=='cf'&&t.files[0]){const f=new FileReader();f.onload=()=>{const r=importCSV(String(f.result));toast('Imported '+r.add+' new, updated '+r.upd+(r.bad?', skipped '+r.bad:''));render()};f.readAsText(t.files[0])}
else if(t.id=='rf'&&t.files[0]){const f=new FileReader();f.onload=()=>{try{const o=JSON.parse(String(f.result));if(!Array.isArray(o.items))throw 0;S=o;S.setup=true;flush();toast('Backup restored');render()}catch(x){toast('That file is not a ShopTill backup')}};f.readAsText(t.files[0])}});
document.addEventListener('keydown',e=>{if(e.target.id=='q'&&e.key=='Enter'){const f=find();if(f.length==1&&f[0].s>0){addItem(f[0].id);q='';render();keep('q','')}else toast(f.length?'Tap the item you want':'No item matches')}});
window.addEventListener('online',()=>{if(S){render();doSync()}});window.addEventListener('offline',()=>S&&render());
window.addEventListener('pagehide',()=>S&&flush());document.addEventListener('visibilitychange',()=>{if(document.hidden&&S)flush()});
(async()=>{await load();me=await Sync.session().catch(()=>null);if(me&&me.role=='viewer'&&navigator.onLine){try{await refreshView()}catch(e){}}else if(me)syncNow();render();setInterval(()=>{if(document.hidden||!me||!navigator.onLine)return;if(me.role=='viewer')refreshView().then(()=>{if(view=='rpt')render();chip()}).catch(()=>{});else syncNow()},60000);if('serviceWorker'in navigator&&(location.protocol=='https:'||location.hostname=='localhost'))navigator.serviceWorker.register('sw.js').catch(()=>{})})();

function vStockRO(){return`<h1>Stock</h1><div class="pnl"><div class="scroll"><table><tr><th>Item</th><th>In stock</th><th>Buying price</th><th>Selling price</th><th>Profit each</th><th>Minimum</th></tr>
${[...S.items].sort((a,b)=>a.n.localeCompare(b.n)||a.v.localeCompare(b.v)).map(i=>`<tr><td><b>${esc(i.n)}</b><br><span class="mut">${esc(i.v)}</span></td><td>${i.s<=i.m?`<span class="tag${i.s<1?' bad':''}">${i.s}</span>`:i.s}</td><td>${fmt(i.k)}</td><td>${fmt(i.p)}</td><td>${fmt(i.p-i.k)}</td><td>${i.m}</td></tr>`).join('')||'<tr><td colspan="6" class="mut">No items yet.</td></tr>'}</table></div></div>`}
function cloudPanel(){const bt='style="background:none;border:1px solid var(--line);color:var(--ink)"';
if(!Sync.configured())return`<div class="pnl"><h2>Cloud sync</h2><span class="mut">Not set up yet. See the README, section "Cloud sync". The app works fully without it.</span></div>`;
const er=cerr?`<span style="color:var(--bad)">${esc(cerr)}</span>`:'';
if(!me)return`<div class="pnl"><h2>Cloud sync</h2><span class="mut">Sign in to back up this shop to the cloud and see reports on a phone.</span><div><label for="ce">Email</label><input id="ce" type="email" autocomplete="username"></div><div><label for="cp">Password</label><input id="cp" type="password" autocomplete="current-password"></div>${er}<button class="btn" data-a="signin">Sign in</button></div>`;
const n=(S.ob||[]).length+(S.dirty?1:0);
const lk=S.lock=='restore'?'<b style="color:var(--warn)">This shop already has data in the cloud. Type RESTORE below to copy it onto this device. Nothing is uploaded until you decide.</b>':S.lock=='choose'?'<b style="color:var(--warn)">The cloud already has data and so does this device. Nothing is uploaded until you decide: restore from the cloud (replaces this device), or type REPLACE here to use this device\'s items instead.</b><div><label for="rp2">Type REPLACE</label><input id="rp2"></div><button class="btn" data-a="cloudreplace">Use this device\'s data</button>':'';
return`<div class="pnl"><h2>Cloud sync</h2>${lk}<span class="mut">Signed in as ${esc(me.email)} (${me.role=='owner'?'owner: this device saves to the cloud':'viewer: this device only reads'}).</span>${S.viewer?`<span class="mut">Last update: ${S.pulledAt?new Date(S.pulledAt).toLocaleString():'never'}</span>`:`<span class="mut">Last sync: ${S.syncAt?new Date(S.syncAt).toLocaleString():'never'}. Waiting to upload: ${n}.</span>`}${S.syncErr&&!S.viewer?`<span style="color:var(--bad)">${esc(S.syncErr)}</span>`:''}${er}<button class="btn" data-a="syncnow">${S.viewer?'Refresh now':'Sync now'}</button>${me.role=='owner'?`<div><label for="rs">To copy the cloud data onto this device, type RESTORE</label><input id="rs"></div><button class="btn" data-a="cloudrestore" ${bt}>Restore from cloud</button>`:''}<button class="btn" data-a="signout" ${bt}>Sign out</button></div>`}
const netErr=x=>x.message=='Failed to fetch'||x.name=='TypeError'?'No internet connection':x.message;
async function refreshView(){const o=await Sync.pull(35);S=Object.assign(o,{viewer:true});me=await Sync.session();await flush()}
async function signIn(){cerr='';const e=$('#ce').value.trim(),p=$('#cp').value;if(!e||!p){cerr='Enter your email and password';render();return}
try{me=await Sync.login(e,p);
if(me.role=='viewer'){S=Object.assign(blank(),{setup:true,viewer:true});await refreshView();view='rpt'}
else{S.viewer=false;S.ob=S.ob||[];S.sales.filter(x=>!x.u).forEach(x=>{x.u=uid();obPut('sales',saleRow(x))});const inf=await Sync.info(),empty=!S.items.length&&!S.sales.length;S.lock=(inf.has&&S.cloudShop!==me.shop)?(empty?'restore':'choose'):null;if(!S.lock){S.dirty=true;S.rev=(S.rev||0)+1}await flush();if(!S.lock)syncNow()}}
catch(x){cerr=netErr(x);me=null}
render()}
async function signOut(){await Sync.logout();me=null;cerr='';if(S.viewer){S=null;try{S=await DB.get('state')}catch(e){}if(!S||!S.items)S=blank();S.ob=S.ob||[];view='sell'}render()}
async function doSync(){cerr='';try{if(!me)return;if(S.viewer)await refreshView();else{const r=await Sync.push();if(r.err)cerr=r.err}}catch(x){cerr=netErr(x)}chip();render()}
async function restoreCloud(){if($('#rs').value!='RESTORE'){toast('Type RESTORE first');return}
try{const o=await Sync.pull(0);S=Object.assign(o,{viewer:false,ob:[],dirty:false,rev:0,lock:null,cloudShop:me.shop,syncAt:Date.now(),lastBackup:S.lastBackup||0});await flush();toast('Copied from the cloud: '+S.items.length+' items, '+S.sales.length+' sales')}catch(x){cerr=netErr(x)}render()}
