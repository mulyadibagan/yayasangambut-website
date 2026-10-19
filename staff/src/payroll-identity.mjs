// Display names follow the published YG team profiles. Canonical keys remain
// unchanged so historical salary allocations and payments keep their identity.
export const staffNames=Object.freeze({
 'Ainul Azizah':'Ainul Azizah, S.H.',
 'Mulyadi':'Mulyadi, S.P.',
 'Riandra Hamdani':'Riandra Hamdani, S.I.Kom.',
 'Riena Rachmatillah':'Ir. Riena Rachmatillah P.',
 'Zamharir':'Zamharir, S.Pi.'
});
export function canonicalStaffName(name){const value=String(name||'').trim();return Object.entries(staffNames).find(([key,full])=>key.toLowerCase()===value.toLowerCase()||full.toLowerCase()===value.toLowerCase())?.[0]||value;}
export const displayStaffName=name=>staffNames[canonicalStaffName(name)]||String(name||'').trim();
export function staffDescription(description,name){const key=canonicalStaffName(name),full=displayStaffName(name),text=String(description||'Gaji '+key);if(text.includes(full)||key===full)return text;return text.replace(key==='Riena Rachmatillah'?/Riena Rachmatillah(?: P\.?)?/:new RegExp(key),full);}
