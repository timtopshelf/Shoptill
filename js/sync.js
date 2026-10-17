/* ShopTill cloud sync: talks to Supabase over plain HTTPS (no library). Needs app.js globals: S, DB, blank, flush. */
const Sync=(()=>{
const C=()=>window.SHOPTILL_CLOUD||{};
const configured=()=>!!(C().url&&C().anon);
let ses=null,busy=false;
const H=(tok,x)=>Object.assign({apikey:C().anon,'Content-Type':'application/json'},tok?{Authorization:'Bearer '+tok}:{},x||{});
async function req(path,o){const r=await fetch(C().url+path,o);const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
if(!r.ok){const e=new Error((j&&(j.msg||j.message||j.error_description||j.error))||('Error '+r.status));e.status=r.status;throw e}return j}
async function mk(r){const m=await req('/rest/v1/members?select=shop_id,role&user_id=eq.'+r.user.id,{headers:H(r.access_token)});
if(!m||!m.length)throw new Error('This account is not linked to a shop yet. Ask the administrator.');
return{at:r.access_token,rt:r.refresh_token,exp:Date.now()+r.expires_in*1000-60000,uid:r.user.id,email:r.user.email,shop:m[0].shop_id,role:m[0].role}}
async function login(email,pw){const r=await req('/auth/v1/token?grant_type=password',{method:'POST',headers:H(),body:JSON.stringify({email,password:pw})});ses=await mk(r);await DB.set('session',ses);return ses}
async function session(){if(!ses)ses=(await DB.get('session'))||null;return ses}
async function token(){await session();if(!ses)return null;if(Date.now()>ses.exp){const r=await req('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:H(),body:JSON.stringify({refresh_token:ses.rt})});ses.at=r.access_token;ses.rt=r.refresh_token||ses.rt;ses.exp=Date.now()+r.expires_in*1000-60000;await DB.set('session',ses)}return ses.at}
async function logout(){ses=null;await DB.set('session',null)}
const up={Prefer:'resolution=merge-duplicates,return=minimal'};
async function push(){if(!configured()||busy||!navigator.onLine||S.viewer||S.lock)return{skip:true};
busy=true;try{await token();if(!ses||ses.role!='owner')return{skip:true};const t=ses.at;
if(S.dirty){const rev=S.rev;const data={shop:S.shop,items:S.items,phones:S.phones,pre:S.pre,nid:S.nid};
await req('/rest/v1/shop_data?on_conflict=shop_id',{method:'POST',headers:H(t,up),body:JSON.stringify({shop_id:ses.shop,data,updated_at:new Date().toISOString()})});if(S.rev==rev)S.dirty=false;S.cloudShop=ses.shop}
while(S.ob&&S.ob.length){const b=S.ob.slice(0,100);
for(const k of['sales']){const p=b.filter(o=>o.k==k&&o.op=='put').map(o=>Object.assign({},o.row,{shop_id:ses.shop}));
if(p.length)await req('/rest/v1/'+k+'?on_conflict=u',{method:'POST',headers:H(t,up),body:JSON.stringify(p)});
const d=b.filter(o=>o.k==k&&o.op=='del').map(o=>o.u);if(d.length)await req('/rest/v1/'+k+'?u=in.('+d.join(',')+')',{method:'DELETE',headers:H(t)})}
S.ob.splice(0,b.length)}
S.syncAt=Date.now();S.syncErr='';await flush();return{ok:true}}
catch(e){S.syncErr=e.message;await flush();return{err:e.message}}finally{busy=false}}
async function page(path,t){let all=[],off=0;for(;;){const r=await req(path+'&limit=1000&offset='+off,{headers:H(t)});all=all.concat(r||[]);if(!r||r.length<1000)break;off+=1000}return all}
const num=x=>Object.assign({},x,{t:+x.t,total:+x.total,profit:+x.profit});
async function pull(days){await token();if(!ses)throw new Error('Not signed in');const t=ses.at,sh='&shop_id=eq.'+ses.shop,since=days?'&t=gte.'+(Date.now()-days*864e5):'';
const d=await req('/rest/v1/shop_data?select=data,updated_at&shop_id=eq.'+ses.shop,{headers:H(t)});
const s=await page('/rest/v1/sales?select=u,t,m,total,profit,lines&order=t.asc'+sh+since,t);
const o=(d&&d[0]&&d[0].data)||{};
return Object.assign(blank(),o,{setup:true,sales:s.map(num),pulledAt:Date.now(),cloudAt:d&&d[0]?d[0].updated_at:null})}
async function info(){await token();const d=await req('/rest/v1/shop_data?select=data&shop_id=eq.'+ses.shop,{headers:H(ses.at)});return{has:!!(d&&d[0]&&d[0].data&&(d[0].data.items||[]).length)}}
return{info,configured,login,logout,session,push,pull,token,_expire(){if(ses)ses.exp=0}}})();
