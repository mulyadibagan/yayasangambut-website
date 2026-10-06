import {bilingualFiles,commitFiles} from './bilingual-publish.mjs';
import {renderPreview} from './preview.mjs';
import {createRemoteJWKSet,jwtVerify,SignJWT,importPKCS8} from 'jose';
import {HttpError,fail,isEditor,assertIdentity,assertEdit,now,token,sha,validatePost,articleMarkdown,imageType} from './core.mjs';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});
const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const cookies=req=>Object.fromEntries((req.headers.get('cookie')||'').split(';').map(v=>v.trim().split('=')));
const redirect=(url,headers={})=>new Response(null,{status:302,headers:{Location:url,...headers}});
const query=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const audit=(env,u,action,target)=>query(env,'INSERT INTO audit(actor,action,target,created_at) VALUES(?,?,?,?)',u.id,action,target,now()).run();
const configured=env=>!!(env.DB&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);
async function readLimited(req,limit){
  if(Number(req.headers.get('content-length')||0)>limit)fail(413,'Ukuran unggahan melebihi batas.');
  const reader=req.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail(413,'Ukuran unggahan melebihi batas.');}chunks.push(value);}
  const result=new Uint8Array(size);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}return result;
}
async function payload(req){const text=new TextDecoder().decode(await readLimited(req,250000));try{return JSON.parse(text);}catch{fail(400,'Data tidak valid.');}}
async function session(req,env){
  const raw=cookies(req)['__Host-yg-session'];if(!raw)fail(401,'Silakan masuk dengan akun Google YG.');
  const user=await query(env,'SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.id=? AND sessions.expires>? AND users.disabled=0',await sha(raw),Date.now()).first();
  if(!user)fail(401,'Sesi berakhir. Silakan masuk kembali.');return user;
}
async function authStart(env){
  if(!configured(env))fail(503,'Login Google Workspace sedang disiapkan.');
  const state=token(),nonce=token(),verifier=token();
  await env.DB.batch([query(env,'DELETE FROM oauth_states WHERE expires<?',Date.now()),query(env,'DELETE FROM sessions WHERE expires<?',Date.now()),query(env,'INSERT INTO oauth_states VALUES(?,?,?,?)',await sha(state),nonce,verifier,Date.now()+600000)]);
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  const challenge=btoa(String.fromCharCode(...hash)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:env.APP_ORIGIN+'/auth/callback',response_type:'code',scope:'openid email profile',state,nonce,hd:env.GOOGLE_WORKSPACE_DOMAIN,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'});
  return redirect(url.href,{'Set-Cookie':cookie('__Host-yg-oauth',state,600)});
}
async function authCallback(req,env,url){
  const state=url.searchParams.get('state');if(!state || state!==cookies(req)['__Host-yg-oauth'])fail(403,'Sesi login tidak cocok. Mulai login kembali.');
  const row=await query(env,'DELETE FROM oauth_states WHERE id=? AND expires>? RETURNING *',await sha(state),Date.now()).first();
  if(!row)fail(403,'Permintaan login kedaluwarsa atau sudah digunakan.');
  if(url.searchParams.has('error'))return redirect(env.APP_ORIGIN+'/?login=cancelled');
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,code:url.searchParams.get('code')||'',redirect_uri:env.APP_ORIGIN+'/auth/callback',grant_type:'authorization_code',code_verifier:row.verifier})});
  if(!response.ok)fail(401,'Google tidak dapat menyelesaikan login. Silakan coba kembali.');
  const tokens=await response.json();
  let claims;try{({payload:claims}=await jwtVerify(tokens.id_token,googleKeys,{audience:env.GOOGLE_CLIENT_ID,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256']}));}catch{fail(401,'Identitas Google tidak dapat diverifikasi.');}
  if(claims.nonce!==row.nonce)fail(401,'Identitas login tidak cocok.');
  const u=assertIdentity(claims,env);
  await query(env,'INSERT INTO users(id,email,name,role,created_at,last_login) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,last_login=excluded.last_login',u.id,u.email,u.name,u.role,now(),now()).run();
  const current=await query(env,'SELECT * FROM users WHERE id=?',u.id).first();if(current.disabled)fail(403,'Akses akun ini dinonaktifkan.');
  const raw=token();await query(env,'INSERT INTO sessions VALUES(?,?,?)',await sha(raw),u.id,Date.now()+8*3600000).run();
  await audit(env,u,'login',u.id);
  const headers=new Headers({Location:env.APP_ORIGIN+'/'});headers.append('Set-Cookie',cookie('__Host-yg-session',raw,28800));headers.append('Set-Cookie',cookie('__Host-yg-oauth','',0));return new Response(null,{status:302,headers});
}
async function githubToken(env){
  if(!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY || !env.GITHUB_INSTALLATION_ID)fail(503,'Koneksi penerbitan belum diaktifkan.');
  const key=await importPKCS8(env.GITHUB_APP_PRIVATE_KEY,'RS256');
  const jwt=await new SignJWT({}).setProtectedHeader({alg:'RS256'}).setIssuedAt(Math.floor(Date.now()/1000)-60).setExpirationTime('8m').setIssuer(env.GITHUB_APP_ID).sign(key);
  const r=await fetch(`https://api.github.com/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,{method:'POST',headers:{Authorization:'Bearer '+jwt,'User-Agent':'YG-Staff','Accept':'application/vnd.github+json'}});
  if(!r.ok)fail(502,'Koneksi GitHub gagal. Hubungi administrator.');return (await r.json()).token;
}
async function gh(env,path,access,method='GET',body){
  const r=await fetch('https://api.github.com/repos/'+env.GITHUB_REPOSITORY+path,{method,headers:{Authorization:'Bearer '+access,'User-Agent':'YG-Staff','Accept':'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(r.status===404 && method==='GET')return null;
  if(!r.ok)fail(502,'GitHub belum menerima perubahan. Coba kembali setelah memeriksa koneksi.');return r.json();
}
async function postMedia(env,u,p){
  const urls=[p.cover,...Array.from(p.body.matchAll(/<img[^>]+src="([^"]+)"/g),m=>m[1])].filter(Boolean);
  const ids=[];for(const url of urls){
    if(!url.startsWith(env.APP_ORIGIN+'/media/'))fail(400,'Foto harus berasal dari media dashboard.');
    const id=url.slice((env.APP_ORIGIN+'/media/').length);const media=await query(env,'SELECT * FROM media WHERE id=?',id).first();
    if(!media || (!isEditor(u)&&media.owner!==u.id))fail(403,'Foto tidak tersedia untuk tulisan ini.');ids.push(id);
  }return [...new Set(ids)];
}
async function publish(env,u,id,expectedVersion,action='publish'){
  let p=await query(env,'SELECT * FROM posts WHERE id=?',id).first();assertEdit(u,p);
  const removing=action==='trash';const clean=validatePost(p,env.APP_ORIGIN,!removing);p={...p,...clean};const ids=removing?[]:await postMedia(env,u,p);
  const access=await githubToken(env);
  const previousPublishedAt=p.published_at,previousGithubSha=p.github_sha;let commitSha;
  const lock=await query(env,"UPDATE posts SET status='publishing', published_at=COALESCE(published_at,?),publishing_started_at=?,github_sha=NULL,publish_action=?,version=version+1,publish_error=NULL WHERE id=? AND version=? AND status!='publishing'",now(),now(),action,id,expectedVersion).run();
  if(!lock.meta.changes)fail(409,'Tulisan sudah berubah. Muat ulang sebelum menerbitkan.');
  p=await query(env,'SELECT * FROM posts WHERE id=?',id).first();
  try{
    const readFile=async path=>{const file=await gh(env,'/contents/'+path+'?ref='+encodeURIComponent(env.GITHUB_BRANCH),access);return file?Buffer.from(file.content.replace(/\s/g,''),'base64').toString('utf8'):null;};
    const files=await bilingualFiles(env,p,removing,readFile);
    // Only after translation succeeds do approved photos become public.
    if(ids.length)await env.DB.batch(ids.map(mid=>query(env,'UPDATE media SET public=1 WHERE id=?',mid)));
    commitSha=await commitFiles(env,access,files,`${removing?'Withdraw':'Publish'} article${p.language==='id'?' (ID + EN)':''}: ${p.title}`,gh);
    await query(env,"UPDATE posts SET github_sha=?,content_sha=?,version=version+1 WHERE id=?",commitSha,await sha(JSON.stringify(files)),id).run();
    await audit(env,u,removing?'trash_requested':'publish_requested',id);
    return json({status:'publishing',message:removing?'Artikel sedang ditarik dari website. Tulisan masuk Sampah setelah build berhasil.':(p.language==='id'?'Artikel Indonesia dan Inggris dikirim untuk diterbitkan. Website sedang dibangun.':'Artikel dikirim untuk diterbitkan. Website sedang dibangun.'),commit:commitSha});
  }catch(e){
    if(!commitSha)await query(env,"UPDATE posts SET status='review',published_at=?,github_sha=?,publish_error=? WHERE id=?",previousPublishedAt,previousGithubSha,e instanceof HttpError?e.message:'Penerbitan belum terkonfirmasi. Silakan mencoba kembali.',id).run();
    throw e;
  }
}
async function checkPublish(env,p){
  if(p.status!=='publishing')return p;
  if(!p.github_sha){
    if(Date.now()-Date.parse(p.publishing_started_at)>600000){await query(env,"UPDATE posts SET status='review',publish_error=? WHERE id=? AND status='publishing' AND github_sha IS NULL",'Penerbitan terhenti. Coba kembali; artikel yang sama tidak akan digandakan.',p.id).run();p.status='review';p.publish_error='Penerbitan terhenti. Coba kembali.';}return p;
  }
  const access=await githubToken(env);
  const runs=await gh(env,`/actions/workflows/publish-staging.yml/runs?head_sha=${p.github_sha}&per_page=1`,access);
  let run=runs?.workflow_runs?.[0];
  if(!run || (run.status==='completed'&&run.conclusion!=='success')){
    const recent=await gh(env,'/actions/workflows/publish-staging.yml/runs?status=success&branch='+encodeURIComponent(env.GITHUB_BRANCH)+'&per_page=5',access);
    for(const candidate of recent?.workflow_runs||[]){const comparison=await gh(env,`/compare/${p.github_sha}...${candidate.head_sha}`,access);if(['ahead','identical'].includes(comparison?.status)){run=candidate;break;}}
  }
  if(run?.status==='completed'){
    const ok=run.conclusion==='success',removed=ok&&p.publish_action==='trash';
    await query(env,'UPDATE posts SET status=?,deleted_at=?,publish_error=? WHERE id=? AND github_sha=?',removed?'draft':ok?'published':'review',removed?now():null,ok?null:'Build website belum berhasil. Hubungi administrator sebelum mencoba kembali.',p.id,p.github_sha).run();
    p.status=removed?'draft':ok?'published':'review';p.deleted_at=removed?now():null;p.publish_error=ok?null:'Build website belum berhasil.';
  }return p;
}
async function analytics(env,days){
  if(!env.GA_SERVICE_ACCOUNT_EMAIL||!env.GA_SERVICE_ACCOUNT_KEY) return json({configured:false,message:'Statistik Google Analytics belum dihubungkan.'});
  const key=await importPKCS8(env.GA_SERVICE_ACCOUNT_KEY,'RS256');
  const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/analytics.readonly'}).setProtectedHeader({alg:'RS256'}).setIssuer(env.GA_SERVICE_ACCOUNT_EMAIL).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('50m').sign(key);
  const t=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});if(!t.ok)fail(502,'Koneksi statistik belum berhasil.');const {access_token}=await t.json();
  const report=async(dimensions,metrics,limit)=>{
    const r=await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA_PROPERTY_ID}:runReport`,{method:'POST',headers:{Authorization:'Bearer '+access_token,'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:days+'daysAgo',endDate:'yesterday'}],dimensions:dimensions.map(name=>({name})),metrics:metrics.map(name=>({name})),...(limit?{limit,orderBys:[{metric:{metricName:metrics[0]},desc:true}]}:{orderBys:dimensions.length?[{dimension:{dimensionName:dimensions[0]}}]:[]})})});if(!r.ok)fail(502,'Statistik tidak dapat dibaca. Periksa akses Viewer properti Analytics.');return r.json();
  };
  const reports=await Promise.all([report([],['activeUsers','sessions','screenPageViews','engagementRate']),report(['date'],['activeUsers']),report(['pagePath'],['screenPageViews'],10),report(['sessionDefaultChannelGroup'],['sessions'],10),...await Promise.allSettled([report(['country'],['activeUsers','sessions'],20),report(['city','region','country'],['activeUsers','sessions'],50)])]);
  return json({configured:true,days,timezone:'Asia/Jakarta',totals:reports[0],daily:reports[1],pages:reports[2],sources:reports[3],countries:reports[4].status==='fulfilled'?reports[4].value:{unavailable:true},cities:reports[5].status==='fulfilled'?reports[5].value:{unavailable:true}});
}
async function api(req,env,url,u){
  const path=url.pathname,method=req.method;
  if(path==='/api/preview'&&method==='POST'){const input=await payload(req);const post=validatePost({...input,title:input.title||'Tanpa judul'},env.APP_ORIGIN);if(url.searchParams.get('view')==='website'){const template=await env.ASSETS.fetch(new Request(env.APP_ORIGIN+'/website-preview/'+post.language+'.html'));if(!template.ok)fail(503,'Pratinjau website belum tersedia.');return json({html:renderPreview(await template.text(),post)});}return json(post);}
  if(path==='/api/me')return json({id:u.id,name:u.name,email:u.email,role:u.role,publishing:!!env.GITHUB_APP_ID,analytics:!!env.GA_SERVICE_ACCOUNT_EMAIL});
  if(path==='/api/logout'&&method==='POST'){await query(env,'DELETE FROM sessions WHERE id=?',await sha(cookies(req)['__Host-yg-session']||'')).run();return new Response('{}',{headers:{'Set-Cookie':cookie('__Host-yg-session','',0)}});}
  if(path==='/api/posts'&&method==='GET'){
    const r=await query(env,'SELECT id,title,slug,language,status,owner,updated_at,version,publish_error,deleted_at,publish_action,published_at,publishing_started_at,github_sha FROM posts '+(isEditor(u)?'':'WHERE owner=? ')+'ORDER BY updated_at DESC LIMIT 300',...(isEditor(u)?[]:[u.id])).all();return json(await Promise.all(r.results.map(p=>checkPublish(env,p))));
  }
  if(path==='/api/posts'&&method==='POST'){
    const p=validatePost(await payload(req),env.APP_ORIGIN);const id=crypto.randomUUID();const slug=(p.title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'cerita')+'-'+id.slice(0,8);
    await postMedia(env,u,p);
    await query(env,"INSERT INTO posts(id,owner,title,slug,language,summary,category,author,body,cover,image_alt,image_credit,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?)",id,u.id,p.title,slug,p.language,p.summary,p.category,p.author||u.name,p.body,p.cover,p.image_alt,p.image_credit,now(),now()).run();await audit(env,u,'create',id);return json(await query(env,'SELECT * FROM posts WHERE id=?',id).first(),201);
  }
  const match=path.match(/^\/api\/posts\/([a-f0-9-]+)(?:\/(submit|return|publish|trash|restore))?$/);
  if(match){
    const [,id,action]=match;let p=await query(env,'SELECT * FROM posts WHERE id=?',id).first();if(!p)fail(404,'Tulisan tidak ditemukan.');
    if(!isEditor(u)&&p.owner!==u.id)fail(403,'Tulisan ini bukan milik Anda.');
    if(method==='GET'&&!action)return json(await checkPublish(env,p));
    if(method==='POST'&&action==='restore'){
      const input=await payload(req);if(!p.deleted_at)fail(409,'Tulisan tidak berada di Sampah.');
      const r=await query(env,"UPDATE posts SET deleted_at=NULL,status='draft',published_at=NULL,publish_action='publish',github_sha=NULL,publish_error=NULL,updated_at=?,version=version+1 WHERE id=? AND version=? AND deleted_at IS NOT NULL",now(),id,input.version).run();if(!r.meta.changes)fail(409,'Tulisan sudah berubah. Muat ulang.');await audit(env,u,'restore',id);return json({ok:true});
    }
    if(method==='POST'&&action==='trash'){
      assertEdit(u,p);const input=await payload(req);
      if(p.published_at)return publish(env,u,id,input.version,'trash');
      const r=await query(env,"UPDATE posts SET deleted_at=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND status!='publishing' AND deleted_at IS NULL",now(),now(),id,input.version).run();if(!r.meta.changes)fail(409,'Tulisan sudah berubah. Muat ulang.');await audit(env,u,'trash',id);return json({ok:true,message:'Tulisan dipindahkan ke Sampah dan dapat dipulihkan.'});
    }
    if(method==='POST'&&action==='publish'){const input=await payload(req);return publish(env,u,id,input.version);}
    if(method==='PUT'&&!action){
      assertEdit(u,p);const input=await payload(req);const clean=validatePost(input,env.APP_ORIGIN);await postMedia(env,u,clean);
      if(clean.language!==p.language)fail(400,'Bahasa tidak dapat diganti setelah draf dibuat. Buat tulisan terpisah untuk terjemahan.');
      const result=await query(env,"UPDATE posts SET title=?,summary=?,category=?,author=?,body=?,cover=?,image_alt=?,image_credit=?,status='draft',updated_at=?,version=version+1 WHERE id=? AND version=?",clean.title,clean.summary,clean.category,clean.author,clean.body,clean.cover,clean.image_alt,clean.image_credit,now(),id,input.version).run();if(!result.meta.changes)fail(409,'Ada perubahan dari pengguna lain. Muat ulang tulisan.');await audit(env,u,'save',id);return json(await query(env,'SELECT * FROM posts WHERE id=?',id).first());
    }
    if(method==='POST'&&action==='submit'){
      assertEdit(u,p);validatePost(p,env.APP_ORIGIN,true);const input=await payload(req);
      const r=await query(env,"UPDATE posts SET status='review',review_note='',version=version+1,updated_at=? WHERE id=? AND version=?",now(),id,input.version).run();if(!r.meta.changes)fail(409,'Tulisan sudah berubah. Muat ulang.');await audit(env,u,'submit',id);return json({ok:true});
    }
    if(method==='POST'&&action==='return'){
      if(!isEditor(u))fail(403,'Akses editor diperlukan.');assertEdit(u,p);const input=await payload(req);
      const r=await query(env,"UPDATE posts SET status='draft',review_note=?,version=version+1,updated_at=? WHERE id=? AND version=?",String(input.note||'').slice(0,2000),now(),id,input.version).run();if(!r.meta.changes)fail(409,'Tulisan berubah. Muat ulang.');await audit(env,u,'return',id);return json({ok:true});
    }
  }
  if(path==='/api/media'&&method==='GET')return json((await query(env,'SELECT * FROM media '+(isEditor(u)?'':'WHERE owner=? ')+'ORDER BY created_at DESC LIMIT 200',...(isEditor(u)?[]:[u.id])).all()).results.map(m=>({...m,url:env.APP_ORIGIN+'/media/'+m.id})));
  if(path==='/api/media'&&method==='POST'){
    if(!env.MEDIA)fail(503,'Penyimpanan foto belum diaktifkan.');
    if(Number(req.headers.get('content-length')||0)>2200000)fail(413,'Ukuran maksimum foto adalah 2 MB.');
    const bytes=await readLimited(req,2097152);if(bytes.length>2097152)fail(413,'Ukuran maksimum foto adalah 2 MB.');const type=imageType(bytes);if(!type)fail(400,'Gunakan foto JPEG, PNG, atau WebP.');
    const count=await query(env,'SELECT COUNT(*) AS n FROM media WHERE owner=? AND created_at>?',u.id,new Date(Date.now()-86400000).toISOString()).first();if(count.n>=100)fail(429,'Batas unggahan harian tercapai.');
    const id=crypto.randomUUID(); let filename='Foto'; try{filename=decodeURIComponent(req.headers.get('X-Filename')||'Foto').slice(0,180);}catch{fail(400,'Nama foto tidak valid.');}
    await env.MEDIA.put(id,bytes,{httpMetadata:{contentType:type}});await query(env,'INSERT INTO media(id,owner,filename,type,size,public,created_at) VALUES(?,?,?,?,?,0,?)',id,u.id,filename,type,bytes.length,now()).run();await audit(env,u,'upload',id);return json({id,url:env.APP_ORIGIN+'/media/'+id,filename});
  }
  if(path==='/api/analytics'&&method==='GET'){return analytics(env,[7,28,90].includes(Number(url.searchParams.get('days')))?Number(url.searchParams.get('days')):28);}
  if(path==='/api/users'&&method==='GET'){if(u.role!=='admin')fail(403,'Akses administrator diperlukan.');return json((await query(env,'SELECT id,email,name,role,disabled,last_login FROM users ORDER BY name').all()).results);}
  if(path==='/api/users'&&method==='PATCH'){
    if(u.role!=='admin')fail(403,'Akses administrator diperlukan.');const input=await payload(req);
    if(input.id===u.id)fail(400,'Anda tidak dapat mengubah akses akun sendiri.');
    if(!['staff','editor'].includes(input.role)||typeof input.disabled!=='boolean')fail(400,'Peran tidak valid.');
    const target=await query(env,'SELECT * FROM users WHERE id=?',input.id).first();if(!target||target.role==='admin')fail(403,'Akun ini tidak dapat diubah.');
    await env.DB.batch([query(env,'UPDATE users SET role=?,disabled=? WHERE id=?',input.role,Number(input.disabled),input.id),query(env,'DELETE FROM sessions WHERE user_id=?',input.id)]);await audit(env,u,'access:'+input.role+':'+input.disabled,input.id);return json({ok:true});
  }
  fail(404,'Halaman tidak ditemukan.');
}
async function route(req,env){
  const url=new URL(req.url);
  if(url.origin!==env.APP_ORIGIN)fail(403,'Alamat dashboard tidak sesuai konfigurasi.');
  if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers.get('Origin')!==env.APP_ORIGIN)fail(403,'Permintaan lintas situs ditolak.');
  if(url.pathname==='/api/config')return json({ready:configured(env),automaticEnglish:!!env.AI});
  if(url.pathname==='/auth/login'&&req.method==='GET')return authStart(env);
  if(url.pathname==='/auth/callback'&&req.method==='GET')return authCallback(req,env,url);
  if(url.pathname.startsWith('/media/')){
    const id=url.pathname.slice(7);const meta=await query(env,'SELECT * FROM media WHERE id=?',id).first();if(!meta)fail(404,'Foto tidak ditemukan.');
    if(!meta.public){const u=await session(req,env);if(!isEditor(u)&&meta.owner!==u.id)fail(403,'Foto ini privat.');}
    if(meta.asset_path){
      if(!meta.public||meta.asset_path!=='/imported-media/'+id+'.webp')fail(404,'Foto tidak ditemukan.');
      return env.ASSETS.fetch(new Request(env.APP_ORIGIN+meta.asset_path));
    }
    const obj=await env.MEDIA.get(id);if(!obj)fail(404,'Foto tidak ditemukan.');return new Response(obj.body,{headers:{'Content-Type':meta.type,'Cache-Control':meta.public?'public, max-age=86400':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(url.pathname.startsWith('/api/')){if(!configured(env))fail(503,'Dashboard staf sedang disiapkan.');return api(req,env,url,await session(req,env));}
  if(url.pathname==='/robots.txt')return new Response('User-agent: *\nDisallow: /\n');
  return env.ASSETS.fetch(req);
}
export default {async fetch(req,env){
  let r;try{r=await route(req,env);}catch(e){r=json({error:e instanceof HttpError?e.message:'Layanan sementara tidak tersedia. Coba kembali atau hubungi administrator.'},e instanceof HttpError?e.status:500);}
  const out=new Response(r.body,r);out.headers.set('X-Content-Type-Options','nosniff');out.headers.set('Referrer-Policy','same-origin');out.headers.set('X-Frame-Options','DENY');out.headers.set('X-Robots-Tag','noindex, nofollow');out.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
  if(!new URL(req.url).pathname.startsWith('/media/'))out.headers.set('Cache-Control','no-store');return out;
}};
