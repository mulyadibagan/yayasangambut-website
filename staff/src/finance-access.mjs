export function financeOwner(user) {
  return !!user && user.role === 'admin' && user.email?.toLowerCase() === 'mulyadi@yayasangambut.org' && !user.disabled;
}
