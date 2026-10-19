export function financeOwner(user) {
  return !!user && user.role === 'admin' && user.email?.toLowerCase() === 'mulyadi@yayasangambut.org' && !user.disabled;
}

export function financeDashboardAccess(user) {
  return financeOwner(user) || (!!user && !user.disabled && user.email?.toLowerCase() === 'rienaprasiddha@yayasangambut.org');
}
