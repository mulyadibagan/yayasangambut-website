import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const replace=(source,from,to)=>{if(source.includes(to))return source;if(source.split(from).length!==2)throw Error('Finance email telemetry source drift');return source.replace(from,to);};
export function patchAppsScriptScan(source){
 const anchor="    records: Object.keys(latest).map(function (key) { return latest[key]; }),";
 return replace(source,anchor,anchor+"\n    scannedCount: messages.length,\n    scannedThreads: threads.length,\n    limited: threads.length >= YGFMS_CONFIG.MAX_SCAN_THREADS,");
}
export async function applyEmailTelemetry(root){
 const path=resolve(root,'app/api/requests/route.ts');let source=await readFile(path,'utf8');
 source=replace(source,'scannedThrough?: string; version?: string; error?: string','scannedThrough?: string; scannedCount?: number; scannedThreads?: number; queryAfter?: string; limited?: boolean; version?: string; error?: string');
 source=replace(source,'scanned: result.records.length,',`scanned: Number.isSafeInteger(result.scannedCount) && Number(result.scannedCount) >= 0 ? result.scannedCount : undefined,
      matchedRecords: result.records.length,
      scannedThreads: result.scannedThreads,
      queryAfter: result.queryAfter,
      limited: result.limited,`);
 source=replace(source,'hasRecords ? completedAt : retainedCursor','hasRecords && result.limited !== true ? completedAt : retainedCursor');
 await writeFile(path,source);
 const intake=resolve(root,'app/api/email-intake/route.ts');let code=await readFile(intake,'utf8');
 if(!code.includes("import {emailScanTelemetry}"))code="import {emailScanTelemetry} from '../../finance-email-telemetry.js';\n"+code;
 code=replace(code,'      scannedCount: Number(emailSync.scanned || 0),','      ...emailScanTelemetry(emailSync),');
 await writeFile(intake,code);
 await copyFile(new URL('../src/finance-email-telemetry.mjs',import.meta.url),resolve(root,'app/finance-email-telemetry.js'));
 console.log('Finance email scan metrics separated from matched documents; transaction logic unchanged.');
}
