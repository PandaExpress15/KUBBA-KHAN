import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {launch,popup,until} from './browser-support.mjs';
import {pageSnapshot,pageAction} from '../extension/automation-page.js';
import {insertReviewed} from '../extension/input.js';
const b=await launch(),ROOT='https://classroom.khanacademy.org/learner/class/READABLE',events=[],results=[];
let mode='data-tex';
const sources={
 'hidden-accessible-math':'<span class="katex"><span class="katex-mathml" style="visibility:hidden;position:absolute"><math><annotation encoding="application/x-tex">10x^2+13x+4</annotation></math></span><span class="katex-html">10x²+13x+4</span></span>',
 'data-tex':'<span data-tex="10x^2+13x+4">10x² + 13x + 4</span>',
 'mathjax-script':'<span class="MathJax" role="presentation">10x² + 13x + 4</span><script type="math/tex">10x^2+13x+4</script>',
 'accessible-math':'<span role="math" aria-label="10x^2+13x+4">10x² + 13x + 4</span>',
 'rendered-sup':'<span class="katex">10x<sup>2</sup>+13x+4</span>',
 'mathml':'<math><mrow><mfrac><mn>10</mn><mn>1</mn></mfrac><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mn>13</mn><mi>x</mi><mo>+</mo><mn>4</mn></mrow></math>'
};
function html(){return `<h1>Factor quadratics by grouping</h1><header>3 of 4 questions</header><main><p>Factor the quadratic expression completely.</p><div id="problem">${sources[mode]}<span>=</span><input id="answer" aria-label="Answer"></div></main><footer><button id="check">Check</button><p role="status" id="feedback"></p><button id="done" hidden>Done</button></footer><script>
 document.getElementById('check').onclick=()=>{const value=document.getElementById('answer').value;window.recordReadable({kind:'check',value});const normalized=value.replace(/[ *]/g,'');const correct=['(2x+1)(5x+4)','(5x+4)(2x+1)'].includes(normalized);document.getElementById('feedback').textContent=correct?'Correct!':'Incorrect';if(correct){document.getElementById('check').hidden=true;document.getElementById('done').hidden=false;}};
 document.getElementById('done').onclick=()=>{window.recordReadable({kind:'done'});document.querySelector('main').innerHTML='<p role="status">Exercise complete</p>';document.querySelector('footer').remove();};
 </script>`;}
try{
 await b.context.exposeBinding('recordReadable',(_,e)=>events.push(e));
 await b.context.route('https://classroom.khanacademy.org/**',r=>r.fulfill({contentType:'text/html',body:r.request().url().includes('/assignment/')?html():`<select><option>To-do</option></select><table><tr><td><a href="${ROOT}/assignment/1">Factor quadratics</a></td><td>Exercise</td></tr></table><p>Current page: 1 of 1.</p>`}));
 const page=await b.context.newPage();
 for(mode of Object.keys(sources)){
  await page.goto(ROOT+'/assignment/1');const p=await page.evaluate(pageSnapshot);
  console.log('READABLE CASE',mode,JSON.stringify(p));results.push({source:mode,expression:p.expression,probe:p.probe});
  assert.ok(p.expression,'displayed math must be read: '+mode);
  const {solveSupported,equivalent}=await import('../extension/advanced-math.js');const solved=solveSupported(p.expression,p.operation);assert.equal(solved.status,'solved');assert.ok(equivalent(solved.answer,'(2x+1)(5x+4)'));
  assert.equal(p.fieldCount,1);assert.equal(p.operation,'factor');assert.ok(p.controls.includes('Check'),'detached footer Check must be reachable');
  await page.locator('#problem').evaluate(e=>e.insertAdjacentHTML('afterbegin','<span data-tex="x+99">x+99</span>'));
  const tabId=await b.worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,p.url);
  const invoke=(fn,args)=>b.worker.evaluate(`(async()=> (await chrome.scripting.executeScript({target:{tabId:${tabId}},world:'MAIN',func:${fn.toString()},args:${JSON.stringify(args)}}))[0].result)()`);
  const stale=await invoke(pageAction,['CHECK',{url:p.url,token:p.token}]);
  assert.equal(stale.ok,false,'changed public math must reject stale Check');assert.equal(events.length,0);
  const insert=await invoke(insertReviewed,[{answer:'2',latex:'2'},p.token]);assert.equal(insert.ok,false,'changed public math must reject stale entry');assert.equal(await page.locator('#answer').inputValue(),'');
 }
 mode='data-tex';await page.goto(ROOT);await page.bringToFront();const controls=await popup(b);await until(()=>controls.evaluate(()=>!document.getElementById('start').disabled));await controls.click('#start');
 const state=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
 const run=await until(async()=>{const s=await state();if(s?.state==='ERROR'||s?.lanes?.exercise?.state==='PAUSED')throw Error(JSON.stringify(s));return s?.state==='DONE'?s:false;},{timeout:90000,label:'readable math through one native exercise and detached Check/Done'});
 assert.deepEqual(run.counts,{video:0,exercise:1,answers:1});assert.equal(events.filter(e=>e.kind==='check').length,1);assert.equal(events.filter(e=>e.kind==='done').length,1);
 console.log('PASS five non-annotation math representations plus visible-host hidden accessible math, stale public-math entry/Check rejection, one actual exercise with detached footer Check/Done',JSON.stringify(events));
 if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/readable-math.json',JSON.stringify({browser:b.context.browser().version(),syntheticSite:true,liveClassroomVerified:false,results,events,counts:run.counts},null,2));
}finally{await b.close();}
