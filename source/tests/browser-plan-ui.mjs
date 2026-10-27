import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
import {launch,popup,until} from './browser-support.mjs';
const b=await launch(),ROOT='https://classroom.khanacademy.org/learner/class/PLANUI';
try{
 await b.context.route('https://classroom.khanacademy.org/**',r=>r.fulfill({contentType:'text/html',body:'<main>UI fixture</main>'}));const page=await b.context.newPage();await page.goto(ROOT);await page.bringToFront();
 await b.worker.evaluate(async scope=>{const items=Array.from({length:100},(_,i)=>({url:scope+'/assignment/'+i,kind:'exercise',title:'Exercise '+i,status:'ready',classification:'single-box',solver:'builtin-exact',reason:'FIRST_VISIBLE_QUESTION_SUPPORTED',visibleQuestionOnly:true}));await chrome.storage.session.set({'survey-plan':{running:false,stage:'READY',revision:1,index:100,scan:{pages:10},plan:{schema:'kubla-khan-plan-v1',scope,createdAt:Date.now(),items}}});},ROOT);
 let p=await popup(b);await until(()=>p.evaluate(()=>document.querySelectorAll('#survey-items li').length===100&&!document.getElementById('survey-run').disabled));
 const initial=await p.evaluate(()=>({height:document.getElementById('survey-items').getBoundingClientRect().height,overflow:getComputedStyle(document.getElementById('survey-items')).overflowY}));assert.ok(initial.height<=160);assert.equal(initial.overflow,'auto');
 await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));const stop=await p.evaluate(()=>{const r=document.getElementById('survey-stop').getBoundingClientRect();return {top:r.top,bottom:r.bottom,viewport:innerHeight};});assert.ok(stop.top>=0&&stop.bottom<=stop.viewport,'global Stop stays visible after scrolling');
 await page.goto(ROOT+'/assignment/0');await page.bringToFront();p=await popup(b);await until(()=>p.evaluate(()=>document.getElementById('survey-run').disabled&&document.getElementById('survey-status').textContent.includes('Return to')));
 await p.click('#survey-stop');await until(()=>b.worker.evaluate(async()=>((await chrome.storage.session.get('dual-run'))['dual-run'])?.state==='STOPPED'));assert.equal(await b.worker.evaluate(async()=>((await chrome.storage.session.get('survey-plan'))['survey-plan'])?.stage),'READY');
 console.log('PASS actual popup100-item bounded plan list, sticky visible Stop, class-list-only Run UI, Stop preserves saved plan');if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/plan-ui.json',JSON.stringify({pass:true,browser:b.context.browser().version(),syntheticStateFixture:true,initial,stop},null,2));
}finally{await b.close();}
