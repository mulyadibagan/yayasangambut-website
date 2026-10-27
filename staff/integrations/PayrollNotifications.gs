/** Additive YG payroll notification handler. Uses the existing authenticated doPost. */
function sendPayrollApproval_(payload) {
  const recipients = ['hisamsetiawan@yayasangambut.org', 'serena@gec.org.my', 'rienaprasiddha@yayasangambut.org'];
  if (payload.approvedBy !== 'mulyadi@yayasangambut.org' ||
      !/^payroll:[a-f0-9-]{36}$/.test(String(payload.notificationKey)) ||
      !/^[a-f0-9-]{36}$/.test(String(payload.requestId)) ||
      !/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(payload.period)) ||
      !Number.isSafeInteger(payload.total) || payload.total <= 0 ||
      !Array.isArray(payload.recipients) || payload.recipients.slice().sort().join(',') !== recipients.slice().sort().join(',') ||
      typeof payload.number !== 'string' || payload.number.length > 100 || /[\r\n]/.test(payload.number) ||
      !Number.isFinite(new Date(payload.approvedAt).getTime())) throw new Error('Notifikasi gaji tidak valid.');
  if (typeof payload.approvalPdfBase64 !== 'string' || payload.approvalPdfBase64.length > 14 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(String(payload.approvalPdfSha256)) ||
      !/^Form-Gaji-[0-9-]+-[a-f0-9]{8}\.pdf$/.test(String(payload.approvalPdfFilename))) throw new Error('PDF final tidak valid.');
  const pdfBytes = Utilities.base64Decode(payload.approvalPdfBase64);
  if (pdfBytes.length < 5 || String.fromCharCode.apply(null, pdfBytes.slice(0, 5)) !== '%PDF-' ||
      sha256Hex_(pdfBytes).toLowerCase() !== payload.approvalPdfSha256.toLowerCase()) throw new Error('Integritas PDF final gagal.');
  const pdfBlob = Utilities.newBlob(pdfBytes, MimeType.PDF, payload.approvalPdfFilename);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const key = 'YG_PAYROLL_' + payload.notificationKey;
    const fingerprint = sha256Hex_(Utilities.newBlob(JSON.stringify([payload.requestId, payload.period, payload.number, payload.total, payload.approvedAt, payload.approvedBy, recipients, payload.approvalPdfSha256])).getBytes());
    const marker = 'YG_PAYROLL_' + fingerprint.slice(0, 32);
    const prior = JSON.parse(properties.getProperty(key) || '{}');
    if (prior.fingerprint && prior.fingerprint !== fingerprint) throw new Error('Kunci notifikasi terikat pada rincian lain.');
    if (prior.messageId) return {ok:true,sent:true,messageId:prior.messageId,recipients:recipients,attachmentVerified:true,attachmentSha256:prior.attachmentSha256};
    function recover() {
      const threads = GmailApp.search('in:sent "' + marker + '"', 0, 10);
      for (const thread of threads) {
        for (const message of thread.getMessages()) {
          if (message.getPlainBody().indexOf(marker) < 0) continue;
          const actual = (message.getTo() + ',' + message.getCc()).toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [];
          if (recipients.every(function(email) { return actual.indexOf(email) >= 0; }) && actual.every(function(email) { return recipients.indexOf(email) >= 0; })) {
            const attachment = message.getAttachments().find(function(file) { return file.getName() === payload.approvalPdfFilename && sha256Hex_(file.getBytes()).toLowerCase() === payload.approvalPdfSha256.toLowerCase(); });
            if (!attachment) continue;
            const state = {attachmentSha256:payload.approvalPdfSha256,fingerprint:fingerprint,messageId:message.getId(),sentAt:new Date().toISOString()};
            properties.setProperty(key, JSON.stringify(state));
            return {ok:true,sent:true,messageId:state.messageId,recipients:recipients,attachmentVerified:true,attachmentSha256:state.attachmentSha256};
          }
        }
      }
      return null;
    }
    const recovered = recover();
    if (recovered) return recovered;
    // Do not send twice when a prior attempt may have reached Gmail.
    if (prior.startedAt) return {ok:false,sent:false,code:'uncertain',recipients:recipients};
    const approvedAt = Utilities.formatDate(new Date(payload.approvedAt), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
    const body = [
      'Yth. Hisam, Serena, dan Riena,', '',
      'Pengajuan gaji berikut telah diperiksa dan disetujui oleh Direktur Yayasan Gambut.',
      'Nomor formulir: ' + payload.number,
      'Periode gaji: ' + payload.period,
      'Total disetujui: Rp' + String(payload.total).replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
      'Disetujui oleh: ' + payload.approvedBy,
      'Waktu persetujuan: ' + approvedAt + ' WIB', '',
      'Riena dapat melanjutkan pembayaran sesuai persetujuan, kemudian mencatat realisasi dan mengunggah bukti transfer di YG Finance.',
      'Persetujuan ini bukan bukti bahwa transfer telah dilakukan.',
      'PDF formulir pengajuan gaji yang telah disetujui terlampir. Dokumen berisi rincian pengajuan tanpa rincian pemeriksaan internal.',
      'Salinan yang sama tersedia di YG Finance bagi akun yang berwenang:',
      'https://staff.yayasangambut.org/finance/payroll?id=' + payload.requestId, '',
      'Mohon jaga kerahasiaan dokumen gaji terlampir.',
      'Referensi notifikasi: ' + marker
    ].join('\n');
    properties.setProperty(key, JSON.stringify({fingerprint:fingerprint,startedAt:new Date().toISOString()}));
    GmailApp.sendEmail(recipients.join(','), '[YG Finance] Gaji ' + payload.period + ' disetujui - ' + payload.number, body, {name:'YG Finance',attachments:[pdfBlob]});
    for (let attempt = 0; attempt < 3; attempt++) {
      Utilities.sleep(700);
      const delivered = recover();
      if (delivered) return delivered;
    }
    return {ok:false,sent:false,code:'uncertain',recipients:recipients};
  } finally { lock.releaseLock(); }
}
