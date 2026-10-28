import test from 'node:test';import assert from 'node:assert/strict';
import {queueLocalReview,cancelLocalReason,invalidateLocalHealth} from '../extension/local-cas.js';
test('one background review job is deduplicated and late proposals cannot overwrite Stop',async()=>{
 invalidateLocalHealth();const saved=globalThis.fetch,store={};let finish,calls=0;
 const api={permissions:{async contains(){return true;}},storage:{local:{async get(){return {'local-cas':{enabled:true,port:9000,token:'unit-test'}};}},session:{async get(k){return {[k]:store[k]};},async set(v){Object.assign(store,v);}}}};
 try{globalThis.fetch=async url=>{if(url.endsWith('/health'))return {ok:true,async text(){return JSON.stringify({ok:true,engine:'sympy',capabilities:['typed-task-v1']});}};calls++;return await new Promise(resolve=>{finish=()=>resolve({ok:true,async text(){return JSON.stringify({status:'review',request:{expression:'sin(x)',operation:'evaluate'},proposal:{answer:'guess',explanation:'unverified'}});}});});};
 const p={expression:'sin(x)',operation:'evaluate'};const first=await queueLocalReview(api,p,'same');await new Promise(r=>setTimeout(r,0));assert.equal(calls,1);assert.equal((await queueLocalReview(api,p,'same')).id,first.id);assert.equal(calls,1);
 store['reason-review']={id:first.id,state:'CANCELLED'};cancelLocalReason();finish();await new Promise(r=>setTimeout(r,0));assert.equal(store['reason-review'].state,'CANCELLED');
 assert.equal(await queueLocalReview(api,p,'another',()=>true),null);assert.equal(calls,1);
 }finally{globalThis.fetch=saved;}
});
test('Stop epoch rejects a completion whose storage read observed stale RUNNING state',async()=>{
 invalidateLocalHealth();const saved=globalThis.fetch,store={};let finish,release,hold=false,readStarted;
 const reached=new Promise(r=>readStarted=r);
 const api={permissions:{async contains(){return true;}},storage:{local:{async get(){return {'local-cas':{enabled:true,port:9000,token:'unit'}};}},session:{async get(k){const value=store[k];if(hold){hold=false;readStarted();return await new Promise(r=>release=()=>r({[k]:value}));}return {[k]:value};},async set(v){Object.assign(store,v);}}}};
 try{globalThis.fetch=async url=>url.endsWith('/health')?{ok:true,async text(){return JSON.stringify({ok:true,engine:'sympy',capabilities:['typed-task-v1']});}}:await new Promise(r=>finish=()=>r({ok:true,async text(){return JSON.stringify({status:'review',request:{expression:'sin(x)',operation:'evaluate'},proposal:{answer:'guess',explanation:'unverified'}});}}));
 const j=await queueLocalReview(api,{expression:'sin(x)',operation:'evaluate'},'race');await new Promise(r=>setTimeout(r,0));hold=true;finish();await reached;cancelLocalReason();store['reason-review']={id:j.id,state:'CANCELLED'};release();await new Promise(r=>setTimeout(r,0));assert.equal(store['reason-review'].state,'CANCELLED');
 }finally{globalThis.fetch=saved;}
});
