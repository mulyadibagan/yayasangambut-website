import {fail} from './core.mjs';

export const advanceProjects=[
 ['ARC3','Aramco Phase 3','aramco-phase-3'],['SPMCLS','SPM-CLS','spm-cls'],
 ['PENABULU','Penabulu Small Grants','penabulu'],['PPCF','PPCF Pematang Duku','ppcf'],
 ['CORE26','Aliansi Kolibri · Core Fund 2026','kolibri-core-2026'],
 ['RESTO','Restorasi Imbo Putui','restorasi-imbo-putui'],['MAEARTH','Ma Earth','ma-earth'],
 ['SPM25','SPM 2025','spm-2025'],['BPDPKS','BPDPKS · Bengkalis & Siak','bpdpks'],['AK_CORE_2025','Aliansi Kolibri · Core Fund 2025','kolibri-core-2025'],
 ['APRIL','APRIL Group',null],['YG','Operasional Yayasan',null]
].map(([id,name,slug])=>({id,name,slug,closed:['PPCF','SPM25','BPDPKS','AK_CORE_2025'].includes(id),url:slug?'/finance/projects/'+slug+'?year=2026':null}));
const plain=s=>String(s||'').replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/\s+/g,' ').trim();
export function rupiah(s){const value=plain(s).match(/Rp\s*(-?[\d.]+)(?:,(\d{1,2}))?/);return value?Math.round(Number(value[1].replaceAll('.',''))+Number('0.'+(value[2]||'0'))):null;}
export function parseProjectActivities(html){
 const rows=[];
 for(const match of html.matchAll(/<article\b[^>]*class="[^"]*\baramco-activity-card\b[^"]*"[^>]*>([\s\S]*?)<\/article>/g)){
  const card=match[1],main=card.match(/class="aramco-activity-main"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
  const code=plain(main.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1]),name=plain(main.match(/<b[^>]*>([\s\S]*?)<\/b>/)?.[1]);
  const budgetCell=card.match(/class="aramco-budget-cell"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
  const budget=rupiah(budgetCell),um=rupiah(card.match(/data-label="UM kumulatif"[^>]*>([\s\S]*?)<\/div>/)?.[1])??0;
  const realized=rupiah(card.match(/data-label="Realisasi(?: kumulatif)?"[^>]*>([\s\S]*?)<\/div>/)?.[1])??0;
  if(!code||!name||budget===null||rows.some(r=>r.code===code))continue;
  const management=code==='MGT'||code==='5.1'||/klaim biaya staf proyek/i.test(main);
  rows.push({code,name,description:plain(main.replace(/<code[^>]*>[\s\S]*?<\/code>/,'')).slice(0,500),budget,legacyUm:um,legacyRealized:realized,legacyCommitted:Math.max(um,realized),management});
 }
 // Other dossier pages present their history as a table. A missing RAB is
 // represented by null, never by the prior UM amount or a fabricated ceiling.
 for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){
  const cells=[...match[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/g)].map(m=>m[1]);
  const code=plain(cells[0]?.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1]);
  if(!code||rows.some(r=>r.code===code)||cells.length<8)continue;
  const name=plain(cells[1]),hasBudget=cells.length>=10,budget=hasBudget?rupiah(cells[4]):null;
  const um=rupiah(cells[hasBudget?5:3])??0,realized=rupiah(cells[hasBudget?6:4])??0;
  rows.push({code,name,description:name,budget,legacyUm:um,legacyRealized:realized,legacyCommitted:Math.max(um,realized),management:/^(?:II|MGT)$/.test(code)||/^gaji tim/i.test(name)});
 }
 return rows;
}
export async function projectSource(env,u,projectId){
 const project=advanceProjects.find(p=>p.id===projectId);if(!project)fail(400,'Pilih proyek yang tersedia.');
 if(!project.slug)return {...project,activities:[],unconfigured:true};
 if(!env.FINANCE)fail(503,'Sumber anggaran proyek belum tersambung.');
 // Deliberately return only activity codes, approved ceilings and commitment
 // totals to the three authorized applicants. No bank ledger or other staff data.
 const response=await env.FINANCE.fetch(new Request(env.APP_ORIGIN+project.url,{headers:{'x-yg-finance-user':env.ADMIN_EMAIL||u.email,'oai-authenticated-user-email':env.ADMIN_EMAIL||u.email,'oai-authenticated-user-id':u.id}}));
 if(!response.ok)fail(503,'Rincian anggaran proyek belum dapat dibaca.');
 const activities=parseProjectActivities(await response.text());
 return {...project,activities,unconfigured:!activities.length,missingBudget:!activities.length||activities.some(a=>a.budget===null),asOf:new Date().toISOString()};
}
export const reservedStatus=s=>!['draft','returned','cancelled'].includes(s);
export function projectCommitments(source,requests,excludeId){
 return {...source,activities:source.activities.map(a=>{
  let draft=0,pending=0,disbursed=0;
  for(const request of requests){if(request.id===excludeId||request.status==='cancelled')continue;const p=typeof request.payload==='string'?JSON.parse(request.payload):request.payload;if(p.project_id!==source.id)continue;
   const allocation=p.allocations?.find(x=>x.code===a.code);if(!allocation)continue;
   if(['draft','returned'].includes(request.status))draft+=allocation.amount;
   else if(['submitted','checked','approved'].includes(request.status))pending+=allocation.amount;
   else disbursed+=allocation.amount;
  }
  return {...a,draft,pending,disbursed,remaining:source.closed?0:a.budget===null?null:Math.max(0,a.budget-a.legacyCommitted-pending-disbursed)};
 })};
}
export async function linkAdvanceProject(env,u,data){
 if(!data.project_id)return data;
 const source=await projectSource(env,u,data.project_id);data.project=source.name;if(source.closed)fail(400,'Proyek sudah ditutup dan tidak menerima pengajuan UM baru.');
 if(source.unconfigured){data.allocations=[];return data;}
 const amounts=new Map();for(const item of data.items){if(!item.activity_code)fail(400,'Pilih kode kegiatan untuk setiap baris biaya.');amounts.set(item.activity_code,(amounts.get(item.activity_code)||0)+item.subtotal);}
 data.allocations=[...amounts].map(([code,amount])=>{
  const row=source.activities.find(a=>a.code===code)||(source.missingBudget?{name:data.activity,budget:null,legacyCommitted:0}:null);if(!row||row.management)fail(400,'Pos kegiatan tidak tersedia untuk UM. Biaya staf diajukan melalui pengajuan gaji.');
  return {code,name:row.name,amount,budget:row.budget,legacyCommitted:row.legacyCommitted};
 });
 return data;
}
