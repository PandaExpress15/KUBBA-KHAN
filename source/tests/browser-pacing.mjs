import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {launch,popup,until,wait} from './browser-support.mjs';
import {ROOT,listHTML,exerciseHTML} from './classroom-fixture.mjs';
const b=await launch(),events=[],delays=new Map();let questions=2,source;
const state=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
async function click(selector){const p=await popup(b);await until(()=>p.evaluate(s=>{const e=document.querySelector(s);return e&&!e.disabled&&!e.hidden;},selector));await p.click(selector);return p;}
async function start(count){
 const previousRevision=(await state())?.revision??0;
 questions=count;events.length=0;
 for(const p of b.context.pages())if(p!==source)await p.close();
 source||=await b.context.newPage();await source.goto(ROOT);await source.bringToFront();await click('#start');
 return until(async()=>{const s=await state();if(s?.state==='ERROR'||s?.lanes?.exercise?.state==='PAUSED')throw Error(JSON.stringify(s));return s?.running&&s.revision>previousRevision&&s?.lanes?.exercise?.state==='WAITING_BEFORE_ANSWER'?s:false;},{label:'real answer countdown'});
}
try{
 await b.context.exposeBinding('recordFixture',(_,e)=>events.push(e));
 await b.context.route('https://classroom.khanacademy.org/**',r=>r.fulfill({contentType:'text/html',body:r.request().url().includes('/assignment/')?exerciseHTML({questions}):listHTML({single:true})}));
 const first=await start(2),scheduled=structuredClone(first.lanes.exercise.delay);
 assert.ok(Number.isInteger(scheduled.seconds)&&scheduled.seconds>=10&&scheduled.seconds<=30);
 assert.equal(events.filter(e=>e.kind==='native-input'||e.kind==='check').length,0);
 delays.set(scheduled.key,scheduled);
 const p=await popup(b);await until(()=>p.evaluate(()=>/Waiting before/.test(document.getElementById('state').textContent)));
 assert.match(await p.evaluate(()=>document.getElementById('detail').textContent),/\d+s remaining/);
 if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/popup-countdown.png',await p.screenshot());
 // Stop/restart the real MV3 worker during the countdown; do not alter its clock/RNG.
 const service=await b.context.newCDPSession(source),versions=new Map();
 service.on('ServiceWorker.workerVersionUpdated',e=>{for(const v of e.versions)versions.set(v.versionId,v);});await service.send('ServiceWorker.enable');
 const version=await until(()=>[...versions.values()].find(v=>v.scriptURL===b.worker.url()&&v.runningStatus==='running'));
 const marker=await b.worker.evaluate(()=>globalThis.__pacingWorkerMarker=crypto.randomUUID());
 await service.send('ServiceWorker.stopWorker',{versionId:version.versionId});
 await until(async()=>{const current=b.context.serviceWorkers().find(w=>w.url()===`chrome-extension://${b.id}/worker.js`);if(current)b.worker=current;try{return await b.worker.evaluate(()=>globalThis.__pacingWorkerMarker)!==marker;}catch{return false;}},{timeout:15000,label:'actual worker context replaced'});
 assert.deepEqual((await state()).lanes.exercise.delay,scheduled,'restart cannot reroll or restart the saved wait');
 const result=await until(async()=>{
  const s=await state();if(s?.state==='ERROR'||s?.lanes?.exercise?.state==='PAUSED')throw Error(JSON.stringify(s));
  const d=s?.lanes?.exercise?.delay;if(d)delays.set(d.key,structuredClone(d));return s?.state==='DONE'?s:false;
 },{timeout:130000,label:'two questions paced by real elapsed time'});
 assert.equal(delays.size,2);const waits=[...delays.values()],entries=events.filter(e=>e.kind==='native-input');assert.equal(entries.length,2);
 const timings=entries.map((e,i)=>({question:e.q,selectedSeconds:waits[i].seconds,entryAfterDeadlineMs:e.at-waits[i].until}));
 for(const t of timings){assert.ok(t.entryAfterDeadlineMs>=0,JSON.stringify(t));assert.ok(t.entryAfterDeadlineMs<2000,'deadline wakeup should not wait for another four-second polling interval: '+JSON.stringify(t));assert.ok(Number.isInteger(t.selectedSeconds)&&t.selectedSeconds>=10&&t.selectedSeconds<=30);}
 assert.deepEqual(result.counts,{video:0,exercise:1,answers:2});assert.equal(events.filter(e=>e.kind==='check').length,2);assert.equal(events.filter(e=>e.kind==='next').length,1);assert.equal(events.filter(e=>e.kind==='done').length,1);
 console.log('PASS real-time integer pacing on consecutive questions, visible countdown, actual worker restart preserves deadline, verified entry/once-only Check/Next/Done',JSON.stringify(timings));
 const stopped=await start(1),stopDue=stopped.lanes.exercise.delay.until;
 await click('#stop');await until(async()=> (await state()).state==='STOPPED',{timeout:3000,label:'pointer Stop acknowledged'});
 await wait(Math.max(0,stopDue-Date.now())+1500);
 assert.equal(events.filter(e=>['native-input','check','next','done'].includes(e.kind)).length,0);
 console.log('PASS pointer Stop during countdown: no answer entry, Check or navigation after the original deadline');
 await start(1);const exercise=await until(()=>b.context.pages().find(p=>p.url().includes('/assignment/exercise')),{label:'new exercise page after Start'});
 await exercise.locator('input#answer').fill('my work');
 await until(async()=> (await state()).lanes.exercise?.error==='ANSWER_FIELD_NOT_EMPTY',{timeout:40000,label:'work entered during pause is preserved'});
 assert.equal(await exercise.locator('input#answer').inputValue(),'my work');assert.equal(events.filter(e=>e.kind==='check').length,0);await click('#stop');
 console.log('PASS user work entered during the pause stays intact; no Check');
 if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/pacing.json',JSON.stringify({version:'2.1.5',browser:b.context.browser().version(),syntheticSite:true,liveKhanVerified:false,timings,workerDeadlinePreserved:true,stopPastDeadlineVerified:true,existingWorkPreserved:true},null,2));
}finally{await b.close();}
