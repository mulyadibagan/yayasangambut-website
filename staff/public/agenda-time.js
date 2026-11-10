const options=n=>Array.from({length:n},(_,i)=>{const v=String(i).padStart(2,'0');return `<option value="${v}">${v}</option>`;}).join('');
export function agendaTimeFields(key,label,part){
 return `<fieldset class="agenda-datetime"><legend>${label} (WIB)</legend><input type="hidden" name="${key}"><div class="agenda-date-controls"><label>Tanggal ${part}<input name="${key}_date" type="text" inputmode="numeric" placeholder="dd/mm/yyyy" maxlength="10" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" title="Gunakan hari/bulan/tahun, misalnya 10/11/2026" required></label><label>Jam ${part} (00–23)<select name="${key}_hour" required><option value="">Jam</option>${options(24)}</select></label><label>Menit ${part}<select name="${key}_minute" required><option value="">Menit</option>${options(60)}</select></label></div></fieldset>`;
}
export function parseAgendaDate(value){
 const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);if(!match)return '';
 const [,day,month,year]=match,y=Number(year),m=Number(month),d=Number(day);
 const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
 return y>=1&&m>=1&&m<=12&&d>=1&&d<=days[m-1]?`${year}-${month}-${day}`:'';
}
export function composeAgendaTime(date,hour,minute){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&/^(?:[01]\d|2[0-3])$/.test(hour)&&/^[0-5]\d$/.test(minute)?`${date}T${hour}:${minute}`:'';}
// Keep the existing API's local WIB string. No UTC/browser-timezone conversion.
export function bindAgendaTime(form,key){
 const field=name=>form.querySelector(`[name="${name}"]`),source=field(key),date=field(key+'_date'),hour=field(key+'_hour'),minute=field(key+'_minute');
 const sync=()=>{const iso=parseAgendaDate(date.value);date.setCustomValidity?.(date.value&&!iso?'Gunakan tanggal yang valid dalam format hari/bulan/tahun, misalnya 10/11/2026.':'');source.value=composeAgendaTime(iso,hour.value,minute.value);};
 for(const control of [date,hour,minute]){control.addEventListener('input',sync);control.addEventListener('change',sync);}
 return ()=>{const match=source.value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);[date,hour,minute].forEach((control,i)=>{control.value=match?.[i+1]||'';control.disabled=source.disabled;});if(match)date.value=match[1].split('-').reverse().join('/');date.setCustomValidity?.('');};
}
