const financeEmails = new Set(['mulyadi@yayasangambut.org', 'rienaprasiddha@yayasangambut.org']);

export function financeOwner(user) {
  return !!user && financeEmails.has(user.email?.toLowerCase()) && !user.disabled;
}
