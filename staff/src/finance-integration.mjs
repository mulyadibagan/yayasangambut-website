import {financeDashboardAccess} from './finance-access.mjs';

const parse=v=>typeof v==='string'?JSON.parse(v):v;
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={arc3:'ARC3',aramcophase3:'ARC3',aramcophaseiii:'ARC3',spmcls:'SPMCLS',spmclsriau:'SPMCLS',ppcf:'PPCF',ppcfpematangduku:'PPCF',penabulu:'PENABULU',penabulusmallgrants:'PENABULU',maearth:'MAEARTH',resto:'RESTO',restorasiimboputui:'RESTO',april:'APRIL',aprilgroup:'APRIL',aprildayun:'APRIL',dayunapril:'APRIL',core26:'CORE26',akcf26:'CORE26',aliansikolibricorefund2026:'CORE26',core25:'AK_CORE_2025',akcore2025:'AK_CORE_2025',aliansikolibricorefund2025:'AK_CORE_2025',spm25:'SPM25',spm2025:'SPM25',bpdpks:'BPDPKS',yg:'YG',sav:'YG',savingumumyg:'YG',operasionalyayasan:'YG'};
export const financeProject=value=>{const key=norm(value).replace(/^yg/,'');return aliases[norm(value)]||aliases[key]||String(value||'Belum dialokasikan');};
Object.assign(aliases,{operasionalyg:'YG',arc2:'ARC2',aramcophase2:'ARC2',aramcophaseii:'ARC2',arc1:'ARC1',aramcophase1:'ARC1'});
const cents=v=>{const n=Number(v??0);if(!Number.isFinite(n)||n<0||!Number.isSafeInteger(Math.round(n*100)))throw Error('Nominal Finance tidak valid.');return Math.round(n*100);};
const isPaid=r=>r.workflowPaid===true||r.status==='Dicairkan'||r.bankStatus==='Cocok'&&cents(r.bankAmount)===cents(r.advanceAmount??r.amount);
const isApproved=r=>['Disetujui','Selesai'].includes(r.status);
export function financeRecord(row){
 const r={...row};
 for(const [a,b]of Object.entries({parent_um_id:'parentUmId',advance_amount:'advanceAmount',actual_amount:'actualAmount',document_number:'documentNumber',document_url:'documentUrl',document_name:'documentName',archive_folder_url:'archiveFolderUrl',submitted_at:'submittedAt',source_email_id:'sourceEmailId',bank_status:'bankStatus',bank_amount:'bankAmount',bank_date:'bankDate',bank_reference:'bankReference'}))if(r[a]!==undefined&&r[b]===undefined)r[b]=r[a];
 return r;
}
export function mergeFinanceMetadata(archive,sources){
 const records=new Map(sources.map(raw=>{const r=financeRecord(raw);return [r.id,r];}));
 for(const raw of archive){const r=financeRecord(raw),source=records.get(r.id)||{};
  const merged={...source,...r};
  for(const field of ['parentUmId','advanceAmount','actualAmount','bankStatus','bankAmount','bankDate','bankReference','documentNumber','documentUrl','project'])if(merged[field]===undefined||merged[field]===null||merged[field]==='')merged[field]=source[field];
  if(source.type==='PJUM'&&source.bankStatus==='Cocok'&&merged.bankStatus==='Cocok'&&Number(merged.bankAmount)===Number(source.bankAmount)&&Number(source.bankAmount)>0&&Number(source.bankAmount)<=Number(source.balance))merged.sourceVerifiedReturn=true;
  records.set(r.id,merged);
 }
 for(const r of records.values())if(r.type==='PJUM'&&r.bankStatus==='Cocok'&&Number(r.bankAmount)>0&&Number(r.bankAmount)<=Number(r.balance))r.sourceVerifiedReturn=r.sourceVerifiedReturn===true||sources.some(s=>s.id===r.id&&s.bankStatus==='Cocok'&&Number(s.bankAmount)===Number(r.bankAmount));
 return [...records.values()];
}

// A read model only: identifiers link the existing records; no bank transaction
// or allocation is created from UM/PJUM amounts or uploaded transfer images.
export function integrateFinance(archive,workflows,history){
 const records=new Map(archive.map(raw=>{const r=financeRecord(raw);return [r.id,r];})),warnings=[];
 const official=new Map(),redirect=new Map(),linkedSources=new Set(workflows.map(r=>r.legacy_id).filter(Boolean));
 for(const [id,r]of records){
  if(r.type!=='UM'||!r.documentNumber||!/[/-].*20\d{2}/.test(r.documentNumber))continue;
  const key=financeProject(r.project)+'|'+norm(r.documentNumber),previous=official.get(key);
  if(!previous){official.set(key,r);continue;}
  if(cents(previous.advanceAmount??previous.amount)!==cents(r.advanceAmount??r.amount)){warnings.push({id,reason:'Nomor UM sama dengan nominal berbeda; perlu rekonsiliasi.'});continue;}
  const keep=linkedSources.has(id)||!linkedSources.has(previous.id)&&isPaid(r)&&!isPaid(previous)?r:previous,drop=keep===r?previous:r;
  records.delete(drop.id);redirect.set(drop.id,keep.id);official.set(key,keep);
 }
 for(const r of records.values())if(redirect.has(r.parentUmId))r.parentUmId=redirect.get(r.parentUmId);
 for(const row of workflows){
  if(row.status==='cancelled')continue;
  const p=parse(row.payload),report=row.report?parse(row.report):null;
  const parentId=row.legacy_id||'UM-WORKFLOW-'+row.id,old=records.get(parentId);
  if(row.legacy_id&&(!old||cents(old.advanceAmount??old.amount)!==cents(row.total))){warnings.push({id:row.id,reason:'UM asal belum cocok dengan arsip.'});continue;}
  const paid=['disbursed','pjum_draft','pjum_returned','pjum_submitted','pjum_checked','settlement','closed'].includes(row.status);
  const number=p.legacy?.number||'UM-'+String(row.created_at).slice(0,4)+'-'+String(row.seq).padStart(5,'0');
  const project=old?.project||p.project_id||p.project;
  records.set(parentId,{...old,id:parentId,type:'UM',code:old?.code||(p.allocations||[]).map(a=>a.code).join(', '),title:p.activity,project,submitter:row.creator_name,amount:row.total,advanceAmount:row.total,documentNumber:number,submittedAt:old?.submittedAt||row.created_at,workflowId:row.id,workflowStatus:row.status,workflowPaid:paid,status:paid?'Dicairkan':({draft:'Draf',returned:'Perlu Revisi',submitted:'Menunggu Pemeriksaan',checked:'Menunggu Persetujuan',approved:'Disetujui'}[row.status]||row.status),paymentDate:row.paid_date,paymentReference:row.payment_reference,documentUrl:old?.documentUrl||'/finance/advances?id='+row.id});
  if(!report)continue;
  const approved=['settlement','closed'].includes(row.status),submitted=['pjum_submitted','pjum_checked','settlement','closed'].includes(row.status);
  const id='PJUM-WORKFLOW-'+row.id;
  let previousReport=records.get(id);
  for(const [otherId,other]of records){
   if(otherId===id||other.type!=='PJUM'||other.parentUmId!==parentId||!report.report_number||norm(other.documentNumber||other.pjumNumber)!==norm(report.report_number))continue;
   if(cents(other.actualAmount??other.amount)===cents(row.actual)){previousReport={...other,...previousReport};records.delete(otherId);redirect.set(otherId,id);}
   else warnings.push({id:otherId,reason:'Nomor PJUM sama tetapi nominal berbeda; perlu rekonsiliasi.'});
  }
  records.set(id,{...previousReport,id,type:'PJUM',code:[...new Set((report.items||[]).map(i=>i.activity_code).filter(Boolean))].join(', '),parentUmId:parentId,title:p.activity,project,submitter:row.creator_name,amount:row.actual,actualAmount:row.actual,advanceAmount:row.total,balance:row.total-row.actual,documentNumber:report.report_number||number,submittedAt:report.report_date,workflowId:row.id,workflowStatus:row.status,submissionVerified:submitted,status:approved?'Disetujui':row.status==='pjum_checked'?'Menunggu Persetujuan':row.status==='pjum_submitted'?'Dilaporkan ke Riena':row.status==='pjum_returned'?'Perlu Revisi':'Draf',documentUrl:previousReport?.documentUrl||'/finance/advances?id='+row.id,settlementReference:row.status==='closed'?row.settlement_reference:null});
 }
 const list=[...records.values()],groups=new Map(),usedRefunds=new Set(),allocatedReturns=new Map();
 const group=value=>{const id=financeProject(value);if(!groups.has(id))groups.set(id,{id,umPaid:0,pjumApproved:0,pjumUnderReview:0,pjumDraft:0,refundVerified:0,reimbursementVerified:0,outstanding:0,overrun:0,cashIn:0,cashOut:0,netCash:0,requests:[]});return groups.get(id);};
 for(const um of list.filter(r=>r.type==='UM')){
  const g=group(um.project),reports=list.filter(p=>p.type==='PJUM'&&p.parentUmId===um.id);
  const approved=reports.filter(isApproved),review=reports.filter(p=>!isApproved(p)&&!['Draf','Perlu Revisi','Ditolak','Dibatalkan'].includes(p.status)&&(p.submissionVerified===true||['Dilaporkan ke Riena','Menunggu Persetujuan'].includes(p.status)));
  const a=cents(um.advanceAmount??um.amount),realized=approved.reduce((n,r)=>n+cents(r.actualAmount??r.amount),0);
  const pending=review.reduce((n,r)=>n+cents(r.actualAmount??r.amount),0),draft=reports.filter(r=>r.status==='Draf'||r.status==='Perlu Revisi').reduce((n,r)=>n+cents(r.actualAmount??r.amount),0);
  let refund=0,reimbursement=0;
  for(const r of reports.filter(p=>!['Draf','Ditolak','Dibatalkan'].includes(p.status))){
   const shortfall=Math.max(0,cents(r.actualAmount??r.amount)-cents(r.advanceAmount??um.amount));
   if(shortfall&&isApproved(r)){
    const reference=r.settlementReference||r.bankReference;
    const matched=(history?.rows||[]).filter(b=>reference&&norm(b.reference)===norm(reference)&&financeProject(b.project)===g.id&&b.debit===shortfall);
    if(matched.length===1&&!usedRefunds.has(matched[0].id)){reimbursement+=shortfall;usedRefunds.add(matched[0].id);}
    else warnings.push({id:r.id,reason:'Pelunasan kekurangan belum cocok dengan mutasi bank.'});
   }
   const expected=Math.max(0,cents(r.advanceAmount??um.amount)-cents(r.actualAmount??r.amount));if(!expected)continue;
   if(r.sourceVerifiedReturn===true&&r.bankStatus==='Cocok'&&cents(r.bankAmount)>0&&cents(r.bankAmount)<=expected&&!usedRefunds.has('source:'+r.id)){refund+=cents(r.bankAmount);usedRefunds.add('source:'+r.id);continue;}
   const links=(history?.verifiedReturns||[]).filter(l=>(l.pjumId===r.id||redirect.get(l.pjumId)===r.id)&&(l.umId===um.id||redirect.get(l.umId)===um.id)&&financeProject(l.project)===g.id);
   let validated=0;
   for(const link of links){
    const amount=cents(link.amount);
    const matches=history.rows.filter(b=>String(b.year)==='2026'&&b.id.split(':')[1]===String(link.index)&&norm(b.reference)===norm(link.reference)&&financeProject(b.project)===g.id&&b.credit>=amount);
    if(matches.length!==1||usedRefunds.has(matches[0].id)||validated+amount>expected)continue;
    const bank=matches[0],claimed=allocatedReturns.get(bank.id)||0;if(claimed+amount>bank.credit)continue;
    allocatedReturns.set(bank.id,claimed+amount);validated+=amount;
   }
   if(validated){refund+=validated;continue;}
   const reference=r.settlementReference||r.bankReference;
   const matched=(history?.rows||[]).filter(b=>reference&&norm(b.reference)===norm(reference)&&financeProject(b.project)===g.id&&b.credit===expected);
   if(matched.length===1&&!usedRefunds.has(matched[0].id)&&!allocatedReturns.has(matched[0].id)){refund+=expected;usedRefunds.add(matched[0].id);}
   else if(!history&&r.bankStatus==='Cocok'&&cents(r.bankAmount)===expected&&!usedRefunds.has('archive:'+reference)){refund+=expected;usedRefunds.add('archive:'+reference);}
   else warnings.push({id:r.id,reason:'Pengembalian sisa UM belum cocok dengan mutasi bank.'});
  }
  const paid=isPaid(um);g.umPaid+=paid?a:0;g.pjumApproved+=realized;g.pjumUnderReview+=pending;g.pjumDraft+=draft;g.refundVerified+=refund;g.reimbursementVerified+=reimbursement;
  g.outstanding+=paid?Math.max(0,a-realized-refund):0;g.overrun+=paid?Math.max(0,realized-a-reimbursement):0;
  g.requests.push({id:um.id,number:um.documentNumber||um.code||um.id,title:um.title,status:um.workflowStatus||um.status,amount:a,paid,approved:realized,underReview:pending,refund,outstanding:paid?Math.max(0,a-realized-refund):0,url:um.workflowId?'/finance/advances?id='+um.workflowId:um.documentUrl||null});
 }
 const linked=new Set(list.filter(r=>r.type==='UM').map(r=>r.id));
 for(const r of list.filter(r=>r.type==='PJUM'&&!linked.has(r.parentUmId)))warnings.push({id:r.id,reason:'PJUM belum memiliki UM asal yang cocok.'});
 const seen=new Set();
 for(const row of history?.rows||[]){if(!row.id||seen.has(row.id))throw Error('Identitas mutasi bank ganda.');seen.add(row.id);if(!Number.isSafeInteger(row.credit)||!Number.isSafeInteger(row.debit)||row.credit<0||row.debit<0)throw Error('Nominal mutasi bank tidak valid.');const g=group(row.project);g.cashIn+=row.credit;g.cashOut+=row.debit;}
 const projects=[...groups.values()].map(g=>({...g,netCash:g.cashIn-g.cashOut})).sort((a,b)=>a.id.localeCompare(b.id));
 const keys=['umPaid','pjumApproved','pjumUnderReview','pjumDraft','refundVerified','reimbursementVerified','outstanding','overrun','cashIn','cashOut','netCash'];
 const totals=Object.fromEntries(keys.map(k=>[k,projects.reduce((n,p)=>n+p[k],0)]));
 const coverage=history?.coverage||[];
 for(const c of coverage){
  if(c.difference!==0){
   if(c===coverage.at(-1))throw Error('Rekonsiliasi mutasi bank periode terakhir belum cocok: '+c.year);
   warnings.push({id:String(c.year),reason:'Register bank historis memiliki selisih rekonsiliasi yang belum diselesaikan.',difference:c.difference});
  }
  const yearRows=(history?.rows||[]).filter(r=>String(r.year)===String(c.year));
  if(yearRows.reduce((n,r)=>n+r.credit,0)!==c.incoming||yearRows.reduce((n,r)=>n+r.debit,0)!==c.outgoing)throw Error('Jumlah arus kas berbeda dari register bank.');
  if(c.carryDifference)warnings.push({id:String(c.year),reason:'Saldo awal tahun berbeda dari saldo akhir tahun sebelumnya.'});
 }
 return {records:list,projects,totals,warnings,cashAvailable:!!history,bankAsOf:history?.to||null,bankClosing:coverage.at(-1)?.ending??null,coverage};
}

export async function readIntegratedFinance(env,archive){
 if(!archive)archive=(await env.DB.prepare('SELECT * FROM finance_requests').all()).results;
 const workflows=(await env.DB.prepare('SELECT * FROM yg_advance_requests ORDER BY seq').all()).results;
 const setting=await env.DB.prepare("SELECT setting_value FROM finance_settings WHERE setting_key='finance_bank_history_v1'").first();
 const reconciliation=await env.DB.prepare("SELECT setting_value FROM finance_settings WHERE setting_key='finance_reconciliation_v1'").first();
 const sourceMetadata=await env.DB.prepare("SELECT setting_value FROM finance_settings WHERE setting_key='finance_archive_metadata_v1'").first();
 const history=setting?JSON.parse(setting.setting_value):null;
 if(history)history.verifiedReturns=reconciliation?(JSON.parse(reconciliation.setting_value).umReturns||[]):[];
 const combined=mergeFinanceMetadata(archive,sourceMetadata?JSON.parse(sourceMetadata.setting_value):[]);
 return {...integrateFinance(combined,workflows,history),asOf:new Date().toISOString()};
}
export async function financeIntegrationRoute(req,env,user){
 if(!financeDashboardAccess(user))return new Response('Akses ditolak',{status:403});
 if(req.method!=='GET')return new Response('Metode tidak didukung',{status:405,headers:{Allow:'GET'}});
 const data=await readIntegratedFinance(env);
 return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
}
