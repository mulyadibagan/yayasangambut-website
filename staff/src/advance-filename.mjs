export function advanceFilename(request,projectSequence){
 const p=request.payload;
 if(p.project_id!=='APRIL')return request.number+'.xlsx';
 if(!Number.isSafeInteger(projectSequence)||projectSequence<1)throw Error('Urutan UM proyek tidak valid.');
 const code=p.allocations?.[0]?.code||p.items?.[0]?.activity_code||'';
 const raw=String(p.activity||'Pengajuan UM').replace(/^\s*\d+(?:\.\d+)*\s*[·:\-]\s*/,'');
 const title=raw.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,170).replace(/-$/,'');
 return String(projectSequence).padStart(2,'0')+'_UM_YG-APRDYN_'+(code?code+'-':'')+title+'.xlsx';
}
