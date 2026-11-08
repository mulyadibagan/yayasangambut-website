import test from 'node:test';
import assert from 'node:assert/strict';
import {attachStatementSources,validateStatements} from '../scripts/finance-bank-source-policy.mjs';
const statement={startDate:'2026-10-01',endDate:'2026-10-31',name:'October original',url:'https://drive.google.com/file/d/example/view'};
test('statement metadata changes only matching period links and preserves every financial value',()=>{
 const bank={closingBalance:25,mutations:[{postedAt:'5 Okt 2026 16:00:00',reference:'a',debit:5,credit:0,balance:25},{postedAt:'14 Sep 2026 09:00:00',reference:'b',debit:0,credit:10,balance:30}]};
 const before=structuredClone(bank),result=attachStatementSources(bank,[statement]);
 assert.equal(result.mutations[0].statementUrl,statement.url);
 assert.equal(result.mutations[1].statementUrl,undefined);
 const {statementUrl,...originalFields}=result.mutations[0];
 assert.deepEqual(originalFields,bank.mutations[0]);assert.deepEqual(bank,before);
 assert.equal(result.closingBalance,bank.closingBalance);
 assert.deepEqual(attachStatementSources(bank),bank);
});
test('invalid or ambiguous periods and unsafe URLs fail closed',()=>{
 for(const patch of [{startDate:'2026-02-30'},{endDate:'2026-09-30'},{url:'https://evil.example/file/d/example/view'},{name:''}])assert.throws(()=>validateStatements([{...statement,...patch}]));
 assert.throws(()=>validateStatements([statement,statement]),/Overlapping/);
 assert.equal(attachStatementSources({mutations:[{postedAt:'bad date'}]},[statement]).mutations[0].statementUrl,undefined);
});
