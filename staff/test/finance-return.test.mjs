import test from 'node:test';
import assert from 'node:assert/strict';
import {financeReturnPath} from '../src/finance-return.mjs';
test('return to requested local Finance pages only',()=>{
 for(const path of ['/finance','/finance/closing-2026','/finance/payroll/report?period=2026-10'])assert.equal(financeReturnPath(path),path);
 for(const path of [null,'','https://evil.example','//evil.example','/auth/login','/finance/../../auth/login','/finance/api/requests','/finance/payroll/api/report','/finance'+String.fromCharCode(92)+'evil','/finance'+String.fromCharCode(13)])assert.equal(financeReturnPath(path),'/');
});
