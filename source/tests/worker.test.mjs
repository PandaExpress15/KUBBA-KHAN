import test from 'node:test';import assert from 'node:assert/strict';
const store={},listeners={};let tabUrl='https://classroom.khanacademy.org/learner/class/ABC/assignment/1';const sent=[];
globalThis.chrome={alarms:{onAlarm:{addListener(){}},async create(){},async clear(){}},runtime:{getURL:p=>'chrome-extension://fixture/'+p,onMessage:{addListener(fn){listeners.message=fn;}}},storage:{session:{async get(k){return {[k]:structuredClone(store[k])};},async set(p){Object.assign(store,structuredClone(p));},async remove(k){delete store[k];}}},tabs:{async get(id){return {id,url:tabUrl};},async sendMessage(id,m,options){sent.push({id,m,options});return {ok:true,fieldCount:1};},onRemoved:{addListener(fn){listeners.removed=fn;}},onUpdated:{addListener(fn){listeners.updated=fn;}}},scripting:{async executeScript(){return [{result:{ok:true}}];}}};
await import('../extension/worker.js');
const popup={url:'chrome-extension://fixture/popup.html'};
const frame=(id=0,url=tabUrl)=>({tab:{id:7,url:tabUrl},url,frameId:id});
const ask=(m,s=popup)=>new Promise(resolve=>listeners.message({tabId:7,...m},s,resolve));
test('worker tab-bound state and no arbitrary content actions',async()=>{
 assert.equal((await ask({type:'STATUS'})).config.running,false);
 assert.equal((await ask({type:'START'},frame())).error,'UNKNOWN_CONTENT_ACTION');
 const a=await ask({type:'START',rate:2,autoNext:true});assert.ok(a.ok);assert.ok(a.config.running);assert.equal(a.config.scope,'https://classroom.khanacademy.org/learner/class/ABC');
 assert.equal((await ask({type:'HELLO'},frame())).config.running,true);
 assert.equal((await ask({type:'REPORT',revision:a.config.revision,state:'VIDEO_PLAYING',code:'RATE_CONFIRMED',rate:2,videos:1},frame())).ok,true);
 assert.equal((await ask({type:'STATUS'})).config.state,'VIDEO_PLAYING');
 assert.equal((await ask({type:'INSERT',expression:'process.exit()',mode:'factor',token:'x'})).error,'NO_VERIFIED_ANSWER');
});
test('STOP rejects delayed report and cannot resurrect state',async()=>{
 const a=await ask({type:'START',rate:2});const stopping=ask({type:'STOP'});const stale=ask({type:'REPORT',revision:a.config.revision,state:'VIDEO_PLAYING'},frame());
 await stopping;assert.equal((await stale).error,'STALE_SESSION');assert.equal((await ask({type:'STATUS'})).config.running,false);
});
test('frame validation rejects fake Khan suffix and outside parent',async()=>{assert.equal((await ask({type:'HELLO'},frame(0,'https://www.khanacademy.org.evil.com/'))).error,'UNAUTHORIZED_FRAME');assert.equal((await ask({type:'HELLO'},{tab:{id:7,url:'https://example.com'},url:'https://www.youtube.com/embed/1',frameId:1})).error,'UNAUTHORIZED_FRAME');});
test('trusted media frame can report end, cannot insert',async()=>{
 const a=await ask({type:'START',rate:2});const media=frame(2,'https://www.youtube.com/embed/fixture');
 assert.ok((await ask({type:'HELLO'},media)).ok);
 assert.ok((await ask({type:'REPORT',revision:a.config.revision,state:'VIDEO_ENDED',code:'MEDIA_ENDED_CREDIT_UNVERIFIED'},media)).ok);
 assert.ok(sent.some(s=>s.m.type==='MEDIA_ENDED'&&s.options.frameId===0));
 assert.equal((await ask({type:'INSERT'},media)).error,'UNKNOWN_CONTENT_ACTION');
});
test('invalid status payload is rejected',async()=>{const a=await ask({type:'START'});assert.equal((await ask({type:'REPORT',revision:a.config.revision,state:'MAKE_GRADE_PASS'},frame())).error,'INVALID_STATE');});
test('cross-class URL update stops the session',async()=>{await ask({type:'START'});tabUrl='https://classroom.khanacademy.org/learner/class/OTHER/assignment/1';listeners.updated(7,{url:tabUrl});assert.equal((await ask({type:'STATUS'})).config.running,false);});
test('deadline holds all frames',async()=>{const a=await ask({type:'START'});await ask({type:'REPORT',revision:a.config.revision,state:'ERROR',code:'SESSION_TIME_LIMIT'},frame());const s=(await ask({type:'STATUS'})).config;assert.equal(s.running,false);assert.equal(s.state,'ERROR');});
test('untrusted main tab cannot start',async()=>{tabUrl='https://example.com/';assert.equal((await ask({type:'START'})).error,'OPEN_KHAN_TAB');});
