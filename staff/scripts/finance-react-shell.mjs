import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {prepareAprilCash} from './finance-april-cash.mjs';

// Render the same navigation, branding and stylesheet on the server and client.
// Never rewrite React-owned body markup at the staff service boundary.
export function financeLayout(source){
 if(source.includes("import FinanceStaffTools from './finance-staff-tools'"))return source;
 if(!source.includes('{children}')||!/<body\b/.test(source)||!source.includes('</body>'))throw Error('Finance React layout anchor missing.');
 source=source.replace(/<a\b(?=[^>]*href=["']\/["'])[^>]*>\s*(?:←|&larr;|&#8592;)?\s*(?:Dashboard Staf YG|Portal staf YG)\s*<\/a>/g,'');
 source="import FinanceNotifications from './finance-notifications';\nimport ProjectAdvancePanel from './project-advances';\nimport FinanceStaffTools from './finance-staff-tools';\nimport './finance-staff-shell.css';\nimport './finance-notifications.css';\n"+source;
 source=source.replace('{children}','<FinanceStaffTools /><FinanceNotifications /><ProjectAdvancePanel />\n        {children}');
 source=source.replace(/metadataBase:\s*new URL\([^)]*\)/,'metadataBase: new URL("https://staff.yayasangambut.org")');
 source=source.replace(/(["'])\/favicon\.(?:svg|ico)\1/g,'"/favicon.png?v=yg-20261019-1"');
 source=source.replace(/(["'])\/og\.png\1/g,'"https://staff.yayasangambut.org/brand/yayasan-gambut-logo.png"');
 return source;
}

export async function applyFinanceReactShell(root){
 await copyFile(new URL('../finance-ui/finance-notifications.tsx',import.meta.url),resolve(root,'app/finance-notifications.tsx'));
 await copyFile(new URL('../public/finance-notifications.css',import.meta.url),resolve(root,'app/finance-notifications.css'));
 await copyFile(new URL('../finance-ui/project-advances.tsx',import.meta.url),resolve(root,'app/project-advances.tsx'));
 const layout=resolve(root,'app/layout.tsx'),dashboard=resolve(root,'app/finance-archive-dashboard.tsx');
 const source=await readFile(layout,'utf8'),page=await prepareAprilCash(root,await readFile(dashboard,'utf8'));
 await writeFile(layout,financeLayout(source));
 await writeFile(resolve(root,'app/finance-staff-tools.tsx'),`export default function FinanceStaffTools(){return <nav className="yg-finance-tools" aria-label="Layanan Finance"><a className="yg-finance-portal" href="/">← Portal staf YG</a><div><a href="/finance/donations">Donasi</a><a href="/finance/invoices">Invoice</a><a href="/finance/advances">Pengajuan UM &amp; PJUM</a><a href="/finance/payroll">Pengajuan gaji</a><a href="/finance/email-sync">Sinkronisasi email <span aria-hidden="true">↗</span></a></div></nav>;}`);
 await copyFile(new URL('../public/finance-shell.css',import.meta.url),resolve(root,'app/finance-staff-shell.css'));
 await writeFile(dashboard,page.replace(/src="\/logo-yayasan-gambut\.png"\s+alt="Logo Yayasan Gambut"/g,'src="/brand/yayasan-gambut-logo.png" alt="Logo Yayasan Gambut" style={{width:46,height:46,objectFit:"contain"}}'));
 console.log('Finance navigation and branding prepared inside the React layout; finance data unchanged.');
}
