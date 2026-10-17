const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
const {IDBFactory}=require('fake-indexeddb');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(idb){const errs=[];const dom=await JSDOM.fromFile(path.join(ROOT,'index.html'),{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,beforeParse(w){w.indexedDB=idb;w.addEventListener('error',e=>errs.push(e.message));w.URL.createObjectURL=()=>'blob:x';w.HTMLAnchorElement.prototype.click=function(){w.__dl=this.download}}});
const w=dom.window,D=w.document;for(let i=0;i<50&&!D.querySelector('#app').innerHTML;i++)await sleep(20);
const $=s=>D.querySelector(s);
const t={w,D,$,errs,
click:(a,v)=>{const e=D.querySelector(v===undefined?`[data-a="${a}"]`:`[data-a="${a}"][data-v="${v}"]`);if(!e)throw new Error('no button '+a+' '+v);e.click()},
typ:(s,val)=>{const e=$(s);if(!e)throw new Error('no input '+s);e.value=val;e.dispatchEvent(new w.Event('input',{bubbles:true}))},
set:(s,val)=>{const e=$(s);if(!e)throw new Error('no field '+s);e.value=val},
toast:()=>$('#toast').textContent,
S:()=>w.eval('S'),flush:()=>w.eval('flush()')};return t}
(async()=>{
const idb=new IDBFactory();let T=await boot(idb);
ok(T.errs.length==0,'app boots without errors '+T.errs);
ok(/Set up your shop/.test(T.D.body.textContent),'first run shows setup screen');
T.set('#sn','Kamau Electronics');T.click('start','empty');
ok(T.S().setup&&T.S().shop=='Kamau Electronics'&&T.S().items.length==0,'empty start, shop name saved');
ok(/No items yet/.test(T.D.body.textContent),'sell screen guides when no items');
// create items
T.click('nav','stock');T.typ('#sq','screen');
ok(!!T.$('#nn'),'create form appears for an unknown item');
T.set('#nv','Huawei Y6 2018 Original');T.set('#ns','5');T.click('newitem');
ok(/buying and selling/.test(T.toast())&&T.S().items.length==0,'blocked without prices: '+T.toast());
T.set('#nv','Huawei Y6 2018 Original');T.set('#nc','Screens');T.set('#nk','900');T.set('#np','1500');T.set('#ns','5');T.set('#nm','2');T.click('newitem');
ok(T.S().items.length==1&&T.S().items[0].v=='Huawei Y6 2018 Original','item created with his own description');
T.typ('#sq','huawei y6');
ok(!!T.$('[data-a="restock"]'),'description is searchable ("huawei y6" finds it)');
const id=T.S().items[0].id;
T.set('#rq'+id,'3');T.click('restock',id);
ok(T.S().items[0].s==8&&T.S().items[0].k==900,'restock by quantity only: 8');
T.typ('#sq','huawei y6');T.set('#rq'+id,'2');T.set('#rk'+id,'1000');T.click('restock',id);
ok(T.S().items[0].s==10&&T.S().items[0].k==920,'new buying price averages cost to 920');
T.typ('#sq','huawei y6');T.set('#rq'+id,'0');T.click('restock',id);
ok(/Enter how many/.test(T.toast())&&T.S().items[0].s==10,'zero quantity rejected');
T.typ('#sq','huawei y6');T.click('clone',id);
ok(T.$('#nn').value=='screen'&&T.$('#np').value=='1500'&&T.$('#nv').value=='','"Add another type" prefills everything but description');
T.set('#nv','Huawei Y6 2018 Copy');T.set('#nk','500');T.set('#np','900');T.set('#ns','4');T.click('newitem');
ok(T.S().items.length==2,'second type created (Copy)');
T.typ('#sq','screen');T.set('#nv','Huawei Y6 2018 Copy');T.set('#nk','1');T.set('#np','2');T.click('newitem');
ok(/already exists/.test(T.toast())&&T.S().items.length==2,'duplicate name+description blocked');
T.typ('#sq','charger');T.set('#nv','20W <img src=x onerror=alert(1)>');T.set('#nk','480');T.set('#np','800');T.set('#ns','12');T.click('newitem');
ok(T.D.querySelectorAll('img').length==0,'HTML in descriptions is escaped, not run');
T.typ('#sq','charger');T.set('#nn','Phone charger');T.set('#nv','Micro USB 10W');T.set('#nk','200');T.set('#np','400');T.set('#ns','15');T.click('newitem');
ok(T.S().items.length==4,'two charger types tracked separately');
// sell
T.click('nav','sell');
ok(T.D.querySelectorAll('.card').length==4,'quick sale grid shows items');
T.typ('#q','y6 original');let cards=T.D.querySelectorAll('.card');ok(cards.length==1,'search by words from description narrows to 1');
cards[0].click();cards=T.D.querySelectorAll('.card');T.D.querySelector('.card').click();
T.click('fin','Cash');
let s=T.S().sales[0];ok(s.total==3000&&s.profit==3000-1840&&s.m=='Cash','sale of 2: total 3000, profit uses cost 920 -> '+s.profit);
ok(T.S().items[0].s==8,'stock down to 8');
T.click('undo');ok(T.S().items[0].s==10&&T.S().sales.length==0,'undo restores stock and removes the sale');
T.typ('#q','y6 original');for(let i=0;i<15;i++)T.D.querySelector('.card').click();
ok(/10/.test(T.D.querySelector('.cart .qty').textContent)&&!/11/.test(T.D.querySelector('.cart .qty').textContent),'cannot put more in the sale than in stock');
T.click('fin','Pochi');ok(T.S().items[0].s==0,'sold all 10, stock is 0');
T.typ('#q','y6 original');ok(T.D.querySelector('.card').disabled,'sold-out item cannot be added');
// price change keeps history
T.click('nav','stock');const ch=T.$('[data-f="p"][data-id="'+id+'"]');ch.value='1800';ch.dispatchEvent(new T.w.Event('change',{bubbles:true}));
ok(T.S().sales[0].total==15000&&T.S().items[0].p==1800,'price change does not rewrite past sales');
// reports
T.click('nav','rpt');const txt=T.D.body.textContent;
ok(/KSh 15,000/.test(txt)&&/Gross profit/.test(txt),'reports show item sales and profit');
ok(/No backup yet/.test(txt),'report warns that no backup exists');
// persistence
await T.flush();const T2=await boot(idb);
ok(T2.S().items.length==4&&T2.S().sales.length==1&&T2.S().shop=='Kamau Electronics'&&T2.S().setup,'data survives closing and reopening the app');
// CSV
const csv='name,description,category,buying,selling,quantity,minimum\n"Power bank","10000mAh, black",Chargers,1600,2200,4,5\nPhone charger,Micro USB 10W,Chargers,250,450,5,5\n,,,,,,\nBadRow,x,y,abc,def,1,1\n';
const res=T2.w.eval('importCSV('+JSON.stringify(csv)+')');
ok(res.add==1&&res.upd==1&&res.bad==1,'CSV import: 1 new, 1 updated, 1 skipped '+JSON.stringify(res));
ok(T2.S().items.find(i=>i.n=='Phone charger'&&i.v=='Micro USB 10W').s==20,'CSV restock added quantity (15+5)');
ok(T2.S().items.find(i=>i.n=='Power bank').v=='10000mAh, black','CSV quoted commas handled');
// backup + restore
T2.click('nav','set');T2.click('export');
ok(/shop-backup-.*\.json/.test(T2.w.__dl)&&T2.S().lastBackup>0,'backup download triggered and recorded');
const snap=JSON.stringify(T2.S());T2.click('nav','set');T2.set('#del','nope');T2.click('wipe');
ok(T2.S().items.length>0,'erase blocked without typing DELETE');
T2.set('#del','DELETE');T2.click('wipe');ok(T2.S().items.length==0&&!T2.S().setup,'erase works after typing DELETE');
const inp=null;T2.w.eval('S='+snap+';S.setup=true;render()');
ok(T2.S().items.length==5,'state can be restored from backup JSON');
// offline chip
Object.defineProperty(T2.w.navigator,'onLine',{value:false,configurable:true});T2.w.dispatchEvent(new T2.w.Event('offline'));
ok(/Offline/.test(T2.$('.sync').textContent),'offline chip shows when internet is off');
// scale
T2.w.eval('for(let i=0;i<3000;i++)S.items.push({id:S.nid++,n:"Item "+i,v:"type "+(i%50),c:"Misc",al:"",k:10,p:20,s:5,m:1});render()');
let t0=Date.now();T2.click('nav','sell');T2.typ('#q','item 29');const ms=Date.now()-t0;
ok(ms<800,'3000 items: search and redraw in '+ms+' ms');
// static files
const man=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest')));
ok(man.display=='standalone'&&man.icons.length>=2&&man.start_url=='./','manifest valid for install');
ok(fs.statSync(path.join(ROOT,'icons/icon-512.png')).size>500,'icons exist');
require('child_process').execSync('node --check '+path.join(ROOT,'sw.js'));ok(true,'service worker has valid syntax');
ok(T.errs.length==0&&T2.errs.length==0,'no page errors during the whole run '+T.errs.concat(T2.errs));
console.log('\nRESULT: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)})().catch(e=>{console.error('CRASH',e);process.exit(1)});
