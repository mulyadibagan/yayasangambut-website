export function calendarUI({api,esc,handle,notice}){
 const root=document.querySelector('#calendar-connection');
 const date=value=>value?new Date(value).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'Belum selesai';
 async function load(){
  const state=await api('/api/calendar');
  const label=!state.connected?'Belum terhubung':state.status==='reconnect'?'Perlu dihubungkan kembali':state.error?'Sinkronisasi bermasalah':state.last_synced?'Aktif':'Menunggu sinkronisasi';
  root.innerHTML=`<details><summary>Google Calendar · ${label}</summary>
  <p>Agenda yang Anda ikuti dan tenggat tugas Anda disalin ke kalender “Yayasan Gambut — Agenda &amp; Tugas”. Sinkronisasi otomatis berjalan berkala, sekitar lima menit; antrean dapat menambah waktu tunggu.</p>
  <p>Perubahan dilakukan melalui portal staf. Perubahan di Google tidak dikirim kembali ke portal.</p>
  ${state.connected?`<p>Akun: <strong>${esc(state.email)}</strong><br>Calendar terakhir: ${esc(date(state.last_synced))}</p>${state.error?`<p role="alert">${esc(state.error)}</p>`:''}
  <p>Google Tasks: ${state.tasksEnabled?'diizinkan · sinkronisasi terakhir '+esc(date(state.tasksLastSynced)):'belum dihubungkan'}</p>${state.tasksError?`<p role="alert">${esc(state.tasksError)}</p>`:''}
  <button type="button" class="secondary" data-calendar-sync>Sinkronkan sekarang</button> <button type="button" class="secondary" data-calendar-connect>Hubungkan kembali</button> <button type="button" class="secondary" data-calendar-disconnect>Putuskan koneksi</button>`:
  '<p>Izin Calendar hanya untuk kalender yang dibuat aplikasi ini.</p><button type="button" class="secondary" data-calendar-connect>Hubungkan Google Calendar</button>'}
  ${!state.tasksEnabled?'<p>Google Tasks menyalin penugasan Anda ke daftar khusus YG. Google meminta izin mengelola seluruh tugas; aplikasi ini hanya mengubah salinan tugas YG yang dikelolanya.</p><button type="button" class="secondary" data-tasks-connect>Hubungkan Calendar &amp; Google Tasks</button>':''}
  <p data-calendar-message role="status"></p></details>`;
  root.querySelector('[data-calendar-connect]').onclick=handle(async()=>{const r=await api('/api/calendar/connect','POST',{});location.assign(r.url);});
  root.querySelector('[data-tasks-connect]')?.addEventListener('click',handle(async()=>{const r=await api('/api/calendar/connect?tasks=1','POST',{});location.assign(r.url);}));
  root.querySelector('[data-calendar-sync]')?.addEventListener('click',handle(async e=>{
   const b=e.currentTarget;b.disabled=true;root.querySelector('[data-calendar-message]').textContent='Menyinkronkan…';
   try{const r=await api('/api/calendar/sync','POST',{});await load();root.querySelector('details').open=true;
    const error=[r.error,r.tasks?.error].filter(Boolean).join(' ');
    notice(error||(r.busy?'Sinkronisasi sedang berjalan.':r.pending||r.tasks?.pending?'Sebagian tersinkron. Sisanya dilanjutkan otomatis.':'Sinkronisasi selesai.'),!!error);
   }finally{b.disabled=false;}
  }));
  root.querySelector('[data-calendar-disconnect]')?.addEventListener('click',handle(async()=>{
   if(!confirm('Hentikan sinkronisasi Calendar dan Google Tasks? Salinan yang sudah ada tetap tersedia di Google.'))return;
   await api('/api/calendar','DELETE',{});await load();notice('Sinkronisasi dihentikan.');
  }));
 }
 return {load};
}

