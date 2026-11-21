import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parse} from '@babel/parser';
export function liveDonationSalary(source){
 if(source.includes('/* live-donation-salary-v2 */'))return source;
 const previouslyPatched=source.includes('/* live-donation-salary */');
 if(previouslyPatched){
  source=source.replace('\n  if(year===Number(policyMonth.slice(0,4))&&liveDonationReport&&(liveDonationReport.donations?.length||liveDonationReport.donationIssues?.length))return <DonationSalaryPanel report={liveDonationReport} />;','').replace('/* live-donation-salary */','');
 }
 const replace=(from,to)=>{if(source.split(from).length!==2)throw Error('Live donation salary source anchor changed.');source=source.replace(from,to);};
 if(!previouslyPatched){
 const directive=source.match(/^\s*(['"])use client\1;?/),at=directive?directive[0].length:0;
 source=source.slice(0,at)+"\nimport DonationSalaryPanel from './donation-salary';\n"+source.slice(at);
 replace('  const [effectiveSalaryStaff','  const [liveDonationReport,setLiveDonationReport]=useState<any>(null);\n  const [effectiveSalaryStaff');
 replace('setEffectiveSalaryStaff(data.staff);','setEffectiveSalaryStaff(data.staff);setLiveDonationReport(data);');
 }
 // Switch only the final rendered value. Returning before later useMemo/useEffect
 // calls changes the hook count when the async donation report first arrives.
 const ast=parse(source,{sourceType:'module',plugins:['typescript','jsx']}),components=new Set();
 const walk=(node,fn=null)=>{
  if(!node||typeof node!=='object')return;
  if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type))fn=node;
  if(node.type==='VariableDeclarator'&&node.id?.type==='ArrayPattern'&&node.id.elements.some(e=>e?.name==='effectiveSalaryStaff'))components.add(fn);
  for(const value of Object.values(node)){
   if(Array.isArray(value)){for(const child of value)walk(child,fn);}
   else if(value&&typeof value==='object')walk(value,fn);
  }
 };
 walk(ast);if(components.size!==1)throw Error('Live salary component missing or ambiguous.');
 const component=[...components][0],render=component?.body?.body?.filter(s=>s.type==='ReturnStatement'&&s.argument).at(-1)?.argument;
 if(!render)throw Error('Live salary final render anchor missing.');
 const condition='year===Number(policyMonth.slice(0,4))&&liveDonationReport&&(liveDonationReport.donations?.length||liveDonationReport.donationIssues?.length)';
 source=source.slice(0,render.start)+`(${condition}) ? <DonationSalaryPanel report={liveDonationReport} /> : (`+source.slice(render.start,render.end)+')'+source.slice(render.end);
 const refreshHook=`\n  useEffect(()=>{const update=(event:Event)=>{const data=(event as CustomEvent).detail;if(Array.isArray(data?.staff)){setEffectiveSalaryStaff(data.staff);setLiveDonationReport(data);}};window.addEventListener('yg-finance-report',update);return()=>window.removeEventListener('yg-finance-report',update);},[]);\n`;
 source=source.slice(0,component.body.start+1)+refreshHook+source.slice(component.body.start+1);
 return source+'\n/* live-donation-salary-v2 */\n';
}
export async function applyDonationSalary(root){
 await copyFile(new URL('../finance-ui/donation-salary.tsx',import.meta.url),resolve(root,'app/donation-salary.tsx'));
 const file=resolve(root,'app/salary-balance-enhancer.tsx');await writeFile(file,liveDonationSalary(await readFile(file,'utf8')));
}
