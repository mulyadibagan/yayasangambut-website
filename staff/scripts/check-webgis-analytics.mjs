import {SignJWT,importPKCS8} from 'jose';
import {analyticsReports} from '../src/analytics.mjs';
try {
 if(!process.env.GA_SERVICE_ACCOUNT_EMAIL||!process.env.GA_SERVICE_ACCOUNT_KEY)throw new Error('Akun layanan Analytics belum dikonfigurasi.');
 const key=await importPKCS8(process.env.GA_SERVICE_ACCOUNT_KEY,'RS256');
 const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/analytics.readonly'}).setProtectedHeader({alg:'RS256'}).setIssuer(process.env.GA_SERVICE_ACCOUNT_EMAIL).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(key);
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
 if(!response.ok)throw new Error('Koneksi akun layanan Analytics belum berhasil.');
 const {access_token}=await response.json();
 const result=await analyticsReports(process.env,access_token,7,'webgis');
 console.log('WEBGIS_ANALYTICS_READY: verified measurement stream, hostname filters and six reports. Daily rows: '+(result.daily.rows||[]).length);
} catch(error) {
 console.log('WEBGIS_ANALYTICS_PENDING: '+error.message);
}
