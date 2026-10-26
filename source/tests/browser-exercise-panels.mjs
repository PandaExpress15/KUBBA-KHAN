import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {launch,popup,until} from './browser-support.mjs';
import {pageSnapshot,pageAction} from '../extension/automation-page.js';
const b=await launch(),ROOT='https://classroom.khanacademy.org/learner/class/PANELS',events=[];
let controls,delayStem=false;
const canonical=s=>s.replace(/\\(?:left|right)/g,'').replace(/\\cdot/g,'').replace(/\s/g,'').replace(/\*/g,'').replace(/\^\{(\d+)\}/g,'^$1');
const questions=[
 {prompt:'Factor the quadratic expression completely.',tex:'10x^2+13x+4',answers:['(2x+1)(5x+4)','(5x+4)(2x+1)']},
 {prompt:'Factor completely.',tex:'x^2-9',answers:['(x-3)(x+3)','(x+3)(x-3)']},
 {prompt:'Factor out the greatest common factor, then factor completely.',tex:'6x^3-24x',answers:['6x(x-2)(x+2)','6x(x+2)(x-2)']},
 {prompt:'Reduce the rational expression to lowest terms.',tex:'\\frac{x^2-9}{x+3}',answers:['x-3']},
 {prompt:'Solve for x.',tex:'3x+5=20',answers:['5']},
 {prompt:'Find the exact value.',tex:'\\cos\\left(\\frac{\\pi}{6}\\right)',answers:['\\frac{\\sqrt{3}}{2}']},
 {prompt:'Expand and combine like terms.',tex:'(2x+3)(x-4)',answers:['2x^2-5x-12']},
 {prompt:'Calculate.',tex:'\\frac{7}{3}+\\frac{5}{6}',answers:['\\frac{19}{6}','19/6']}
];
function html(){
 return `<html><head><link rel="stylesheet" href="/vendor/mathquill/mathquill.css"><script src="/vendor/jquery.js"></script><script src="/vendor/mathquill/mathquill.js"></script></head><body><h1>Assignment title</h1><aside><button>Next question</button><p role="status">Correct!</p></aside><header id="ordinal"></header><main><section data-testid="question-area"><div id="stem" class="perseus-renderer"></div><div class="perseus-renderer" id="response"><math><annotation encoding="application/x-tex">=</annotation></math><span id="editor"></span></div></section><footer><button id="check" aria-label="Check answer">Check</button><p role="status" id="feedback"></p><button id="next" hidden>Next question</button><button id="done" hidden>Done</button></footer></main><script>
 const questions=${JSON.stringify(questions)},record=(kind,data={})=>window.recordPanels({kind,...data});let q=0,field;
 const MQ=MathQuill.getInterface(2);delete window.MathQuill;
 const canon=${canonical.toString()};
 function render(){
  document.getElementById('ordinal').textContent=(q+1)+' of '+questions.length+' questions';
  const stem=()=>{document.getElementById('stem').innerHTML='<p>'+questions[q].prompt+'</p><math><annotation encoding="application/x-tex">'+questions[q].tex+'</annotation></math>';record('stem-visible',{q});};
  if(q===0&&${delayStem})setTimeout(stem,6000);else stem();
  document.getElementById('editor').outerHTML='<span id="editor"></span>';field=MQ.MathField(document.getElementById('editor'),{statelessClipboard:q%2===1});
  document.getElementById('check').hidden=false;document.getElementById('next').hidden=true;document.getElementById('done').hidden=true;document.getElementById('feedback').textContent='';
 }
 document.getElementById('check').onclick=()=>{const value=field.latex(),correct=questions[q].answers.some(a=>canon(a)===canon(value));record('check',{q,value,correct});document.getElementById('feedback').textContent=correct?'Correct!':'Incorrect';if(correct){document.getElementById('check').hidden=true;document.getElementById(q===questions.length-1?'done':'next').hidden=false;}};
 document.getElementById('next').onclick=()=>{record('next',{q});q++;render();};document.getElementById('done').onclick=()=>{record('done',{q});document.querySelector('main').innerHTML='<p role="status">Exercise complete</p>';};render();
 </script></body></html>`;
}
const state=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
try{
 await b.context.exposeBinding('recordPanels',(_,e)=>events.push(e));
 await b.context.route('https://classroom.khanacademy.org/**',async r=>{
  const u=new URL(r.request().url());
  if(u.pathname.startsWith('/vendor/'))return r.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript',body:await readFile(new URL('.'+u.pathname,import.meta.url))});
  return r.fulfill({contentType:'text/html',body:u.pathname.includes('/assignment/')?html():`<select><option>To-do</option></select><table><tr><td><a href="${ROOT}/assignment/1">Exercise fixture</a></td><td>Exercise</td></tr></table><p>Current page: 1 of 1.</p>`});
 });
 const page=await b.context.newPage();await page.goto(ROOT+'/assignment/1');await page.locator('.mq-editable-field').waitFor();
 const before=await page.evaluate(pageSnapshot);console.log('NESTED SNAPSHOT',JSON.stringify(before));
 assert.equal(before.expression,questions[0].tex,'question stem must remain readable outside the response renderer');
 assert.equal(before.operation,'factor');assert.equal(before.fieldCount,1);assert.ok(before.controls.includes('Check answer'),'sibling footer must be included');
 // A second independent expression must still stop, and unrelated outside UI cannot count as feedback.
 assert.equal(before.accepted,false);
 for(const label of ['=','x =','f(x) =']){
  await page.locator('#response annotation').evaluate((e,s)=>e.textContent=s,label);
  const p=await page.evaluate(pageSnapshot);assert.equal(p.expression,questions[0].tex);assert.equal(p.probe.answerLabels,1);
 }
 await page.locator('#response annotation').evaluate(e=>e.textContent='=');
 await page.locator('main').evaluate(e=>e.insertAdjacentHTML('beforeend','<p id="conflict">Solve for x.</p>'));
 assert.equal((await page.evaluate(pageSnapshot)).operation,null,'conflicting directions must not be guessed');
 await page.locator('#conflict').evaluate(e=>e.remove());
 await page.locator('#stem').evaluate(e=>e.insertAdjacentHTML('beforeend','<math><annotation encoding="application/x-tex">x+9</annotation></math>'));
 assert.equal((await page.evaluate(pageSnapshot)).expression,'');
 delayStem=true;await page.goto(ROOT);await page.bringToFront();controls=await popup(b);await until(()=>controls.evaluate(()=>!document.getElementById('start').disabled));await controls.click('#start');
 const waiting=await until(async()=>{const s=await state();return s?.lanes?.exercise?.state==='WAITING_FOR_QUESTION'?s:false;},{timeout:10000,label:'delayed question waits without inserting'});
 assert.equal(events.filter(e=>e.kind==='check').length,0);assert.equal(waiting.lanes.exercise.probe.readState,'NO_QUESTION_MATH');
 const result=await until(async()=>{const s=await state();if(s?.state==='ERROR'||s?.lanes?.exercise?.state==='PAUSED')throw Error(JSON.stringify(s));return s?.state==='DONE'?s:false;},{timeout:240000,label:'eight mixed-format nested MathQuill questions'});
 assert.deepEqual(result.counts,{video:0,exercise:1,answers:questions.length});
 assert.equal(events.filter(e=>e.kind==='check').length,questions.length);assert.ok(events.filter(e=>e.kind==='check').every(e=>e.correct));
 assert.deepEqual(events.filter(e=>e.kind==='check').map(e=>e.q),questions.map((_,i)=>i));
 assert.equal(events.filter(e=>e.kind==='next').length,questions.length-1);assert.equal(events.filter(e=>e.kind==='done').length,1);
 console.log('PASS six-second question loading wait; eight nested-panel questions through actual no-global MathQuill, mixed clipboard modes, verified answer entry, once-only Check, feedback, seven Next and Done',JSON.stringify(events));
 if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/exercise-panels.json',JSON.stringify({browser:b.context.browser().version(),syntheticSite:true,liveKhanVerified:false,events,counts:result.counts},null,2));
}finally{await b.close();}
