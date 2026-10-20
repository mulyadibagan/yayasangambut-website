export const invoiceDecimals=currency=>currency==='IDR'?0:2;
export const invoiceScale=currency=>10**invoiceDecimals(currency);
export function invoiceMinor(value,currency){
 if(!['IDR','USD','SGD'].includes(currency))throw Error('Pilih mata uang IDR, USD, atau SGD.');
 const scaled=value*invoiceScale(currency),minor=Math.round(scaled);
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12||!Number.isSafeInteger(minor)||minor/invoiceScale(currency)!==value)throw Error(currency==='IDR'?'Nominal IDR harus berupa rupiah bulat yang valid.':'Nominal '+currency+' maksimal dua angka desimal.');
 return minor;
}
export function invoiceInstallment(value,percentage,currency){
 const minor=invoiceMinor(value,currency),basis=Math.round(percentage*100);
 if(typeof percentage!=='number'||!Number.isFinite(percentage)||percentage<=0||percentage>100||basis/100!==percentage)throw Error('Persentase termin harus lebih dari 0 sampai 100, maksimal dua desimal.');
 const raw=BigInt(minor)*BigInt(basis);
 if(currency==='IDR'&&raw%10000n)throw Error('Nilai termin IDR harus menghasilkan rupiah bulat.');
 return Number((raw+(currency==='IDR'?0n:5000n))/10000n);
}
export const invoiceFormat=(minor,currency='IDR',locale='id-ID',code=false)=>new Intl.NumberFormat(locale,{...(code?{style:'currency',currency,currencyDisplay:currency==='IDR'?'symbol':'code'}:{}),minimumFractionDigits:invoiceDecimals(currency),maximumFractionDigits:invoiceDecimals(currency)}).format(minor/invoiceScale(currency));
