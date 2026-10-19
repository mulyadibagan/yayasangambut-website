import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export async function applyTerminDisplay(root){
 const path=resolve(root,'app/aramco-activity-review.tsx');
 let source=(await readFile(path,'utf8')).replace(/\r\n/g,'\n');
 if(source.includes('const terminProgress='))return;
 const replace=(from,to)=>{if(source.split(from).length!==2)throw Error('Finance termin display source drift');source=source.replace(from,()=>to);};
 replace("    const status=row.code==='5.1'",`    const terminProgress=row.code==='4.1'?allUms.filter(um=>activityCodesForRecord(um).includes(row.code)).map(um=>{
     const termin=um.title.match(/termin\\s*(\\d+)/i)?.[1];
     const reports=allPjums.filter(report=>report.parentUmId===um.id&&report.submissionVerified===true);
     const reported=reports.reduce((sum,report)=>sum+Number(report.actualAmount??report.amount)+Math.max(0,Number(report.balance||0)),0);
     const complete=Number(um.amount)>0&&reported>=Number(um.amount)-1;
     return {termin,complete,paid:um.bankStatus==='Cocok'&&!!um.bankDate};
    }).filter(item=>item.termin).sort((a,b)=>Number(a.termin)-Number(b.termin)):[];
    const firstReported=terminProgress.some(item=>item.termin==='1'&&item.complete);
    const secondPending=terminProgress.some(item=>item.termin==='2'&&item.paid&&!item.complete);
    const awaitingSecond=firstReported&&secondPending&&row.outstanding>0;
    const status=awaitingSecond?'Menunggu PJUM termin 2':row.code==='5.1'`);
 replace("const tone=row.outstanding>0?'bad'","const tone=awaitingSecond?'warn':row.outstanding>0?'bad'");
 replace("{status}</span>{row.returned", "{status}</span>{awaitingSecond&&<><small>UM termin 1 sudah dilaporkan</small><small>UM termin 2 sudah cair</small></>}{row.returned");
 replace("<small>Belum dilaporkan {money(row.outstanding)}</small>","<small>{awaitingSecond?'Menunggu PJUM termin 2':'Belum dilaporkan'} {money(row.outstanding)}</small>");
 replace("<small>Belum dipertanggungjawabkan</small>","<small>{awaitingSecond?'Menunggu PJUM termin 2':'Belum dipertanggungjawabkan'}</small>");
 await writeFile(path,source);
}

