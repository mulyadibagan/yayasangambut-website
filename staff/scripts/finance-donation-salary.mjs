import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parse} from '@babel/parser';

// Keep the existing salary table, detail rows and simulations. Reconcile only
// their input rows with the same live report used by payroll and donations.
export function liveDonationSalary(source){
 if(source.includes('/* live-donation-salary-v3 */'))return source;
 const replace=(from,to)=>{if(source.split(from).length!==2)throw Error('Live salary input anchor changed.');source=source.replace(from,()=>to);};
 const directive=source.match(/^\s*(['"])use client\1;?/),at=directive?directive[0].length:0;
 source=source.slice(0,at)+"\nimport {liveSalaryRows,liveSalaryPosition} from './donation-salary-data.js';\n"+source.slice(at);
 replace('  const [effectiveSalaryStaff','  const [liveDonationReport,setLiveDonationReport]=useState<any>(null);\n  const [effectiveSalaryStaff');
 replace('setEffectiveSalaryStaff(data.staff);','setEffectiveSalaryStaff(data.staff);setLiveDonationReport(data);');
 replace('[savingData, year, effectiveSalaryStaff]','[savingData, year, effectiveSalaryStaff, liveDonationReport]');
 const ast=parse(source,{sourceType:'module',plugins:['typescript','jsx']}),edits=[];let component,rows=0;
 const walk=(node,fn=null)=>{
  if(!node||typeof node!=='object')return;
  if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type))fn=node;
  if(node.type==='VariableDeclarator'&&node.id?.type==='ArrayPattern'&&node.id.elements.some(e=>e?.name==='effectiveSalaryStaff'))component=fn;
  if(node.type==='VariableDeclarator'&&node.id?.name==='rows'&&node.init){rows++;edits.push({start:node.init.start,end:node.init.end,value:`liveSalaryRows(${source.slice(node.init.start,node.init.end)},liveDonationReport,year,canonicalSalaryName)`});}
  if(node.type==='CallExpression'&&node.callee?.name==='linkedSystemPosition')edits.push({start:node.start,end:node.end,value:`liveSalaryPosition(${source.slice(node.start,node.end)},liveDonationReport,year)`});
  for(const value of Object.values(node)){
   if(Array.isArray(value)){for(const child of value)walk(child,fn);}
   else if(value&&typeof value==='object')walk(value,fn);
  }
 };
 walk(ast);if(!component||rows!==1)throw Error('Live salary input component missing or ambiguous.');
 const refresh=`\n  useEffect(()=>{const update=(event:Event)=>{const data=(event as CustomEvent).detail;if(Array.isArray(data?.staff)){setEffectiveSalaryStaff(data.staff);setLiveDonationReport(data);}};window.addEventListener('yg-finance-report',update);return()=>window.removeEventListener('yg-finance-report',update);},[]);\n`;
 edits.push({start:component.body.start+1,end:component.body.start+1,value:refresh});
 for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.value+source.slice(e.end);
 return source+'\n/* live-donation-salary-v3 */\n';
}
export async function applyDonationSalary(root){
 await copyFile(new URL('../finance-ui/donation-salary-data.js',import.meta.url),resolve(root,'app/donation-salary-data.js'));
 const file=resolve(root,'app/salary-balance-enhancer.tsx');await writeFile(file,liveDonationSalary(await readFile(file,'utf8')));
}
