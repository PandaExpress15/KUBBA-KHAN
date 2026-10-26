import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {launch,popup,until,wait} from './browser-support.mjs';
const ROOT='https://classroom.khanacademy.org/learner/class/PAGINATION_FIXTURE';
const b=await launch(),visits=[];let startPage=1,controlDelay=0;
function html(){return `<!doctype html><html><head><style>body{font:16px system-ui;background:#252630;color:#eee;margin:40px}table{width:100%;margin:30px 0}td{padding:14px}a{color:#8aa9ff}nav{display:flex;justify-content:space-between}button{font:inherit;color:#8aa9ff;background:none;border:0;cursor:pointer}button:disabled{color:#777}[data-waiting]{display:none}</style></head><body><h1>All assignments</h1><select aria-label="Assignment Status"><option>To-do</option></select><main><table><thead><tr><th>Assignment Name</th><th>Due Date</th><th>Type</th></tr></thead><tbody id="rows"></tbody></table><nav aria-label="Assignment pagination"><span id="counter"></span><div><button id="previous" aria-label="Previous page">Previous</button> | <button id="next" aria-label="Next page" ${controlDelay?'data-waiting':''}>Next</button></div></nav></main><script>
 let page=${startPage};const pages=5;
 function render(){window.recordPage(page);const article=page===2;document.getElementById('counter').textContent='Current page: '+page+' of '+pages+'.';document.getElementById('rows').innerHTML=article?'<tr><td><a href="${ROOT}/assignment/article">Reference</a></td><td>Tomorrow</td><td>Article</td></tr>':'<tr><td><a href="${ROOT}/assignment/video'+page+'">Video assignment</a></td><td>Tomorrow</td><td>Video</td></tr><tr><td><a href="${ROOT}/assignment/exercise'+page+'">Exercise assignment</a></td><td>Tomorrow</td><td>Exercise</td></tr>';document.getElementById('previous').disabled=page===1;document.getElementById('next').disabled=page===pages;}
 document.getElementById('previous').onclick=()=>setTimeout(()=>{page--;render();},100);document.getElementById('next').onclick=()=>setTimeout(()=>{page++;render();},100);render();${controlDelay?`setTimeout(()=>document.getElementById('next').removeAttribute('data-waiting'),${controlDelay});`:''}
 </script></body></html>`;}
try{
 await b.context.exposeBinding('recordPage',(_,page)=>visits.push(page));
 await b.context.route('https://classroom.khanacademy.org/**',r=>r.fulfill({contentType:'text/html',body:r.request().url().includes('/assignment/')?'<main>Fixture assignment loading</main>':html()}));
 const source=await b.context.newPage();await source.goto(ROOT);await source.bringToFront();
 const state=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
 async function start(){const p=await popup(b);await p.click('#start');await until(async()=>{const s=await state();if(s?.state==='ERROR')throw Error(JSON.stringify({state:s.state,error:s.errors.at(-1)?.code,probe:s.scan?.probe}));return s?.state==='RUNNING';},{timeout:50000,label:'five-page classroom queue'});await until(()=>b.context.pages().filter(p=>p.url().includes('/assignment/')).length===2,{timeout:10000,label:'both work tabs finish their initial navigation'});return p;}
 await start();
 let run=await state();assert.equal(run.jobs.video.length,4);assert.equal(run.jobs.exercise.length,4);assert.deepEqual(visits,[1,2,3,4,5]);assert.equal(b.context.pages().filter(p=>p.url().includes('/assignment/')).length,2);
 let p=await popup(b);await p.click('#stop');await until(async()=> (await state()).state==='STOPPED');
 console.log('PASS actual popup Start → five-page scan with Next page accessible names, article-only page, two work tabs');
 for(const page of b.context.pages())if(page!==source&&page.url().includes('/assignment/'))await page.close();
 startPage=5;visits.length=0;await source.goto(ROOT);await source.bringToFront();await start();
 run=await state();assert.equal(run.jobs.video.length,4);assert.equal(run.jobs.exercise.length,4);assert.deepEqual(visits,[5,4,3,2,1,2,3,4,5]);
 p=await popup(b);await p.click('#stop');
 console.log('PASS actual Previous page controls return to page one before collecting all five pages');
 for(const page of b.context.pages())if(page!==source&&page.url().includes('/assignment/'))await page.close();
 startPage=1;controlDelay=6000;visits.length=0;await source.goto(ROOT);await source.bringToFront();
 p=await popup(b);await p.click('#start');
 await until(async()=> (await state()).scan?.probe?.waitingFor==='next',{label:'waiting for delayed Next control'});
 assert.equal((await state()).state,'DISCOVERING');
 await until(async()=>{const s=await state();if(s.state==='ERROR')throw Error(JSON.stringify(s.errors));return s.state==='RUNNING';},{timeout:40000,label:'delayed Next becomes ready'});
 assert.deepEqual(visits,[1,2,3,4,5]);
 p=await popup(b);await p.click('#stop');
 console.log('PASS delayed pagination controls wait safely, then collect the full queue');
 for(const page of b.context.pages())if(page!==source&&page.url().includes('/assignment/'))await page.close();
 visits.length=0;await source.goto(ROOT);await source.bringToFront();p=await popup(b);await p.click('#start');
 await until(async()=> (await state()).scan?.probe?.waitingFor==='next',{label:'Stop while waiting for Next'});
 await p.click('#stop');await until(async()=> (await state()).state==='STOPPED');await wait(8500);
 assert.deepEqual(visits,[1]);assert.equal((await state()).state,'STOPPED');
 console.log('PASS Stop during pagination wait: no automatic Next after the control appears');
 if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/pagination-events.json',JSON.stringify({browser:b.context.browser().version(),version:await b.worker.evaluate(()=>chrome.runtime.getManifest().version),visits,queued:{video:run.jobs.video.length,exercise:run.jobs.exercise.length},syntheticFixture:true,ownerDOMAttributesVerified:false},null,2));
}finally{await b.close();}
