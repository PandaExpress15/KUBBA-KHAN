import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {launch,popup,until,wait} from './browser-support.mjs';
import {ROOT,listHTML,mediaHTML,exerciseHTML} from './classroom-fixture.mjs';
const b=await launch(),events=[],pageErrors=[];
let options={},source,control;
const state=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
async function openControls(){control=await popup(b);return control;}
async function click(selector){await openControls();await until(()=>control.evaluate(s=>!document.querySelector(s).disabled,selector),{label:selector+' enabled'});await control.click(selector);}
async function start(opts){
 options=opts;events.length=0;
 for(const p of b.context.pages())if(p!==source&&p.url()!=='about:blank')await p.close();
 source||=await b.context.newPage();await source.goto(ROOT);await source.bringToFront();
 await click('#start');await until(async()=> (await state())?.running,{label:'actual Start'});
}
try{
 await b.context.exposeBinding('recordFixture',(_,event)=>{events.push(event);});
 b.context.on('page',p=>p.on('pageerror',e=>pageErrors.push(e.message)));
 const media=await readFile(new URL('./fixtures/playback.webm',import.meta.url));
 await b.context.route('https://classroom.khanacademy.org/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/fixture-playback.webm')return route.fulfill({contentType:'video/webm',body:media});
  if(url.pathname.startsWith('/vendor/'))return route.fulfill({contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript',body:await readFile(new URL('.'+url.pathname,import.meta.url))});
  const kind=url.pathname.split('/assignment/')[1];
  const html=kind?.startsWith('video')?mediaHTML({embedded:kind==='video2'}):kind?.startsWith('exercise')?exerciseHTML({...options,editor:kind==='exercise2'?'fallback':options.editor||'native'}):listHTML(options);
  return route.fulfill({contentType:'text/html',body:html});
 });
 await b.context.route('https://www.youtube-nocookie.com/embed/**',r=>r.fulfill({contentType:'text/html',body:mediaHTML()}));
 console.log('Browser',b.context.browser().version(),'extension',await b.worker.evaluate(()=>chrome.runtime.getManifest().version),'source',await b.worker.evaluate(()=>chrome.runtime.getURL('')));

 await start({});
 await until(async()=>{const s=await state();return s?.lanes?.exercise?.state==='WAITING_BEFORE_ANSWER'&&s?.lanes?.video?.state==='PLAYING'&&events.some(e=>e.kind==='media-timeupdate'&&e.time>0.3);},{label:'video progresses while the exercise countdown is active'});
 const done=await until(async()=>{const s=await state();if(s?.state==='ERROR'||Object.values(s?.lanes||{}).some(l=>l.state==='PAUSED'))throw Error(JSON.stringify(s));return s?.state==='DONE'?s:false;},{timeout:230000,label:'two videos and two exercises'});
 assert.deepEqual(done.counts,{answers:4,exercise:2,video:2});
 assert.equal(b.context.pages().filter(p=>p.url().includes('/assignment/')).length,2,'exactly two work tabs');
 assert.equal(done.jobs.video.length,2);assert.equal(done.jobs.exercise.length,2);
 assert.ok(!Object.values(done.jobs).flat().some(u=>u.includes('/OTHER/')));
 assert.deepEqual(events.filter(e=>e.kind==='list-page').map(e=>e.page),[3,2,1,2,3]);
 const ends=events.filter(e=>e.kind==='media-ended');assert.equal(ends.length,2);
 for(const e of ends){assert.ok(e.trusted);assert.equal(e.rate,2);assert.ok(Math.abs(e.time-e.duration)<0.1);}
 assert.equal(events.filter(e=>e.kind==='media-seeked').length,0);
 for(const url of new Set(ends.map(e=>e.url))){
  const samples=events.filter(e=>e.kind==='media-timeupdate'&&e.url===url&&e.time>0.2&&e.time<5.5);
  assert.ok(samples.length>=2);const first=samples[0],last=samples.at(-1),effective=(last.time-first.time)/((last.at-first.at)/1000);
  assert.ok(effective>1.6&&effective<2.4,'effective real-time media rate '+effective);
 }
 assert.equal(events.filter(e=>e.kind==='check').length,4);
 assert.equal(events.filter(e=>e.kind==='feedback'&&e.correct).length,4);
 assert.equal(events.filter(e=>e.kind==='next').length,2);
 assert.equal(events.filter(e=>e.kind==='done').length,2);
 assert.ok(events.some(e=>e.kind==='controlled-rerender'&&e.value));
 assert.ok(events.some(e=>e.kind==='check'&&e.url.includes('exercise2')),'real no-global MathQuill Check');
 // The requested answer delay can exceed both videos. Concurrency is checked
 // above by observing real media progress during the independent countdown.
 console.log('PASS SPA multipage reset/article-only/dedupe/same-class, two actual tabs, two real media ends at effective 2x (top + iframe), native controlled input + actual fallback MathQuill, four once-only Checks, Next/Done, next assignments');
 const happyEvents=structuredClone(events);

 await start({single:true,editor:'public',questions:1});
 await until(async()=>{const s=await state();if(s.state==='ERROR'||s.lanes.exercise?.state==='PAUSED')throw Error(JSON.stringify(s));return s.state==='DONE';},{timeout:75000,label:'public MathQuill full exercise'});
 assert.equal(events.filter(e=>e.kind==='check').length,1);
 console.log('PASS actual upstream public MathQuill API entry/readback/Check/Done');

 await start({initialPage:1});
 await until(async()=>{const s=await state();return s.lanes.exercise?.state==='WAITING_BEFORE_ANSWER'&&events.some(e=>e.kind==='media-playing');},{label:'pending entry and playing video'});
 await click('#stop');await until(async()=> (await state()).state==='STOPPED',{label:'Stop observed'});
 const stoppedAt=Date.now(),before=events.filter(e=>e.kind==='check').length;
 await wait(8500);
 assert.equal(events.filter(e=>e.kind==='check').length,before);
 assert.ok(!events.some(e=>e.at>stoppedAt&&['next','done','exercise-question'].includes(e.kind)));
 const video=b.context.pages().find(p=>p.url().includes('/assignment/video'));
 assert.ok(await video.locator('video').evaluate(v=>v.paused&&v.playbackRate===1));
 console.log('PASS pointer Stop during real media and pending exercise; media paused/restored; no Check or navigation for two pulse intervals');

 await start({single:true,unsupported:true});
 await until(async()=> (await state()).lanes.exercise?.state==='PAUSED',{label:'unsupported pause'});
 await openControls();await wait(200);
 assert.match(await control.evaluate(()=>document.getElementById('state').textContent),/paused/i);
 assert.equal(await control.evaluate(()=>document.getElementById('connection').dataset.tone),'error');
 assert.equal(events.filter(e=>e.kind==='check').length,0);
 if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/popup-paused.png',await control.screenshot());
 await click('#stop');console.log('PASS unsupported math pauses visibly above fold, no Check or completion count');

 await start({single:true,wrong:true});
 await until(async()=> (await state()).lanes.exercise?.error==='SITE_REJECTED_ANSWER',{timeout:75000,label:'wrong feedback'});
 assert.equal(events.filter(e=>e.kind==='check').length,1);assert.equal((await state()).counts.exercise,0);
 await click('#stop');console.log('PASS wrong site feedback pauses, no resubmit or completion');

 await start({fullNavigation:true});
 await until(async()=> (await state()).state==='RUNNING',{timeout:45000,label:'full navigation pagination'});
 assert.equal((await state()).jobs.video.length,2);assert.equal((await state()).jobs.exercise.length,2);
 await click('#stop');console.log('PASS full-navigation queue discovery as well as SPA rendering');

 const local=await b.context.newPage();await local.goto(`chrome-extension://${b.id}/selftest.html`);
 await local.waitForFunction(()=>document.getElementById('summary').textContent.includes('local checks passed'));
 assert.match(await local.locator('#summary').textContent(),/^15\/15/);
 assert.deepEqual(pageErrors,[],'no fixture/content page errors');
 console.log('PASS 15/15 in-browser selfchecks; no page errors');
 if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/browser-events.json',JSON.stringify({browser:b.context.browser().version(),syntheticSite:true,liveSiteVerified:false,happyEvents,finalState:await state(),pageErrors},null,2));
}catch(e){console.error('STATE',JSON.stringify(await state()));console.error('RECENT EVENTS',JSON.stringify(events.slice(-12)));throw e;}
finally{await b.close();}
