import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {launch,popup,until} from './browser-support.mjs';
import {pageSnapshot as currentSnapshot} from '../extension/automation-page.js';
const pageSnapshot=process.env.BASELINE_SNAPSHOT_PATH?(await import(pathToFileURL(process.env.BASELINE_SNAPSHOT_PATH))).pageSnapshot:currentSnapshot;
const b=await launch(),ROOT='https://classroom.khanacademy.org/learner/class/PROGRESSION',events=[],observations=[];
const fixture=()=>`<!doctype html><html><body><h1>Factor quadratics by grouping</h1><header id="ordinal"></header><main><p>Factor the quadratic expression completely.</p><span id="math" data-tex="10x^2+13x+4"></span><span>=</span><input id="answer" aria-label="Answer"></main><footer><button id="check">Check</button><p role="status" id="feedback"></p><button id="next" hidden>Next</button><button id="done" hidden>Done</button></footer><aside><button id="unrelated">Next lesson</button><p role="status">Correct!</p></aside><script>
 let q=1;const expr=['10x^2+13x+4','10x^2+13x+4','x^2-9'];const record=(kind,data={})=>window.recordProgression({kind,q,at:Date.now(),...data});
 function render(){document.getElementById('ordinal').textContent=q===2?'Question 2 of 3':q+' of 3 questions';document.getElementById('math').setAttribute('data-tex',expr[q-1]);document.getElementById('math').textContent=expr[q-1];document.getElementById('answer').value='';document.getElementById('feedback').textContent='';document.getElementById('check').hidden=false;document.getElementById('next').hidden=true;document.getElementById('done').hidden=true;record('question');}
 document.getElementById('check').onclick=()=>{const value=document.getElementById('answer').value;const normal=value.replace(/[ *]/g,'');const correct=(q<3?['(2x+1)(5x+4)','(5x+4)(2x+1)']:['(x-3)(x+3)','(x+3)(x-3)']).includes(normal);record('check',{value,correct});document.getElementById('feedback').textContent=correct?'Correct!':'Incorrect';if(correct){document.getElementById('check').hidden=true;document.getElementById(q===3?'done':'next').hidden=false;document.getElementById('next').textContent=q===1?'Next':'Continue';}};
 document.getElementById('next').onclick=()=>{record('next');q++;render();};document.getElementById('done').onclick=()=>{record('done');document.querySelector('main').innerHTML='<p role="status">Exercise complete</p>';document.querySelector('footer').remove();};document.getElementById('unrelated').onclick=()=>record('unrelated-next');render();
 </script></body></html>`;
const state=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
try{
 await b.context.exposeBinding('recordProgression',(_,e)=>events.push(e));
 await b.context.route('https://classroom.khanacademy.org/**',r=>r.fulfill({contentType:'text/html',body:r.request().url().includes('/assignment/')?fixture():`<select><option>To-do</option></select><table><tr><td><a href="${ROOT}/assignment/1">Factor quadratics</a></td><td>Exercise</td></tr></table><p>Current page: 1 of 1.</p>`}));
 const page=await b.context.newPage();await page.goto(ROOT+'/assignment/1');
 await page.locator('#answer').fill('(2x+1)(5x+4)');await page.locator('#check').click();
 const after=await page.evaluate(pageSnapshot);console.log('AFTER FIRST ACCEPTED CHECK',JSON.stringify(after));
 assert.equal(after.accepted,true,'detached footer Correct remains observable when Check becomes Next');assert.ok(after.controls.some(s=>/^next$/i.test(s)),'literal detached Next must be classified');assert.equal(after.ordinal,1);
 if(!process.env.BASELINE_SNAPSHOT_PATH){
  await page.locator('#next').click();await page.locator('#answer').fill('(2x+1)(5x+4)');await page.locator('#check').click();const second=await page.evaluate(pageSnapshot);assert.equal(second.accepted,true);assert.ok(second.controls.some(s=>/^continue$/i.test(s)),'detached Continue must be classified');assert.equal(second.ordinal,2);assert.equal(after.expression,second.expression,'repeated expressions have distinct question ordinals');
  events.length=0;await page.goto(ROOT);await page.bringToFront();const controls=await popup(b);await until(()=>controls.evaluate(()=>!document.getElementById('start').disabled));await controls.click('#start');
  const done=await until(async()=>{const s=await state();if(s?.state==='ERROR'||s?.lanes?.exercise?.state==='PAUSED')throw Error(JSON.stringify(s));const lane=s?.lanes?.exercise;if(lane?.delay&&!observations.some(x=>x.key===lane.delay.key))observations.push(structuredClone(lane.delay));return s?.state==='DONE'?s:false;},{timeout:210000,label:'three consecutive questions through detached Next, Continue and Done'});
  const checks=events.filter(e=>e.kind==='check');assert.equal(checks.length,3);assert.deepEqual(checks.map(e=>e.q),[1,2,3]);assert.ok(checks.every(e=>e.correct));assert.deepEqual(events.filter(e=>e.kind==='next').map(e=>e.q),[1,2]);assert.equal(events.filter(e=>e.kind==='done').length,1);assert.equal(events.filter(e=>e.kind==='unrelated-next').length,0);assert.equal(observations.length,3,'each actual question gets a fresh persisted pacing deadline');assert.deepEqual(done.counts,{video:0,exercise:1,answers:3});
  console.log('PASS three actual consecutive questions: identical expression at new ordinal, changed expression, once-only Checks, detached Next/Continue/Done, three pacing deadlines',JSON.stringify({events,observations,counts:done.counts}));
  if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/progression.json',JSON.stringify({browser:b.context.browser().version(),syntheticSite:true,liveClassroomVerified:false,events,observations,counts:done.counts},null,2));
 }
}finally{await b.close();}
