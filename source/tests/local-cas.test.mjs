import test from 'node:test';import assert from 'node:assert/strict';
import {localAnswer,localReadback,LOCAL_ORIGIN} from '../extension/local-cas.js';
const api={storage:{local:{async get(){return {'local-cas':{enabled:true,token:'test-token-not-a-secret'}};}}},permissions:{async contains(p){assert.deepEqual(p.origins,[LOCAL_ORIGIN]);return true;}}};
const p={expression:'sqrt(8)',operation:'simplify'};
test('optional CAS rejects unbound or unverified replies and verifies actual observed input',async()=>{
 const saved=globalThis.fetch;const calls=[];let invalid=false;
 try{globalThis.fetch=async(url,o)=>{calls.push({url,body:JSON.parse(o.body),headers:o.headers});const data=url.endsWith('/solve')?{status:'solved',answer:'2*sqrt(2)',latex:'2\\sqrt{2}',request:invalid?{expression:'other',operation:'simplify'}:p,certificate:{kind:'quadratic-surd'},verification:{exact:true,method:'sympy-exact'}}:{ok:true,equivalent:JSON.parse(o.body).observed!=='3',verification:{exact:true}};return {ok:true,async text(){return JSON.stringify(data);}};};
 const a=await localAnswer(api,p);assert.equal(a.source,'local-sympy');assert.equal(await localReadback(api,p,a,'3'),false);assert.equal(calls[1].body.expression,p.expression);assert.equal(calls[1].body.answer,'2*sqrt(2)');assert.ok(calls.every(c=>c.url.startsWith('http://127.0.0.1:8765/')));invalid=true;assert.equal(await localAnswer(api,p),null);
 }finally{globalThis.fetch=saved;}
});
test('optional CAS is inactive without explicit saved enable',async()=>{assert.equal(await localAnswer({storage:{local:{async get(){return {};}}}},p),null);});
