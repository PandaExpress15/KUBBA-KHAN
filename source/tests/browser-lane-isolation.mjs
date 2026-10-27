import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {launch,popup,until} from './browser-support.mjs';
import {mediaHTML,exerciseHTML} from './classroom-fixture.mjs';
const b=await launch(),ROOT='https://classroom.khanacademy.org/learner/class/ISOLATION',events=[];
const state=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
try{
 await b.context.exposeBinding('recordFixture',(_,e)=>events.push(e));
 const media=await readFile(new URL('./fixtures/playback.webm',import.meta.url));
 await b.context.route('https://classroom.khanacademy.org/**',r=>{const p=new URL(r.request().url()).pathname;return p==='/fixture-playback.webm'?r.fulfill({contentType:'video/webm',body:media}):r.fulfill({contentType:'text/html',body:p.includes('/assignment/video')?mediaHTML():p.includes('/assignment/exercise')?exerciseHTML({unsupported:true,questions:1}):`<select><option>To-do</option></select><table><tr><td><a href="${ROOT}/assignment/video1">Video</a></td><td>Video</td></tr><tr><td><a href="${ROOT}/assignment/exercise1">Unsupported exercise</a></td><td>Exercise</td></tr></table><p>Current page: 1 of 1.</p>`});});
 const source=await b.context.newPage();await source.goto(ROOT);await source.bringToFront();let controls=await popup(b);await until(()=>controls.evaluate(()=>!document.getElementById('start').disabled));await controls.click('#start');
 const observed=await until(async()=>{const s=await state();if(s?.state==='ERROR')throw Error(JSON.stringify(s));return s?.lanes?.exercise?.state==='PAUSED'&&s?.lanes?.video?.state==='PLAYING'&&events.filter(e=>e.kind==='media-timeupdate').length>=2&&events.filter(e=>e.kind==='media-timeupdate').at(-1).time>events.filter(e=>e.kind==='media-timeupdate')[0].time&&events.some(e=>e.kind==='media-timeupdate'&&e.time>0.5)?s:false;},{timeout:20000,label:'unsupported math pauses exercise while real video continues'});
 assert.equal(observed.lanes.exercise.error,'UNSUPPORTED_MATH_FORMAT');assert.equal(observed.running,true);assert.equal(events.filter(e=>e.kind==='check').length,0);assert.equal(observed.counts.exercise,0);
 const samples=events.filter(e=>e.kind==='media-timeupdate');assert.ok(samples.at(-1).time>samples[0].time);
 controls=await popup(b);await controls.click('#stop');await until(async()=> (await state()).state==='STOPPED',{timeout:3000,label:'Stop acknowledged'});
 await until(()=>source.locator('video').evaluate(v=>v.paused&&v.playbackRate===1),{timeout:3000,label:'real video paused and original rate restored'});
 console.log('PASS actual unsupported exercise lane pauses without Check while real video remains PLAYING and advances; pointer Stop pauses/restores actual media');
 if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/lane-isolation.json',JSON.stringify({browser:b.context.browser().version(),syntheticSite:true,liveClassroomVerified:false,exerciseError:observed.lanes.exercise.error,videoProgress:samples.map(e=>({time:e.time,at:e.at,rate:e.rate})),checks:0,stopVerified:true},null,2));
}finally{await b.close();}
