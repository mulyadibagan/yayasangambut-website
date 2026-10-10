// Read-only GA4 reporting; WebGIS is resolved by its existing measurement ID.
const WEBGIS_MEASUREMENT_ID = 'G-ZEBSLW4ZWW';
export async function webgisProperty(env, accessToken, fetcher = fetch) {
  const headers = {Authorization: 'Bearer ' + accessToken};
  // A shared property can already report this hostname without Admin API access.
  if (/^\d+$/.test(env.GA_PROPERTY_ID || '')) {
    const probe = await fetcher('https://analyticsdata.googleapis.com/v1beta/properties/' + env.GA_PROPERTY_ID + ':runReport', {
      method: 'POST', headers: {...headers, 'Content-Type': 'application/json'},
      body: JSON.stringify({dateRanges:[{startDate:'90daysAgo',endDate:'yesterday'}],
        dimensions:[{name:'hostName'}],metrics:[{name:'screenPageViews'}],
        dimensionFilter:{filter:{fieldName:'hostName',inListFilter:{values:['webgisyg.id','www.webgisyg.id']}}}})
    });
    if (probe.ok) {
      const data=await probe.json();
      if ((data.rows||[]).some(row=>['webgisyg.id','www.webgisyg.id'].includes(row.dimensionValues?.[0]?.value)&&Number(row.metricValues?.[0]?.value)>0)) {
        return {propertyId:env.GA_PROPERTY_ID,timezone:data.metadata?.timeZone||'Asia/Jakarta'};
      }
    }
  }

  const read = async path => {
    const response = await fetcher('https://analyticsadmin.googleapis.com/v1beta/' + path, {headers});
    if (!response.ok) {
      const error=await response.json().catch(()=>({}));
      const reason=(error.error?.details||[]).map(d=>d.reason).find(Boolean)||error.error?.status||String(response.status);
      throw new Error('Akses statistik WebGIS belum tersedia ('+reason+'). Periksa Google Analytics Admin API dan akses Viewer akun layanan pada properti WebGIS.');
    }
    return response.json();
  };
  const find = async property => {
    let pageToken = '';
    do {
      const data = await read(property + '/dataStreams?pageSize=200' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''));
      const stream = (data.dataStreams || []).find(s => s.webStreamData?.measurementId === WEBGIS_MEASUREMENT_ID);
      if (stream) {
        const info = await read(property);
        return {propertyId: property.split('/')[1], streamId: stream.name.split('/').at(-1), timezone: info.timeZone || 'Asia/Jakarta'};
      }
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    return null;
  };
  if (env.GA_WEBGIS_PROPERTY_ID) {
    if (!/^\d+$/.test(env.GA_WEBGIS_PROPERTY_ID)) throw new Error('Konfigurasi properti statistik WebGIS tidak valid.');
    const found = await find('properties/' + env.GA_WEBGIS_PROPERTY_ID);
    if (!found) throw new Error('Properti WebGIS belum sesuai dengan kode pengukuran situs.');
    return found;
  }
  let pageToken = '';
  do {
    const data = await read('accountSummaries?pageSize=200' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''));
    for (const account of data.accountSummaries || []) {
      for (const property of account.propertySummaries || []) {
        const found = await find(property.property);
        if (found) return found;
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  throw new Error('Statistik WebGIS belum terhubung. Akun layanan Google Analytics perlu akses Viewer pada properti dengan kode G-ZEBSLW4ZWW.');
}
export async function analyticsReports(env, accessToken, days, site = 'website', fetcher = fetch) {
  if (!['website', 'webgis'].includes(site)) throw new Error('Situs statistik tidak dikenal.');
  const selected = site === 'webgis' ? await webgisProperty(env, accessToken, fetcher) : {propertyId: env.GA_PROPERTY_ID, timezone: 'Asia/Jakarta'};
  const report = async (dimensions, metrics, limit) => {
    const dimensionFilter = site === 'webgis' ? {andGroup: {expressions: [
      ...(selected.streamId ? [{filter: {fieldName: 'streamId', stringFilter: {matchType: 'EXACT', value: selected.streamId}}}] : []),
      {filter: {fieldName: 'hostName', inListFilter: {values: ['webgisyg.id', 'www.webgisyg.id']}}}
    ]}} : undefined;
    const response = await fetcher('https://analyticsdata.googleapis.com/v1beta/properties/' + selected.propertyId + ':runReport', {
      method: 'POST', headers: {Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json'},
      body: JSON.stringify({dateRanges: [{startDate: days + 'daysAgo', endDate: 'yesterday'}],
        dimensions: dimensions.map(name => ({name})), metrics: metrics.map(name => ({name})),
        ...(dimensionFilter ? {dimensionFilter} : {}),
        ...(limit ? {limit, orderBys: [{metric: {metricName: metrics[0]}, desc: true}]} : {orderBys: dimensions.length ? [{dimension: {dimensionName: dimensions[0]}}] : []})
      })
    });
    if (!response.ok) throw new Error('Statistik ' + (site === 'webgis' ? 'WebGIS' : 'website') + ' tidak dapat dibaca. Periksa akses Viewer properti Analytics.');
    return response.json();
  };
  const reports = await Promise.all([
    report([], ['activeUsers', 'sessions', 'screenPageViews', 'engagementRate']),
    report(['date'], ['activeUsers']), report(['pagePath'], ['screenPageViews'], 10),
    report(['sessionDefaultChannelGroup'], ['sessions'], 10),
    Promise.allSettled([report(['country'], ['activeUsers', 'sessions'], 20), report(['city', 'region', 'country'], ['activeUsers', 'sessions'], 50)])
  ]);
  return {configured: true, site, days, timezone: selected.timezone, totals: reports[0], daily: reports[1],
    pages: reports[2], sources: reports[3], countries: reports[4][0].status === 'fulfilled' ? reports[4][0].value : {unavailable: true},
    cities: reports[4][1].status === 'fulfilled' ? reports[4][1].value : {unavailable: true}};
}
