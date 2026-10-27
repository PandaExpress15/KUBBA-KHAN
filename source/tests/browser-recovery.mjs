import assert from 'node:assert/strict';
import {launch,popup,until,wait} from './browser-support.mjs';
import {ROOT,listHTML,exerciseHTML} from './classroom-fixture.mjs';
let source,options={unknown:true},events=[];
const b=await launch({beforeInstall:async context=>{
 await context.exposeBinding('recordFixture',(_,e)=>events.push(e));
 await context.route('https://classroom.khanacademy.org/**',r=>r.fulfill({contentType:'text/html',body:r.request().url().includes('/assignment/')?exerciseHTML(options):listHTML({single:true})}));
 source=await context.newPage();await source.goto(ROOT);
 assert.equal(await source.evaluate(()=>globalThis.__klrDualTicker),undefined);
}});
const state=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
const checks=()=>events.filter(e=>e.kind==='check').length;
async function click(selector){const p=await popup(b);await until(()=>p.evaluate(s=>{const e=document.querySelector(s);return e&&!e.disabled&&!e.hidden;},selector),{label:selector});await p.click(selector);}
async function start(opts){
 options=opts;events=[];
 for(const p of b.context.pages())if(p!==source)await p.close();
 await source.goto(ROOT);await source.bringToFront();await click('#start');
 await until(async()=> (await state())?.running,{label:'Start'});
}
try{
 await source.bringToFront();await click('#start');
 await until(()=>checks()===1,{timeout:75000,label:'Check intent delivered'});
 assert.ok(await b.worker.evaluate(async root=>{const tab=(await chrome.tabs.query({})).find(t=>t.url===root);return (await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>!!globalThis.__klrDualTicker}))[0].result;},ROOT));
 console.log('PASS installed on already-open classroom tab: Start attaches the runner without a tab reload');
 const service=await b.context.newCDPSession(source),versions=new Map(),transitions=[];
 service.on('ServiceWorker.workerVersionUpdated',e=>{for(const v of e.versions){versions.set(v.versionId,v);transitions.push({status:v.runningStatus,id:v.versionId});}});
 await service.send('ServiceWorker.enable');
 const version=await until(()=>[...versions.values()].find(v=>v.scriptURL===b.worker.url()&&v.runningStatus==='running'),{label:'actual MV3 version'});
 const oldMarker=await b.worker.evaluate(()=>globalThis.__fixtureWorkerInstance=crypto.randomUUID());
 await service.send('ServiceWorker.stopWorker',{versionId:version.versionId});
 await until(async()=>{
  const current=b.context.serviceWorkers().find(w=>w.url()===`chrome-extension://${b.id}/worker.js`);if(current)b.worker=current;
  try{return (await b.worker.evaluate(()=>globalThis.__fixtureWorkerInstance))!==oldMarker;}catch{return false;}
 },{timeout:15000,label:'worker global context actually replaced'});
 console.log('WORKER TRANSITIONS',JSON.stringify(transitions));
 assert.equal(checks(),1);assert.ok(['CHECKING','WAITING_FEEDBACK'].includes((await state()).lanes.exercise.problem.phase));
 await until(async()=> (await state()).lanes.exercise?.error==='SUBMISSION_RESULT_NOT_OBSERVED',{timeout:35000,label:'unknown submission remains nonretryable after real restart'});
 await click('#resume');await wait(5500);assert.equal(checks(),1);
 console.log('PASS actual MV3 worker stopped/restarted; durable Check intent survives; unknown feedback pauses; Resume does not repeat Check');
 await click('#stop');

 await start({questions:1,feedbackDelay:12000});
 await until(async()=> (await state()).state==='DONE',{timeout:85000,label:'delayed accepted feedback'});
 assert.equal(checks(),1);console.log('PASS delayed real DOM feedback: exactly one Check, then observed Done');

 await start({questions:1});
 await until(async()=> (await state()).lanes.exercise?.tabId,{label:'exercise lane opened'});
 let lane=(await state()).lanes.exercise;
 let page=b.context.pages().find(p=>p.url().includes('/assignment/exercise'));
 await page.goto('https://classroom.khanacademy.org/learner/class/OTHER/assignment/1');
 await until(async()=> (await state()).lanes.exercise?.error==='WORKER_LEFT_CLASS_SCOPE',{label:'user navigated out of class'});
 assert.equal(checks(),0);await click('#stop');console.log('PASS real user navigation outside class pauses without Check');

 await start({questions:1});
 await until(async()=> (await state()).lanes.exercise?.tabId,{label:'lane for close'});
 page=b.context.pages().find(p=>p.url().includes('/assignment/exercise'));await page.close();
 await until(async()=> (await state()).lanes.exercise?.error==='WORKER_TAB_CLOSED',{timeout:40000,label:'actual heartbeat detects closed tab'});
 assert.equal(checks(),0);await click('#stop');console.log('PASS actual tab closure detected by real Chrome heartbeat; no Check');

 await start({changeAfterCheck:true});
 await until(async()=> (await state()).lanes.exercise?.state==='PAUSED',{timeout:75000,label:'changed problem after Check'});
 assert.equal((await state()).lanes.exercise.error,'PROBLEM_CHANGED_BEFORE_FEEDBACK');assert.equal((await state()).counts.answers,0);assert.equal(checks(),1);
 await click('#stop');console.log('PASS changed problem before feedback: no credit and no resubmission');

 await start({ordinals:false,questions:2});
 await until(async()=> (await state()).lanes.exercise?.error==='NEXT_QUESTION_DID_NOT_CHANGE',{timeout:95000,label:'identical question without ordinal'});
 assert.equal(checks(),1);assert.equal((await state()).counts.answers,0);await click('#stop');
 console.log('PASS identical consecutive expressions without ordinal pause; no guessed identity or second Check');

 // Developer reload, preserving the existing class-list tab and extension id.
 await source.goto(ROOT);await source.bringToFront();
 const reloadPage=await b.context.newPage();await reloadPage.goto('chrome://extensions/');
 const oldWorker=b.worker;
 const reloaded=b.context.waitForEvent('serviceworker',{timeout:15000,predicate:w=>w!==oldWorker&&w.url()===oldWorker.url()});
 reloaded.catch(()=>{});
 await reloadPage.evaluate(id=>chrome.developerPrivate.reload(id,{failQuietly:true}),b.id);
 await until(async()=> (await reloadPage.evaluate(()=>chrome.developerPrivate.getExtensionsInfo({includeDisabled:true}))).some(e=>e.id===b.id&&e.state==='ENABLED'),{label:'reload enabled'});
 const wake=await b.context.newPage();await wake.goto(`chrome-extension://${b.id}/popup.html`);b.worker=await reloaded;await wake.close();await reloadPage.close();
 await start({questions:1});
 await until(async()=>{const s=await state();if(s.state==='ERROR'||s.lanes.exercise?.state==='PAUSED')throw Error(JSON.stringify(s));return s.state==='DONE';},{timeout:85000,label:'source reload then normal run'});
 assert.equal(checks(),1);console.log('PASS actual extension reload preserves source binding and reattaches an existing tab');
}catch(e){console.error('RECOVERY STATE',JSON.stringify(await state().catch(()=>null)));throw e;}
finally{await b.close();}
