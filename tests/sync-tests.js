const {JSDOM}=require('jsdom');const path=require('path');const {IDBFactory}=require('fake-indexeddb');
const mock=process.env.BACKEND=='real'?require('./real-backend'):require('./mock-supabase');const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(idb,cfg){const errs=[];const dom=await JSDOM.fromFile(path.join(ROOT,'index.html'),{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,beforeParse(w){w.indexedDB=idb;w.fetch=globalThis.fetch.bind(globalThis);w.addEventListener('error',e=>errs.push(e.message));w.URL.createObjectURL=()=>'blob:x'}});
const w=dom.window,D=w.document;for(let i=0;i<60&&!D.querySelector('#app').innerHTML;i++)await sleep(20);
if(cfg){w.SHOPTILL_CLOUD=cfg;w.eval('render()')}
const $=s=>D.querySelector(s);
const T={w,D,$,errs,S:()=>w.eval('S'),
click:(a,v)=>{const e=D.querySelector(v===undefined?`[data-a="${a}"]`:`[data-a="${a}"][data-v="${v}"]`);if(!e)throw new Error('no button '+a);e.click()},
typ:(s,v)=>{const e=$(s);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}))},set:(s,v)=>{$(s).value=v},
until:async(f,ms=3000)=>{for(let t=0;t<ms/25;t++){if(f())return true;await sleep(25)}return false},
sync:()=>w.eval('syncNow()'),text:()=>D.body.textContent,
signin:async(e,p)=>{T.click('nav','set');w.eval("cerr='';render()");T.set('#ce',e);T.set('#cp',p);T.click('signin');await T.until(()=>!w.eval('!!document.querySelector("#ce")')||/Invalid|not linked|connection/.test(D.body.textContent))}};return T}
(async()=>{
const M=await mock();const cfg={url:M.url,anon:M.anon};
// not configured
let idbA=new IDBFactory();let A=await boot(idbA);
A.set('#sn','Kamau Electronics');A.click('start','empty');A.click('nav','set');
ok(/Not set up yet/.test(A.text()),'without config the app says cloud is not set up and still works');
A.w.SHOPTILL_CLOUD=cfg;A.w.eval('render()');
// items + sign-in
A.click('nav','stock');A.typ('#sq','charger');A.set('#nv','20W USB-C');A.set('#nk','480');A.set('#np','800');A.set('#ns','12');A.set('#nm','4');A.click('newitem');
A.w.eval("S.sales.push({t:Date.now()-86400000,m:'Cash',lines:[],total:500,profit:200})");
await A.signin('owner@shop.test','wrong');
ok(/Invalid login credentials/.test(A.text()),'wrong password shows a clear message');
await A.signin('stray@shop.test','straypass');
ok(/not linked to a shop/.test(A.text()),'account without a shop is refused clearly');
await A.signin('owner@shop.test','ownerpass');
ok(await A.until(()=>M.db.shop_data[M.shop]),'owner sign-in uploads items to the cloud');
ok(await A.until(()=>M.db.sales.length==1),'old local sales (no ids) are migrated to the cloud');
ok(M.db.shop_data[M.shop].data.items.length==1&&M.db.shop_data[M.shop].data.shop=='Kamau Electronics','cloud has items and shop name');
ok(await A.until(()=>/Synced/.test(A.$('#sy').textContent)),'status chip says Synced: '+A.$('#sy').textContent);
// sale
A.click('nav','sell');A.D.querySelector('.card').click();A.D.querySelector('.card').click();A.click('fin','Cash');
await A.sync();let s=M.db.sales.find(x=>x.t>Date.now()-60000);
ok(s&&s.total==1600&&s.profit==640&&s.m=='Cash'&&s.lines[0].q==2,'a sale reaches the cloud with total, profit and lines');
ok(A.S().ob.length==0,'outbox empty after sync');
await A.sync();await A.sync();ok(M.db.sales.length==2,'syncing again creates no duplicates');
// undo
A.click('undo');await A.sync();ok(M.db.sales.length==1,'undo removes the sale from the cloud');
// price edit
A.click('nav','stock');const pe=A.$('[data-f="p"]');pe.value='900';pe.dispatchEvent(new A.w.Event('change',{bubbles:true}));await A.sync();
ok(M.db.shop_data[M.shop].data.items[0].p==900,'price edit reaches the cloud');
// offline
Object.defineProperty(A.w.navigator,'onLine',{value:false,configurable:true});A.w.dispatchEvent(new A.w.Event('offline'));
A.click('nav','sell');A.D.querySelector('.card').click();A.click('fin','Pochi');
const r0=await A.sync();ok(r0.skip&&A.S().ob.length==1,'offline: sale waits in the outbox');
ok(/Offline/.test(A.$('#sy').textContent),'chip shows Offline');
Object.defineProperty(A.w.navigator,'onLine',{value:true,configurable:true});A.w.dispatchEvent(new A.w.Event('online'));
ok(await A.until(()=>M.db.sales.length==2),'back online: waiting sale uploads by itself');
// server failure
M.fail(1);A.click('nav','sell');A.D.querySelector('.card').click();A.click('fin','Cash');
const r1=await A.sync();ok(r1.err&&A.S().ob.length>0,'server error keeps the sale queued: '+r1.err);
const before=M.db.sales.length;const r2=await A.sync();ok(r2.ok&&A.S().ob.length==0&&M.db.sales.length==before+1,'retry succeeds with no duplicates');
// token expiry
A.w.eval('Sync._expire()');const rf=M.stats.refresh;A.click('nav','sell');A.D.querySelector('.card').click();A.click('fin','Cash');await A.sync();
ok(M.stats.refresh==rf+1&&M.db.sales.length==before+2,'expired login is refreshed automatically');
// batches
A.w.eval("for(let i=0;i<250;i++){const x={u:uid(),t:Date.now(),m:'Cash',lines:[],total:10,profit:5};S.sales.push(x);obPut('sales',saleRow(x))}");
const n0=M.db.sales.length;await A.sync();ok(M.db.sales.length==n0+250&&A.S().ob.length==0,'250 waiting sales upload in batches');
// viewer
let V=await boot(new IDBFactory(),cfg);V.set('#sn','x');
// viewer device starts as an empty shop then signs in
V.click('start','empty');await V.signin('viewer@shop.test','viewpass');
ok(await V.until(()=>V.S().viewer===true),'viewer sign-in switches the phone to read-only mode');
const nav=[...V.D.querySelectorAll('nav button')].map(b=>b.textContent);
ok(nav.join()=='Reports,Stock,Account','viewer only sees Reports, Stock, Account: '+nav);
ok(/Item sales/.test(V.text())&&V.S().sales.length>200,'viewer reports load the cloud data');
const todayTotal=M.db.sales.filter(x=>new Date(+x.t).toDateString()==new Date().toDateString()).reduce((a,x)=>a+x.total,0);
ok(V.text().replace(/,/g,'').includes('KSh '+todayTotal),'viewer shows the same today total as the cloud: '+todayTotal);
V.click('nav','stock');ok(!V.$('input')&&!V.$('[data-a="restock"]')&&/charger/i.test(V.text()),'viewer stock page is read-only');
const post0=M.stats.posts,den0=M.stats.denied;const vp=await V.w.eval('Sync.push()');ok(vp.skip&&M.stats.posts==post0,'viewer never uploads');
// viewer refresh sees new owner sale
A.click('nav','sell');A.D.querySelector('.card').click();A.click('fin','Cash');await A.sync();
const vs=V.S().sales.length;V.click('nav','set');V.click('syncnow');ok(await V.until(()=>V.S().sales.length==vs+1),'viewer Refresh picks up a new sale from the shop');
// server enforces viewer cannot write (direct attempt)
const tok=await V.w.eval('Sync.token()');const bad=await fetch(M.url+'/rest/v1/sales?on_conflict=u',{method:'POST',headers:{apikey:M.anon,Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify([{u:'11111111-1111-1111-1111-111111111111',shop_id:M.shop,t:1,total:1}])});
ok(bad.status==403,'database rules refuse writes from the viewer account (403)');
// restore on a fresh owner laptop
let B=await boot(new IDBFactory(),cfg);B.set('#sn','New');B.click('start','empty');await B.signin('owner@shop.test','ownerpass');
B.click('nav','set');B.set('#rs','nope');B.click('cloudrestore');ok(/Type RESTORE/.test(B.$('#toast').textContent),'restore needs the word RESTORE');
B.set('#rs','RESTORE');B.click('cloudrestore');ok(await B.until(()=>B.S().sales.length==M.db.sales.length&&B.S().items.length==1),'new laptop restores all items and sales from the cloud');
ok(B.S().shop=='Kamau Electronics'&&B.S().items[0].p==900,'restored shop name and edited price');

// protection: a different device with its own data must not overwrite the cloud
let C=await boot(new IDBFactory(),cfg);C.set('#sn','Other');C.click('start','empty');C.click('nav','stock');C.typ('#sq','mouse');C.set('#nv','wireless');C.set('#nk','100');C.set('#np','200');C.set('#ns','3');C.click('newitem');
const cloudItems=M.db.shop_data[M.shop].data.items.length;
await C.signin('owner@shop.test','ownerpass');await sleep(300);
ok(C.S().lock=='choose'&&M.db.shop_data[M.shop].data.items.length==cloudItems&&M.db.shop_data[M.shop].data.items[0].n=='charger','device with its own data does NOT overwrite the cloud; it asks first');
ok(/already has data/.test(C.text()),'screen explains the choice');
C.set('#rp2','REPLACE');C.click('cloudreplace');await C.sync();
ok(M.db.shop_data[M.shop].data.items[0].n=='mouse'&&!C.S().lock,'typing REPLACE makes this device the master copy');
// sign out viewer returns to normal
V.click('signout');ok(await V.until(()=>!V.S().viewer),'viewer can sign out');
// keepalive + files
const fs=require('fs');ok(/cron/.test(fs.readFileSync(path.join(ROOT,'.github/workflows/keepalive.yml'),'utf8')),'keep-alive workflow present');
ok(A.errs.length+V.errs.length+B.errs.length==0,'no page errors '+[...A.errs,...V.errs,...B.errs]);
console.log('\nSYNC RESULT: '+pass+' passed, '+fail+' failed');M.close();process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e);process.exit(1)});
