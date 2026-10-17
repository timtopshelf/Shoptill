// Developer-only: a small gateway that behaves like Supabase's front door (login + API-key check + /rest/v1),
// in front of a REAL PostgREST and REAL PostgreSQL that run the real supabase/schema.sql and setup.sql.
// Used by: BACKEND=real node sync-tests.js   (needs local postgres + postgrest; see README of the test run)
const http=require('http'),crypto=require('crypto'),{execFileSync}=require('child_process');
const SECRET='super-secret-jwt-token-with-at-least-32-characters-long',PUB='sb_publishable_test_key',PGRST='http://127.0.0.1:3000';
const q=sql=>execFileSync('psql',['-h','127.0.0.1','-U','tester','-d','shop','-tAc',sql],{env:{...process.env,PGPASSWORD:'t'}}).toString().trim();
const b64=o=>Buffer.from(typeof o=='string'?o:JSON.stringify(o)).toString('base64url');
const jwt=p=>{const h=b64({alg:'HS256',typ:'JWT'}),b=b64(p),s=crypto.createHmac('sha256',SECRET).update(h+'.'+b).digest('base64url');return h+'.'+b+'.'+s};
module.exports=function start(){
const stats={refresh:0,posts:0,deletes:0,denied:0};let failNext=0,seq=0;const refs={};
const issue=u=>{const rt='rt'+(++seq)+crypto.randomUUID();refs[rt]=u;const now=Math.floor(Date.now()/1000);
 return{access_token:jwt({sub:u.id,role:'authenticated',aud:'authenticated',email:u.email,iat:now,exp:now+3600}),refresh_token:rt,expires_in:3600,user:{id:u.id,email:u.email}}};
const srv=http.createServer((req,res)=>{let b=[];req.on('data',d=>b.push(d));req.on('end',async()=>{const body=Buffer.concat(b);
const send=(c,j)=>{res.writeHead(c,{'content-type':'application/json'});res.end(j===undefined?'':JSON.stringify(j))};
if(req.headers.apikey!==PUB)return send(401,{message:'Invalid API key'});
const auth=req.headers.authorization;if(auth&&auth.split('.').length!==3)return send(401,{message:'Invalid JWT'});
const url=new URL(req.url,'http://x');
if(url.pathname=='/auth/v1/token'){const j=JSON.parse(body.toString()||'{}');
 if(url.searchParams.get('grant_type')=='password'){const r=q("select id||'|'||email from auth.users where email='"+String(j.email).replace(/'/g,"''")+"' and password='"+String(j.password).replace(/'/g,"''")+"'");
  if(!r)return send(400,{error_description:'Invalid login credentials'});const[id,email]=r.split('|');return send(200,issue({id,email}))}
 if(url.searchParams.get('grant_type')=='refresh_token'){stats.refresh++;const u=refs[j.refresh_token];return u?send(200,issue(u)):send(400,{error_description:'Invalid Refresh Token'})}}
if(url.pathname.startsWith('/rest/v1/')){
 if(req.method!='GET'&&failNext>0){failNext--;return send(500,{message:'Server error'})}
 if(req.method=='POST')stats.posts++;if(req.method=='DELETE')stats.deletes++;
 const h={'content-type':req.headers['content-type']||'application/json'};if(auth)h.authorization=auth;if(req.headers.prefer)h.prefer=req.headers.prefer;
 const r=await fetch(PGRST+url.pathname.replace('/rest/v1','')+url.search,{method:req.method,headers:h,body:['GET','HEAD'].includes(req.method)?undefined:body});
 const t=await r.text();if(r.status==403||r.status==401)stats.denied++;res.writeHead(r.status,{'content-type':'application/json'});return res.end(t)}
send(404,{message:'not found'})})});
const db={};Object.defineProperties(db,{
 sales:{get:()=>JSON.parse(q("select coalesce(json_agg(s order by t),'[]') from sales s")||'[]')},
 shop_data:{get:()=>JSON.parse(q("select coalesce(json_object_agg(shop_id,json_build_object('data',data,'updated_at',updated_at)),'{}') from shop_data")||'{}')}});
return new Promise(r=>srv.listen(0,'127.0.0.1',()=>r({url:'http://127.0.0.1:'+srv.address().port,anon:PUB,db,stats,shop:q('select id from shops limit 1'),fail:n=>failNext=n,close:()=>srv.close()})))};
