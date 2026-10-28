import test from 'node:test';import assert from 'node:assert/strict';
import {verifyProblemAnswer} from '../extension/typed-client.js';
test('owned builtin readback requires original polynomial domain and exact output form',async()=>{
 const doc={task:{task:'factor'}},solution={route:'builtin-exact',answer:{fields:{s0:'(x-1)*(x+1)'},latexFields:{s0:'(x-1)\\cdot (x+1)'}}};
 for(const actual of ['(x^2-1)*(1)','x^2-1','x^3/x','(x-1)*(x-1)'])assert.equal(await verifyProblemAnswer({},doc,solution,{fields:{s0:actual}}),false,actual);
 assert.equal(await verifyProblemAnswer({},doc,solution,{fields:{s0:'(x-1)\\cdot(x+1)'}}),true);
 const square={route:'builtin-exact',answer:{fields:{s0:'x^2'},latexFields:{s0:'x^{2}'}}};assert.equal(await verifyProblemAnswer({},doc,square,{fields:{s0:'x^3/x'}}),false);assert.equal(await verifyProblemAnswer({},doc,square,{fields:{s0:'x^{2}'}}),true);
});
import {resolveProblemDocument} from '../extension/typed-client.js';
import {invalidateLocalHealth} from '../extension/local-cas.js';
test('semantic empty/all/multi solution sets cannot be pasted into an unproven scalar widget',async()=>{
 const api={permissions:{async contains(){return true;}},storage:{local:{async get(){return {'local-cas':{enabled:true,token:'unit',port:9000}};}}}};
 const d={schema:'kubla-problem-v1',url:'https://classroom.khanacademy.org/learner/class/TEST/assignment/1',fingerprint:'a'.repeat(64),original:{instruction:'Solve the equation.',text:'Solve x^2/x=0.',expressions:[{source:'tex',text:'x^2/x=0'}]},task:{schema:'kubla-task-v1',task:'equation',expression:'x^2/x=0',givens:{},slots:[{id:'s0',role:'answer'}],output:{kind:'solution-set'},domain:'real'},response:{kind:'native',slots:[{id:'s0',role:'answer',kind:'native',label:'Answer',path:[0],value:'',disabled:false}],choices:[]},evidence:{tables:[],graph:{}},notation:{}};
 const saved=fetch;try{for(const extra of [{all:false,values:[]},{all:true,values:[]},{all:false,values:['-2','2']}]){invalidateLocalHealth();globalThis.fetch=async url=>({ok:true,async text(){return JSON.stringify(url.endsWith('/health')?{ok:true,engine:'sympy',version:'2.2.0',capabilities:['typed-task-v1']}:{ok:true,status:'solved',binding:{schema:d.schema,fingerprint:d.fingerprint},verification:{exact:true,method:'typed-original-task'},answer:{kind:'solution-set',...extra,excluded:[],fields:{s0:'No solution'},latexFields:{s0:'No solution'}}});}});const r=await resolveProblemDocument(api,d);assert.equal(r.status,'review');assert.equal(r.reason,'RESPONSE_SOLUTION_SET_FORMAT_UNSUPPORTED');}}finally{globalThis.fetch=saved;}
});
