// A small stand-in for Supabase (auth + REST + row rules) used only by the tests.
const http=require('http');const crypto=require('crypto');
module.exports=function start(){
const ANON='anon-key';let seq=0;const id=()=>crypto.randomUUID();
const shop=id();
const users=[{id:id(),email:'owner@shop.test',password:'ownerpass',role:'owner'},{id:id(),email:'viewer@shop.test',password:'viewpass',role:'viewer'},{id:id(),email:'stray@shop.test',password:'straypass',role:null}];
const db={shop_data:{},sales:[]};const toks={},refs={};
const stats={refresh:0,posts:0,deletes:0,denied:0};let failNext=0;
const issue=u=>{const at='at'+(++seq),rt='rt'+seq;toks[at]=u.id;refs[rt]=u.id;return{access_token:at,refresh_token:rt,expires_in:3600,user:{id:u.id,email:u.email}}};
const parse=q=>{const o={};new URLSearchParams(q).forEach((v,k)=>o[k]=v);return o};
const srv=http.createServer((req,res)=>{let b='';req.on('data',d=>b+=d);req.on('end',()=>{
const url=new URL(req.url,'http://x');const q=parse(url.search);const send=(c,j)=>{res.writeHead(c,{'content-type':'application/json'});res.end(j===undefined?'':JSON.stringify(j))};
if(req.headers.apikey!==ANON)return send(401,{message:'No API key'});
if((req.headers.authorization||'').replace('Bearer ','')===ANON)return send(401,{message:'Invalid JWT'});
const body=b?JSON.parse(b):null;
if(url.pathname=='/auth/v1/token'){
 if(q.grant_type=='password'){const u=users.find(x=>x.email==body.email&&x.password==body.password);return u?send(200,issue(u)):send(400,{error_description:'Invalid login credentials'})}
 if(q.grant_type=='refresh_token'){stats.refresh++;const uid=refs[body.refresh_token];const u=users.find(x=>x.id==uid);return u?send(200,issue(u)):send(400,{error_description:'Invalid refresh token'})}}
const bearer=(req.headers.authorization||'').replace('Bearer ','');const uid=toks[bearer];const me=users.find(x=>x.id==uid);
if(!me)return send(401,{message:'JWT expired or invalid'});
const isMember=!!me.role,isOwner=me.role=='owner';
if(failNext>0&&req.method!='GET'){failNext--;return send(500,{message:'Server error'})}
const t=url.pathname.replace('/rest/v1/','');
if(t=='members'){return send(200,me.role?[{shop_id:shop,role:me.role}]:[])}
const rows=t=='shop_data'?Object.entries(db.shop_data).map(([k,v])=>({shop_id:k,...v})):db[t];
if(!rows)return send(404,{message:'no table'});
if(req.method=='GET'){if(!isMember)return send(200,[]);let r=rows.filter(x=>x.shop_id==(q.shop_id||'').replace('eq.',''));
 if(q.t)r=r.filter(x=>x.t>=+q.t.replace('gte.',''));if(q.order)r=[...r].sort((a,b)=>a.t-b.t);
 const off=+(q.offset||0),lim=+(q.limit||1000);return send(200,r.slice(off,off+lim))}
if(!isOwner){stats.denied++;return send(403,{message:'new row violates row-level security policy for table "'+t+'"'})}
if(req.method=='POST'){stats.posts++;const arr=Array.isArray(body)?body:[body];
 if(t=='shop_data'){arr.forEach(r=>db.shop_data[r.shop_id]={data:r.data,updated_at:r.updated_at})}
 else arr.forEach(r=>{const i=db[t].findIndex(x=>x.u==r.u);if(i>=0)db[t][i]=r;else db[t].push(r)});
 return send(201)}
if(req.method=='DELETE'){stats.deletes++;const m=(q.u||'').match(/^in\.\((.*)\)$/);const ids=m?m[1].split(','):[];db[t]=db[t].filter(x=>!ids.includes(x.u));return send(204)}
send(405,{message:'?'})})});
return new Promise(r=>srv.listen(0,'127.0.0.1',()=>r({url:'http://127.0.0.1:'+srv.address().port,anon:ANON,db,stats,shop,users,fail:n=>failNext=n,close:()=>srv.close()})))};
