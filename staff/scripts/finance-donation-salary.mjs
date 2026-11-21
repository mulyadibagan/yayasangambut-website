import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export function liveDonationSalary(source){
 if(source.includes('/* live-donation-salary */'))return source;
 const replace=(from,to)=>{if(source.split(from).length!==2)throw Error('Live donation salary source anchor changed.');source=source.replace(from,to);};
 const directive=source.match(/^\s*(['"])use client\1;?/),at=directive?directive[0].length:0;
 source=source.slice(0,at)+"\nimport DonationSalaryPanel from './donation-salary';\n"+source.slice(at);
 replace('  const [effectiveSalaryStaff','  const [liveDonationReport,setLiveDonationReport]=useState<any>(null);\n  const [effectiveSalaryStaff');
 replace('setEffectiveSalaryStaff(data.staff);','setEffectiveSalaryStaff(data.staff);setLiveDonationReport(data);');
 replace('}, [savingData, year, effectiveSalaryStaff]);','}, [savingData, year, effectiveSalaryStaff]);\n  if(year===Number(policyMonth.slice(0,4))&&liveDonationReport&&(liveDonationReport.donations?.length||liveDonationReport.donationIssues?.length))return <DonationSalaryPanel report={liveDonationReport} />;');
 return source+'\n/* live-donation-salary */\n';
}
export async function applyDonationSalary(root){
 await copyFile(new URL('../finance-ui/donation-salary.tsx',import.meta.url),resolve(root,'app/donation-salary.tsx'));
 const file=resolve(root,'app/salary-balance-enhancer.tsx');await writeFile(file,liveDonationSalary(await readFile(file,'utf8')));
}
