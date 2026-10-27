import test from 'node:test';import assert from 'node:assert/strict';
import {solve,parse,format} from '../extension/math.js';
const cases=[
 ['x^5-x^4+3x-3','(x-1)*(x^4+3)'],
 ['x^6-x^4+3x^2-3','(x-1)*(x+1)*(x^4+3)'],
 ['x^5+2x^4+5x+10','(x+2)*(x^4+5)'],
 ['x^4+4','(x^2+2x+2)*(x^2-2x+2)'],
 ['x^4+5x^2+4','(x^2+1)*(x^2+4)'],
 ['x^8+5x^4+4','(x^2+2x+2)*(x^2-2x+2)*(x^4+1)'],
 ['x^4+2x^2+1','(x^2+1)^2'],
 ['x^6+3x^4+3x^2+1','(x^2+1)^3'],
 ['x^8+4x^6+6x^4+4x^2+1','(x^2+1)^4'],
 ['-6x^5+6x^4-18x+18','-6*(x-1)*(x^4+3)'],
 ['x^5/2-x^4/2+3x/2-3/2','(1/2)*(x-1)*(x^4+3)'],
 ['2x^5-x^4+6x-3','(2x-1)*(x^4+3)'],
 ['x^8+1','x^8+1'],['x^4+3','x^4+3'],
 ['x^6-1','(x-1)*(x+1)*(x^2+x+1)*(x^2-x+1)']
];
for(const [expression,expected]of cases)test('certified rational factorization '+expression,()=>{
 const r=solve(expression,'factor');assert.equal(r.status,'solved',JSON.stringify(r));assert.equal(format(parse(r.answer)),format(parse(expression)));assert.equal(format(parse(r.answer)),format(parse(expected)));
 // Specifically require nontrivial no-rational-root quartics to be split.
 if(expression==='x^4+4')assert.equal((r.answer.match(/x\^2/g)||[]).length,2,r.answer);
 if(expression==='x^4+5x^2+4')assert.equal((r.answer.match(/x\^2/g)||[]).length,2,r.answer);
});
test('pictured residual has an exact Eisenstein certificate',()=>{const r=solve('x^5-x^4+3x-3','factor');assert.equal(r.factorDomain,'rational');assert.match(r.steps.join(' '),/Eisenstein.*3/);});
test('bounded exhaustive search can certify an irreducible degree-eight factor',()=>{const r=solve('x^8+1','factor');assert.equal(r.factorDomain,'rational');assert.match(r.steps.join(' '),/exhaustive.*degree 4/);assert.ok(r.factorizationCandidates<=20000);});
test('search exhaustion remains unsupported, not a guessed complete factorization',()=>{const r=solve('x^8+999983x^6+999979x^4+999961x^2+999953','factor');assert.equal(r.status,'unsupported');assert.match(r.reason,/limit|bounded/);});
test('pre-existing low-degree irrational requests stay unsupported',()=>{for(const e of ['x^2-2','x^3-2'])assert.equal(solve(e,'factor').status,'unsupported');});
