/** Call from the existing authenticated doPost for action sendPjumReview. */
function sendPjumReview_(payload) {
  const recipient = String(payload.recipient || '').trim().toLowerCase();
  const key = String(payload.notificationKey || '');
  const requestId = String(payload.requestId || '');
  const number = String(payload.number || '');
  const note = String(payload.note || '');
  if (!/^[a-z0-9._%+-]+@yayasangambut\.org$/.test(recipient) ||
      !/^pjum:[a-f0-9-]{36}$/.test(key) || !/^[a-f0-9-]{36}$/.test(requestId) ||
      !number || number.length > 120 || /[\r\n]/.test(number) || note.length > 4000) {
    return {ok:false,sent:false,code:'invalid'};
  }
  const marker = 'YG_PJUM_' + key.slice(5).replace(/-/g, '');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const prior = properties.getProperty(marker);
    if (prior === 'sent') return {ok:true,sent:true,notificationKey:key};
    if (prior === 'sending') {
      const emails = GmailApp.search('in:sent to:' + recipient + ' "' + marker + '"', 0, 5);
      if (!emails.some(thread => thread.getMessages().some(message => message.getPlainBody().includes(marker)))) {
        return {ok:false,sent:false,code:'uncertain'};
      }
      properties.setProperty(marker, 'sent');
      return {ok:true,sent:true,notificationKey:key};
    }
    const body = [
      'PJUM ' + number + ' sudah diperiksa oleh Finance.',
      note ? 'Catatan pemeriksaan: ' + note : '',
      'Lihat laporan di https://staff.yayasangambut.org/finance/advances?id=' + requestId,
      'Referensi notifikasi: ' + marker
    ].filter(Boolean).join('\n\n');
    properties.setProperty(marker, 'sending');
    GmailApp.sendEmail(recipient, '[YG Finance] PJUM diperiksa - ' + number, body, {name:'YG Finance'});
    properties.setProperty(marker, 'sent');
    return {ok:true,sent:true,notificationKey:key};
  } finally { lock.releaseLock(); }
}

