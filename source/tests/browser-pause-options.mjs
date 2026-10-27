import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {launch,popup,until,wait} from './browser-support.mjs';
import {mediaHTML,exerciseHTML} from './classroom-fixture.mjs';
const ROOT='https://classroom.khanacademy.org/learner/class/PAUSEOPTIONS',results=[];
for(const kind of ['unsupported','wrong']){
 const b=await launch(),events=[];const state=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
 try{
  await b.context.exposeBinding('recordFixture',(_,e)=>events.push(e));
  const media=await readFile(new URL('./fixtures/playback.webm',import.meta.url));
  await b.context.route('https://classroom.khanacademy.org/**',r=>{const p=new URL(r.request().url()).pathname;return p==='/fixture-playback.webm'?r.fulfill({contentType:'video/webm',body:media}):r.fulfill({contentType:'text/html',body:p.includes('/assignment/video')?mediaHTML():p.includes('/assignment/exercise')?exerciseHTML({unsupported:kind==='unsupported',wrong:kind==='wrong',questions:1}):`<select><option>To-do</option></select><table>${kind==='unsupported'?`<tr><td><a href="${ROOT}/assignment/video1">Video</a></td><td>Video</td></tr>`:''}<tr><td><a href="${ROOT}/assignment/exercise1">Exercise</a></td><td>Exercise</td></tr></table><p>Current page: 1 of 1.</p>`});});
  const source=await b.context.newPage();await source.goto(ROOT);await source.bringToFront();let controls=await popup(b);
  await until(()=>controls.evaluate(()=>!document.getElementById('start').disabled));
  assert.equal(await controls.evaluate(()=>document.getElementById('continue-blocked').checked),true,'fresh profile defaults continue blocked on');
  await controls.click('#continue-blocked');assert.equal(await controls.evaluate(()=>document.getElementById('continue-blocked').checked),false);
  await controls.click('#start');
  const paused=await until(async()=>{const s=await state();if(s?.state==='ERROR')throw Error(JSON.stringify(s));return s?.lanes?.exercise?.state==='PAUSED'?s:false;},{timeout:75000,label:kind+' explicit pause'});
  assert.equal(paused.continueBlocked,false);assert.equal(paused.lanes.exercise.error,kind==='unsupported'?'UNSUPPORTED_MATH_FORMAT':'SITE_REJECTED_ANSWER');
  assert.equal(paused.counts.exercise,0);assert.equal(paused.lanes.exercise.index,0);assert.equal(paused.lanes.exercise.deferred,0);assert.equal(paused.review.length,0);
  if(kind==='unsupported'){
   await until(()=>{const samples=events.filter(e=>e.kind==='media-timeupdate');return samples.length>=2&&samples.at(-1).time>samples[0].time&&samples.at(-1).time>0.5;},{timeout:20000,label:'real video continues while unsupported exercise paused'});
   assert.equal((await state()).lanes.video.state,'PLAYING');assert.equal(events.filter(e=>e.kind==='check').length,0);
  }else{
   assert.equal(events.filter(e=>e.kind==='check').length,1);await wait(8500);assert.equal(events.filter(e=>e.kind==='check').length,1);assert.equal(events.filter(e=>['next','done'].includes(e.kind)).length,0);
   assert.ok(events.some(e=>e.kind==='feedback'&&e.correct===false));
  }
  controls=await popup(b);await wait(150);assert.match(await controls.evaluate(()=>document.getElementById('state').textContent),/paused/i);
  await controls.click('#stop');await until(async()=> (await state()).state==='STOPPED',{timeout:3000,label:kind+' Stop'});
  if(kind==='unsupported')await until(()=>source.locator('video').evaluate(v=>v.paused&&v.playbackRate===1),{timeout:3000,label:'actual media Stop/restore'});
  const result={case:kind,browser:b.context.browser().version(),extension:await b.worker.evaluate(()=>chrome.runtime.getManifest().version),freshProfile:true,continueBlocked:false,error:paused.lanes.exercise.error,checks:events.filter(e=>e.kind==='check').length,completed:0,deferred:0,stopVerified:true,events};results.push(result);
  console.log('PASS actual Chrome explicit continueBlocked=false',kind,'pauses with',result.error,'Checks',result.checks,'Stop verified');
 }catch(e){console.error('CASE',kind,'STATE',JSON.stringify(await state()),'EVENTS',JSON.stringify(events.slice(-15)));throw e;}finally{await b.close();}
}
if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/pause-options.json',JSON.stringify({syntheticSite:true,liveClassroomVerified:false,results},null,2));
