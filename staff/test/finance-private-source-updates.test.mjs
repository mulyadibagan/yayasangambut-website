import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {applyVerifiedSourceUpdate} from '../scripts/finance-private-source-updates.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const before='const active = false;\n',after='const active = true;\n';
const patch={file:'app/salary-balance-enhancer.tsx',beforeSha256:hash(before),afterSha256:hash(after),replacements:[{from:'false',to:'true'}]};
test('applies verified update once with normalized line endings',()=>{
 assert.equal(applyVerifiedSourceUpdate(before.replaceAll('\n','\r\n'),patch),after);
 assert.equal(applyVerifiedSourceUpdate(after,patch),after);
});
test('rejects unexpected source, destination, output and ambiguous replacements',()=>{
 assert.throws(()=>applyVerifiedSourceUpdate(before+'changed',patch),/rejected/);
 assert.throws(()=>applyVerifiedSourceUpdate(before,{...patch,file:'../outside'}),/rejected/);
 assert.throws(()=>applyVerifiedSourceUpdate(before,{...patch,afterSha256:hash('wrong')}),/rejected/);
 assert.throws(()=>applyVerifiedSourceUpdate(before,{...patch,replacements:[{from:'missing',to:'true'}]}),/rejected/);
});
