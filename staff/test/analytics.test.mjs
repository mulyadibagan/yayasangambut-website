import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsReports,webgisProperty} from '../src/analytics.mjs';
const ok=data=>Response.json(data);
function mock({found=true,geoError=false}={}){
 const reports=[],reads=[];
 const fetcher=async(url,init)=>{
  if(url.includes('accountSummaries'))return ok({accountSummaries:[{propertySummaries:[{property:'properties/111'},{property:'properties/222'}]}]});
  if(url.includes('/dataStreams')){reads.push(url);return ok({dataStreams:[{name:'properties/222/dataStreams/987',webStreamData:{measurementId:found&&url.includes('/222/')?'G-ZEBSLW4ZWW':'G-OTHER'}}]});}
  if(url.endsWith('/properties/222'))return ok({timeZone:'Asia/Jakarta'});
  assert(url.includes(':runReport'));const body=JSON.parse(init.body);if(body.dimensions[0]?.name==='hostName')return ok({rows:[]});reports.push({url,body});
  if(geoError&&body.dimensions.some(d=>d.name==='city'))return new Response('',{status:403});
  return ok({rows:[]});
 };return{fetcher,reports,reads};
}
test('WebGIS resolves existing measurement stream and filters every report',async()=>{
 const m=mock();const r=await analyticsReports({GA_PROPERTY_ID:'111'},'test',28,'webgis',m.fetcher);
 assert.equal(r.site,'webgis');assert.equal(r.days,28);assert.equal(m.reports.length,6);
 for(const {url,body} of m.reports){assert(url.includes('/222:runReport'));assert.deepEqual(body.dimensionFilter.andGroup.expressions.map(x=>x.filter.fieldName),['streamId','hostName']);assert.equal(body.dimensionFilter.andGroup.expressions[0].filter.stringFilter.value,'987');assert.deepEqual(body.dateRanges,[{startDate:'28daysAgo',endDate:'yesterday'}]);}
});
test('website reports keep their existing property and require no discovery',async()=>{
 const m=mock();await analyticsReports({GA_PROPERTY_ID:'111'},'test',7,'website',m.fetcher);
 assert.equal(m.reads.length,0);assert(m.reports.every(x=>x.url.includes('/111:runReport')&&!x.body.dimensionFilter));
});
test('unmatched property never becomes a zero visitor report',async()=>{
 const m=mock({found:false});await assert.rejects(analyticsReports({GA_PROPERTY_ID:'111'},'test',28,'webgis',m.fetcher),/belum terhubung/);assert.equal(m.reports.length,0);
});
test('optional property identifier must match WebGIS stream',async()=>{
 const m=mock({found:false});await assert.rejects(webgisProperty({GA_WEBGIS_PROPERTY_ID:'222'},'test',m.fetcher),/belum sesuai/);
});
test('location service failure does not suppress successful aggregate reports',async()=>{
 const m=mock({geoError:true});const r=await analyticsReports({GA_PROPERTY_ID:'111'},'test',90,'webgis',m.fetcher);assert.equal(r.cities.unavailable,true);assert.deepEqual(r.countries.rows,[]);assert.equal(r.configured,true);
});
test('Admin API denial cannot leak another site report',async()=>{
 await assert.rejects(analyticsReports({GA_PROPERTY_ID:'111'},'test',28,'webgis',async()=>new Response('',{status:403})),/akses Viewer/i);
});
test('property discovery follows paginated account summaries and streams',async()=>{
 const seen=[];const result=await webgisProperty({},'test',async url=>{
 seen.push(url);
 if(url.includes('accountSummaries')&&!url.includes('pageToken'))return ok({accountSummaries:[],nextPageToken:'next'});
 if(url.includes('accountSummaries'))return ok({accountSummaries:[{propertySummaries:[{property:'properties/222'}]}]});
 if(url.includes('dataStreams')&&!url.includes('pageToken'))return ok({dataStreams:[],nextPageToken:'streams'});
 if(url.includes('dataStreams'))return ok({dataStreams:[{name:'properties/222/dataStreams/987',webStreamData:{measurementId:'G-ZEBSLW4ZWW'}}]});
 return ok({timeZone:'Asia/Jakarta'});
 });assert.equal(result.propertyId,'222');assert(seen.some(u=>u.includes('pageToken=next')));assert(seen.some(u=>u.includes('pageToken=streams')));
});

test('shared website property is usable when it contains verified WebGIS hostname traffic',async()=>{
 const requests=[];const result=await analyticsReports({GA_PROPERTY_ID:'111'},'test',28,'webgis',async(url,init)=>{
 assert(!url.includes('analyticsadmin'));const body=JSON.parse(init.body);requests.push(body);
 if(body.dimensions[0]?.name==='hostName')return ok({rows:[{dimensionValues:[{value:'webgisyg.id'}],metricValues:[{value:'42'}]}],metadata:{timeZone:'Asia/Jakarta'}});
 return ok({rows:[]});
 });assert.equal(result.configured,true);assert.equal(requests.length,7);
 for(const body of requests.slice(1))assert.deepEqual(body.dimensionFilter.andGroup.expressions,[{filter:{fieldName:'hostName',inListFilter:{values:['webgisyg.id','www.webgisyg.id']}}}]);
});
