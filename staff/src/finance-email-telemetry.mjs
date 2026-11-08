export function emailScanTelemetry(result={}){
 const count=value=>Number.isSafeInteger(value)&&value>=0?value:undefined;
 return {scannedCount:count(result.scanned),matchedRecords:count(result.matchedRecords),scannedThreads:count(result.scannedThreads),queryAfter:typeof result.queryAfter==='string'&&/^\d{4}\/\d{2}\/\d{2}$/.test(result.queryAfter)?result.queryAfter:undefined,limited:result.limited===true};
}
