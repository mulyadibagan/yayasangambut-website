export function financeOwner(user) {
  return !!user && user.role === 'admin' && user.email?.toLowerCase() === 'mulyadi@yayasangambut.org' && !user.disabled;
}
export function financeEntry(user, method = 'GET') {
  if (!financeOwner(user)) return new Response(JSON.stringify({error:'Menu Keuangan hanya dapat diakses oleh Mulyadi.'}), {status:403,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
  if (!['GET','HEAD'].includes(method)) return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  return new Response(null,{status:302,headers:{Location:'https://yg-finance-system.fpur.chatgpt.site','Cache-Control':'private, no-store'}});
}
