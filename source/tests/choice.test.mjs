import test from 'node:test';import assert from 'node:assert/strict';
import {uniqueChoice,formalChoice} from '../extension/choice.js';
const p={expression:'2+3',operation:'evaluate'},answer={answer:'5',status:'solved'};
const choices=(...expressions)=>expressions.map((expression,index)=>({index,expression}));
test('exact verified MC selects the single correct expression',async()=>{assert.deepEqual(await uniqueChoice(p,answer,choices('6','5','4')),{ok:true,index:1,expression:'5'});});
test('equivalent duplicate options are ambiguous',async()=>{const result=await uniqueChoice({...p,expression:'1/2'}, {answer:'1/2'},choices('1/2','0.5','2'));assert.equal(result.error,'CHOICE_AMBIGUOUS_MATCH');});
test('unreadable distractor rejects the entire question',async()=>{for(const expression of ['all of the above','five','graph','A: 5','5,6','x=5']){const r=await uniqueChoice(p,answer,choices('5',expression));assert.equal(r.ok,false,expression);}});
test('unknown syntax is not treated as proven inequality',async()=>{const r=await uniqueChoice(p,answer,choices('5','sqrt(x)'));assert.equal(r.error,'CHOICE_UNVERIFIED_OPTION');});
test('CAS false for an unverified option cannot certify uniqueness',async()=>{const r=await uniqueChoice(p,{...answer,source:'local-sympy'},choices('5','asin(1/2)'),async e=>e==='5'?true:null);assert.equal(r.error,'CHOICE_UNVERIFIED_OPTION');});
test('factor MC pauses rather than testing only algebraic equivalence',async()=>{const r=await uniqueChoice({expression:'x^2-1',operation:'factor'},{answer:'(x-1)(x+1)'},choices('x^2-1','(x-1)(x+1)'));assert.equal(r.error,'CHOICE_FACTOR_FORM_UNSUPPORTED');});
test('formal choice whitelist rejects text, controls and executable content',()=>{for(const e of ['hello','__proto__','alert(1)','x.constructor','<svg>','all above','a;b','NaN'])assert.equal(formalChoice(e),false,e);for(const e of ['5','1/2','0.5','x^2+1','\\frac{1}{2}'])assert.equal(formalChoice(e),true,e);});

test('exact unit-circle radical choice is independently readable',async()=>{const result=await uniqueChoice({expression:'sin(pi/3)',operation:'evaluate'},{answer:'sqrt(3)/2'},choices('sqrt(3)/2','sqrt(2)/2','1/2'));assert.equal(result.ok,true);assert.equal(result.index,0);});
test('CAS comparison unknown rejects whole question rather than proving inequality',async()=>{const r=await uniqueChoice(p,{...answer,source:'local-sympy'},choices('5','6'),async expression=>expression==='5'?true:null);assert.equal(r.error,'CHOICE_UNVERIFIED_OPTION');});
test('helper factor comparison requires exactly one verified factored form',async()=>{const p={expression:'x^2-1',operation:'factor'},a={answer:'(x-1)(x+1)',source:'local-sympy'};const r=await uniqueChoice(p,a,choices('x^2-1','(x-1)(x+1)'),async expression=>expression==='(x-1)(x+1)');assert.equal(r.index,1);const duplicate=await uniqueChoice(p,a,choices('(x-1)(x+1)','(x+1)(x-1)'),async()=>true);assert.equal(duplicate.error,'CHOICE_AMBIGUOUS_MATCH');});
