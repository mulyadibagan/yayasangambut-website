import sanitizeHtml from 'sanitize-html';
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export const fail=(status,message)=>{throw new HttpError(status,message);};
export const isEditor=u=>['editor','admin'].includes(u.role);
export function assertIdentity(p,env){
  const email=String(p.email||'').toLowerCase();
  if(p.email_verified!==true || p.hd!==env.GOOGLE_WORKSPACE_DOMAIN || !email.endsWith('@'+env.GOOGLE_WORKSPACE_DOMAIN) || !p.sub) fail(403,'Gunakan akun Google Workspace Yayasan Gambut.');
  return {id:p.sub,email,name:String(p.name||email).slice(0,160),role:email===env.ADMIN_EMAIL?'admin':email===env.EDITOR_EMAIL?'editor':'staff'};
}
export function assertEdit(user,post){
  if(!post) fail(404,'Tulisan tidak ditemukan.');
  if(!isEditor(user) && post.owner!==user.id) fail(403,'Tulisan ini tidak dapat disunting dengan akses Anda.');
  if(post.status==='publishing') fail(409,'Tulisan sedang diterbitkan. Tunggu proses selesai.');
}
export const now=()=>new Date().toISOString();
export const token=()=>crypto.randomUUID()+crypto.randomUUID();
export const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
export function cleanBody(body,origin){
  return sanitizeHtml(String(body||''),{
    allowedTags:['p','br','h2','h3','strong','b','em','i','u','ul','ol','li','blockquote','a','img','figure','figcaption'],
    allowedAttributes:{a:['href','title'],img:['src','alt'],figure:[],figcaption:[]},
    allowedSchemes:['https','mailto'],allowProtocolRelative:false,
    transformTags:{a:(tag,attrs)=>({tagName:'a',attribs:{...attrs,rel:'noopener noreferrer'}})},
    exclusiveFilter:frame=>frame.tag==='img'&&!new RegExp('^'+origin.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/media/[a-f0-9-]+$').test(frame.attribs.src||'')
  });
}
export function validatePost(input,origin,publish=false){
  const val=(key,max)=>{const v=String(input[key]||'').trim();if(v.length>max)fail(400,'Kolom '+key+' terlalu panjang.');return v;};
  const p={title:val('title',200),summary:val('summary',600),category:val('category',80)||'Cerita lapangan',author:val('author',160),language:input.language,body:cleanBody(val('body',200000),origin),cover:val('cover',300),image_alt:val('image_alt',300),image_credit:val('image_credit',200)};
  if(!['id','en'].includes(p.language))fail(400,'Bahasa tidak valid.');
  if(!p.title)fail(400,'Isi judul tulisan.');
  if(p.cover && !p.cover.startsWith(origin+'/media/'))fail(400,'Pilih foto dari media dashboard.');
  if(publish && (!p.summary || !p.author || sanitizeHtml(p.body,{allowedTags:[],allowedAttributes:{}}).trim().length<30))fail(400,'Lengkapi ringkasan, penulis, dan isi tulisan sebelum mengajukan atau menerbitkan.');
  if(publish && p.cover && !p.image_alt)fail(400,'Isi deskripsi foto utama.');
  return p;
}
export function articleMarkdown(p){
  const fields={title:p.title,slug:p.slug,date:p.published_at,modified:p.updated_at,author:p.author,summary:p.summary,category:p.category,language:p.language,status:'published',featured:false,...(p.cover?{featuredImage:p.cover,imageAlt:p.image_alt,imageCredit:p.image_credit}:{})};
  return '---\n'+Object.entries(fields).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\n\n'+p.body+'\n';
}
export function imageType(bytes){
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'image/png';
  if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
  return null;
}
