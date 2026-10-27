import test from 'node:test';import assert from 'node:assert/strict';
import {localAnswer,localReadback,LOCAL_ORIGIN,helperPort,localComparison} from '../extension/local-cas.js';
const api={storage:{local:{async get(){return {'local-cas':{enabled:true,token:'test-token-not-a-secret'}};}}},permissions:{async contains(p){assert.deepEqual(p.origins,[LOCAL_ORIGIN]);return true;}}};
const p={expression:'sqrt(8)',operation:'simplify'};
test('optional CAS rejects unbound or unverified replies and verifies actual observed input',async()=>{
 const saved=globalThis.fetch;const calls=[];let invalid=false;
 try{globalThis.fetch=async(url,o)=>{calls.push({url,body:JSON.parse(o.body),headers:o.headers});const data=url.endsWith('/solve')?{status:'solved',answer:'2*sqrt(2)',latex:'2\\sqrt{2}',request:invalid?{expression:'other',operation:'simplify'}:p,certificate:{kind:'quadratic-surd'},verification:{exact:true,method:'sympy-exact'}}:{ok:true,equivalent:JSON.parse(o.body).observed!=='3',verification:{exact:true}};return {ok:true,async text(){return JSON.stringify(data);}};};
 const a=await localAnswer(api,p);assert.equal(a.source,'local-sympy');assert.equal(await localReadback(api,p,a,'3'),false);assert.equal(calls[1].body.expression,p.expression);assert.equal(calls[1].body.answer,'2*sqrt(2)');assert.ok(calls.every(c=>c.url.startsWith('http://127.0.0.1:9000/')));invalid=true;assert.equal(await localAnswer(api,p),null);
 }finally{globalThis.fetch=saved;}
});
test('optional CAS is inactive without explicit saved enable',async()=>{assert.equal(await localAnswer({storage:{local:{async get(){return {};}}}},p),null);});

test('helper port is bounded and cannot select a remote host',()=>{assert.equal(helperPort(undefined),9000);assert.equal(helperPort('9100'),9100);for(const p of ['http://example.com',0,80,65536,9000.5])assert.throws(()=>helperPort(p));});

test('CAS comparison distinguishes proved inequality from unsupported comparison',async()=>{const saved=globalThis.fetch;let parsed=false;try{globalThis.fetch=async()=>({ok:true,async text(){return JSON.stringify(parsed?{ok:true,equivalent:false,verification:{exact:true}}:{ok:false,status:'unsupported'});}});assert.equal(await localComparison(api,p,{answer:'2*sqrt(2)'},'1/(x-x)'),null);parsed=true;assert.equal(await localComparison(api,p,{answer:'2*sqrt(2)'},'1'),false);}finally{globalThis.fetch=saved;}});
