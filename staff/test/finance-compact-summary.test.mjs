import test from 'node:test';
import assert from 'node:assert/strict';
import {compactFinanceDashboard} from '../scripts/finance-compact-summary.mjs';
test('replace stale status cards and collapse detailed sections while preserving their content',()=>{
 const source='const bankTotal=123;export default()=> <main><section className="review-attention" aria-label="Status pemeriksaan"><section>Old totals</section></section><section className="project-review"><section>Keep project figures</section></section><section className="recent-finance">Keep recent activity</section></main>';
 const output=compactFinanceDashboard(source);
 assert.match(output,/<FinanceReportingSummary \/>/);assert.doesNotMatch(output,/Old totals/);
 assert.match(output,/<details className="yg-summary-details"><summary>Posisi dana per proyek<\/summary><section/);
 assert.match(output,/Keep project figures/);assert.match(output,/Keep recent activity/);assert.match(output,/const bankTotal=123/);
 assert.equal(compactFinanceDashboard(output),output);
 const client=compactFinanceDashboard("'use client';\n"+source);assert.match(client,/^'use client';\nimport FinanceReportingSummary/);
});
test('source drift fails explicitly instead of appending another panel',()=>{
 assert.throws(()=>compactFinanceDashboard('<main/>'),/missing or ambiguous/);
});
