// Salary advances are already deducted in the general ledger. Only outstanding
// negative project positions are reclassified here; this never writes a journal.
export function availableCash(position, projects) {
 const cents = value => {if(!Number.isFinite(value))throw Error('Invalid cash position');return Math.round(value*100);};
 const projectAdvance=projects.reduce((sum,p)=>sum+Math.max(0,-cents(p.balance)),0);
 const projectAvailable=projects.reduce((sum,p)=>sum+Math.max(0,cents(p.balance)),0);
 const generalAvailable=cents(position.generalSaving)-projectAdvance;
 const savingAvailable=generalAvailable+cents(position.salaryReserve);
 const totalCash=savingAvailable+projectAvailable+cents(position.pendingStaffCash??0);
 return {projectAdvance:projectAdvance/100,projectAvailable:projectAvailable/100,generalAvailable:generalAvailable/100,savingAvailable:savingAvailable/100,totalCash:totalCash/100};
}
