import assert from 'node:assert/strict';
import {launch,popup,until} from './browser-support.mjs';
import {ROOT,listHTML} from './classroom-fixture.mjs';
const b=await launch();
try{
 await b.context.exposeBinding('recordFixture',()=>{});
 await b.context.route('https://classroom.khanacademy.org/**',r=>r.fulfill({contentType:'text/html',body:listHTML()}));
 const source=await b.context.newPage();await source.goto(ROOT);
 const meta=await b.context.newPage();await meta.goto('chrome://extensions/');
 const oldWorker=b.worker,newWorker=b.context.waitForEvent('serviceworker',{timeout:15000,predicate:w=>w!==oldWorker});
 newWorker.catch(()=>{});
 await meta.evaluate(id=>chrome.developerPrivate.reload(id,{failQuietly:true}),b.id);
 await until(async()=> (await meta.evaluate(()=>chrome.developerPrivate.getExtensionsInfo({includeDisabled:true}))).some(e=>e.id===b.id&&e.state==='ENABLED'),{label:'extension reload enabled'});
 const wake=await b.context.newPage();await wake.goto(`chrome-extension://${b.id}/popup.html`);b.worker=await newWorker;await wake.close();await meta.close();
 await source.bringToFront();const p=await popup(b);await p.click('#start');
 const read=async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run'];
 await until(async()=>{const s=await read();if(s?.state==='ERROR')throw Error(JSON.stringify(s));return s?.state==='RUNNING';},{timeout:25000,label:'reload reattaches content pulses for multipage discovery'});
 const state=await read();assert.equal(state.jobs.video.length,2);assert.equal(state.jobs.exercise.length,2);
 const stop=await popup(b);await stop.click('#stop');
 console.log('PASS real extension reload, existing class-list tab, immediate pointer Start, multipage queue via live content pulses');
}catch(e){console.error('RELOAD ERROR',e);console.error('RELOAD STATE',JSON.stringify(await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')).catch(()=>null)));throw e;}
finally{await b.close();}
