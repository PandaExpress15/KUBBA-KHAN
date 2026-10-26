import assert from 'node:assert/strict';
import {launch,popup,until} from './browser-support.mjs';
import {ROOT,listHTML} from './classroom-fixture.mjs';
const b=await launch(),events=[];
try{
 await b.context.exposeBinding('recordFixture',(_,e)=>events.push(e));
 await b.context.route('https://classroom.khanacademy.org/**',r=>r.fulfill({contentType:'text/html',body:r.request().url().includes('/assignment/')?'<main>Assignment loading</main>':listHTML({fullNavigation:true})}));
 const source=await b.context.newPage();let interruptions=0;
 const state=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
 for(let round=0;round<3;round++){
  for(const p of b.context.pages())if(p!==source&&p.url().includes('/assignment/'))await p.close();
  events.length=0;await source.goto(ROOT);await source.bringToFront();let p=await popup(b);await p.click('#start');
  const run=await until(async()=>{const s=await state();if(s?.state==='ERROR')throw Error(JSON.stringify(s));return s?.state==='RUNNING'?s:false;},{timeout:45000,label:'full-document pagination without repeating unknown clicks'});
  assert.equal(run.jobs.video.length,2);assert.equal(run.jobs.exercise.length,2);assert.deepEqual(events.filter(e=>e.kind==='list-page').map(e=>e.page),[3,2,1,2,3]);
  interruptions+=run.scan.navigationInterruptions||0;p=await popup(b);await p.click('#stop');await until(async()=> (await state()).state==='STOPPED');
 }
 console.log('PASS three full-document pagination runs; exact page sequence, complete queues, no repeated navigation; actual interrupted replies:',interruptions);
}finally{await b.close();}
