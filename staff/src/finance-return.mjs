export function financeReturnPath(value) {
 if(typeof value!=='string'||value.length>2048||/[\\\\\x00-\x20\x7f]/.test(value))return '/';
 try{
  const url=new URL(value,'https://staff.invalid');
  if(url.origin!=='https://staff.invalid'||!value.startsWith('/')||value.startsWith('//'))return '/';
  if(url.pathname!=='/finance'&&!url.pathname.startsWith('/finance/'))return '/';
  if(url.pathname.startsWith('/finance/api/')||url.pathname.startsWith('/finance/payroll/api'))return '/';
  return url.pathname+url.search+url.hash;
 }catch{return '/';}
}
