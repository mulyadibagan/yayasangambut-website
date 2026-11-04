import test from 'node:test';
import assert from 'node:assert/strict';
import {bankSourceHref,bankSourceRow} from '../scripts/finance-bank-source.mjs';
test('source permalink resolves exact existing receipt without changing any balances',()=>{
 const row={postedAt:'14 Sep 2026 09:08:18',reference:'bank-ref',credit:100,debit:0,balance:200};
 const rows=[row,{...row,postedAt:'15 Sep 2026 09:08:18',balance:300}];
 const before=structuredClone(rows);
 const url=new URL(bankSourceHref(row),'https://staff.yayasangambut.org');
 assert.equal(url.pathname,'/finance/bank-source');
 const params=Object.fromEntries(url.searchParams);
 assert.equal(bankSourceRow(rows,params),row);
 assert.equal(bankSourceRow(rows,{...params,credit:'101'}),null);
 assert.equal(bankSourceRow([...rows,row],params),null);
 assert.deepEqual(rows,before);
 assert.equal(bankSourceHref({date:row.postedAt,reference:row.reference,amount:row.credit}),bankSourceHref(row));
});
