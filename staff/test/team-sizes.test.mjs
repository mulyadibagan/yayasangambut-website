import test from 'node:test';
import assert from 'node:assert/strict';
import {teamSizesAccess,teamSizesApi,validateTeamSize} from '../src/team-sizes.mjs';
test('size records are restricted to the two authorized accounts',async()=>{
 for(const user of [{email:'staff@yayasangambut.org',role:'staff'},{email:'admin@yayasangambut.org',role:'admin'},{email:'rienaprasiddha@yayasangambut.org',disabled:1}]){
  assert.equal(teamSizesAccess(user),false);
  for(const method of ['GET','POST','PUT'])await assert.rejects(teamSizesApi(new Request('https://example.org/api/team-sizes',{method}),{DB:{prepare(){throw new Error('must not access DB');}}},new URL('https://example.org/api/team-sizes'),user,{}),e=>e.status===403);
 }
 assert.equal(teamSizesAccess({email:'mulyadi@yayasangambut.org',role:'admin'}),true);
 assert.equal(teamSizesAccess({email:'rienaprasiddha@yayasangambut.org',role:'staff'}),true);
});
test('validates names and supported sizes',()=>{
 assert.deepEqual(validateTeamSize({name:'  Test   Name ',size:'xl'}),{name:'Test Name',size:'XL'});
 for(const input of [{name:'',size:'L'},{name:'Test',size:'huge'},{name:'A'.repeat(161),size:'L'}])assert.throws(()=>validateTeamSize(input),e=>e.status===400);
});
