import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {launch,popup,until} from './browser-support.mjs';
import {pageSnapshot} from '../extension/automation-page.js';
import {solveSupported as currentSolve} from '../extension/advanced-math.js';
const solve=process.env.BASELINE_SOLVER_PATH?(await import(pathToFileURL(process.env.BASELINE_SOLVER_PATH))).solveSupported:currentSolve;
const b=await launch(),ROOT='https://classroom.khanacademy.org/learner/class/POLYNOMIAL',events=[],observations=[];
const cases=[
 {expression:'x^5-x^4+3x-3',factors:['x-1','x^4+3']},
 {expression:'x^6-x^4+3x^2-3',factors:['x-1','x+1','x^4+3']},
 {expression:'x^5+2x^4+5x+10',factors:['x+2','x^4+5']}
];
// Independent grading: exact hand-derived factor multisets, not solver equivalence.
function grade(value,expected){
 const canonical=value.replace(/\\(?:left|right)/g,'').replace(/\\cdot/g,'*').replace(/\s/g,'').replace(/\^\{(\d+)\}/g,'^$1');
 const factors=[...canonical.matchAll(/\(([^()]*)\)/g)].map(m=>m[1]);
 const scalar=canonical.replace(/\([^()]*\)/g,'').replace(/\*/g,'');
 return (scalar===''||scalar==='1')&&JSON.stringify(factors.sort())===JSON.stringify([...expected].sort());
}
const html=()=>`<!doctype html><html><head><link rel="stylesheet" href="/vendor/mathquill/mathquill.css"><script src="/vendor/jquery.js"></script><script src="/vendor/mathquill/mathquill.js"></script></head><body><header id="ordinal"></header><main><p>Factor the polynomial completely.</p><span id="math" data-tex=""></span><span>=</span><span id="answer"></span><div id="feedback"></div></main><div class="right-rail"><button id="check" aria-label="Check">✓</button><button id="next" hidden aria-labelledby="next-label">➜</button><span id="next-label" hidden>Next</span><button id="done" hidden>Done</button></div><script>
 const cases=${JSON.stringify(cases)},grade=${grade.toString()},MQ=MathQuill.getInterface(2);delete window.MathQuill;let q=0,field;
 const record=(kind,data={})=>window.recordPolynomial({kind,q:q+1,at:Date.now(),...data});
 function render(){document.getElementById('ordinal').textContent=(q+1)+' of 3 questions';const math=document.getElementById('math');math.setAttribute('data-tex',cases[q].expression);math.textContent=cases[q].expression;document.getElementById('answer').outerHTML='<span id="answer"></span>';field=MQ.MathField(document.getElementById('answer'),{statelessClipboard:q%2===1});window.readPolynomial=()=>field.latex();document.getElementById('feedback').textContent='';document.getElementById('check').hidden=false;document.getElementById('next').hidden=true;document.getElementById('next-label').hidden=true;document.getElementById('done').hidden=true;record('question');}
 document.getElementById('check').onclick=()=>{const value=field.latex(),correct=grade(value,cases[q].factors);record('check',{value,correct});document.getElementById('feedback').textContent=correct?'Correct!':'Incorrect';if(correct){document.getElementById('check').hidden=true;if(q===2)document.getElementById('done').hidden=false;else{document.getElementById('next').hidden=false;document.getElementById('next-label').hidden=false;}}};
 document.getElementById('next').onclick=()=>{record('next');q++;render();};document.getElementById('done').onclick=()=>{record('done');document.querySelector('main').innerHTML='<p role="status">Exercise complete</p>';document.querySelector('.right-rail').remove();};render();
 </script></body></html>`;
const state=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
try{
 await b.context.exposeBinding('recordPolynomial',(_,e)=>events.push(e));
 await b.context.route('https://classroom.khanacademy.org/**',async r=>{
  const u=new URL(r.request().url());if(u.pathname.startsWith('/vendor/'))return r.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript',body:await readFile(new URL('.'+u.pathname,import.meta.url))});
  return r.fulfill({contentType:'text/html',body:u.pathname.includes('/assignment/')?html():`<select><option>To-do</option></select><table><tr><td><a href="${ROOT}/assignment/1">Factor polynomials</a></td><td>Exercise</td></tr></table><p>Current page: 1 of 1.</p>`});
 });
 const page=await b.context.newPage();await page.goto(ROOT+'/assignment/1');await page.locator('.mq-editable-field').waitFor();
 assert.equal(await page.evaluate(()=>typeof window.MathQuill),'undefined');const first=await page.evaluate(pageSnapshot);const solved=solve(first.expression,first.operation);console.log('POLYNOMIAL FIRST READ/SOLVE',JSON.stringify({expression:first.expression,operation:first.operation,solution:solved}));assert.equal(solved.status,'solved','visible screenshot polynomial must factor completely');assert.ok(grade(solved.latex,cases[0].factors),'independently expected complete factor multiset');
 if(!process.env.BASELINE_SOLVER_PATH){
  await page.locator('main p').evaluate(e=>e.textContent='Factor completely over the real numbers.');const realDomain=await page.evaluate(pageSnapshot);assert.equal(realDomain.unsupportedFactorDomain,true,'explicit real factorization cannot use rational-only certificates');await page.locator('main p').evaluate(e=>e.textContent='Factor the polynomial completely.');
  for(const c of cases){const r=solve(c.expression,'factor');assert.equal(r.status,'solved',JSON.stringify(r));assert.ok(grade(r.latex,c.factors),JSON.stringify(r));}
  events.length=0;await page.goto(ROOT);await page.bringToFront();const controls=await popup(b);await until(()=>controls.evaluate(()=>!document.getElementById('start').disabled));await controls.click('#start');
  const done=await until(async()=>{const s=await state();if(s?.state==='ERROR'||s?.lanes?.exercise?.state==='PAUSED')throw Error(JSON.stringify(s));const d=s?.lanes?.exercise?.delay;if(d&&!observations.some(o=>o.key===d.key)){observations.push(structuredClone(d));console.log('POLYNOMIAL PACING',observations.length,d.seconds);}return s?.state==='DONE'?s:false;},{timeout:240000,label:'three higher-degree polynomial questions through real no-global MathQuill'});
  const checks=events.filter(e=>e.kind==='check');assert.deepEqual(checks.map(e=>e.q),[1,2,3]);assert.ok(checks.every(e=>e.correct));for(const [i,c]of checks.entries())assert.ok(grade(c.value,cases[i].factors));assert.deepEqual(events.filter(e=>e.kind==='next').map(e=>e.q),[1,2]);assert.equal(events.filter(e=>e.kind==='done').length,1);assert.equal(observations.length,3);assert.deepEqual(done.counts,{answers:3,exercise:1,video:0});
  const results={browser:b.context.browser().version(),syntheticSite:true,liveClassroomVerified:false,independentFixedFactorGrading:true,realMathQuillNoGlobal:true,cases,events,observations,counts:done.counts};console.log('PASS three complete higher-degree factorizations through actual no-global MathQuill, independent factor grading, three Checks/two Next/one Done',JSON.stringify(results));
  if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/polynomial-factor.json',JSON.stringify(results,null,2));
 }
}finally{await b.close();}
