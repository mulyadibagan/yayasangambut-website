import test from 'node:test';
import assert from 'node:assert/strict';
import {integrateAdditionalSalaryRows} from '../scripts/finance-salary-list.mjs';
test('additional staff joins the salary table without altering existing rows, totals or unrelated tables',()=>{
 const unrelated='<table><tbody><tr><td>Other</td></tr></tbody></table>';
 const existing='<tr><td>Existing staff</td><td>100</td></tr><tr><td>Total active</td><td>100</td></tr>';
 const source=unrelated+'<h2>Posisi gaji per staf</h2><table><tbody>'+existing+'</tbody></table>';
 const result=integrateAdditionalSalaryRows(source);
 assert(result.includes(unrelated));assert(result.includes('<tbody><AdditionalSalaryRows existingNames={Object.keys(STAFF_POLICY).map(staffLabel)} />'+existing));
 assert.equal(integrateAdditionalSalaryRows(result),result);assert.throws(()=>integrateAdditionalSalaryRows(unrelated),/insertion point missing/);
});
