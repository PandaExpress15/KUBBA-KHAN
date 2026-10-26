import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {launch,popup,wait,until} from './browser-support.mjs';
const b=await launch();
try{
 const root='https://classroom.khanacademy.org/learner/class/POPUP';
 let html='<h1>All assignments</h1><p>Loading assignments…</p>';
 await b.context.route('https://classroom.khanacademy.org/**',r=>r.fulfill({contentType:'text/html',body:html}));
 const source=await b.context.newPage();await source.goto(root);await source.bringToFront();
 const p=await popup(b);await wait(700);
 const geometry=await p.evaluate(()=>({width:innerWidth,height:innerHeight,button:document.getElementById('start').getBoundingClientRect().toJSON(),state:document.getElementById('state').textContent}));
 console.log('ACTUAL POPUP',JSON.stringify(geometry));
 if(process.env.POPUP_SCREENSHOT)await writeFile(process.env.POPUP_SCREENSHOT,await p.screenshot());
 assert.ok(geometry.button.bottom<=geometry.height,'Start must be fully visible in Chrome’s actual action popup');
 await p.click('#start');
 await until(async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run']?.scan?.probe!=null,{label:'pointer Start crosses popup → worker → queue read'});
 const state=await b.worker.evaluate(()=>chrome.storage.session.get('dual-run'));
 assert.equal(state['dual-run'].scan.probe.supportedRows,0);
 await p.click('#stop');
 await until(async()=> (await b.worker.evaluate(()=>chrome.storage.session.get('dual-run')))['dual-run']?.state==='STOPPED',{label:'pointer Stop'});
 console.log('PASS actual popup: pointer Start and Stop, runtime messaging, immediate DOM queue probe, all primary controls above fold');
 html=`<h1>All assignments</h1><table><tr><td><a href="${root}/assignment/1">Practice</a></td><td>Exercise</td></tr></table><p>Current page: 1 of 1.</p>`;
 await source.goto(root);await source.bringToFront();const fast=await popup(b);await wait(100);
 const stopped=await fast.evaluate(async()=>{
  document.getElementById('start').click();document.getElementById('stop').click();
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  return chrome.runtime.sendMessage({type:'AUTO_STATUS',tabId:tab.id});
 });
 assert.equal(stopped.run.state,'STOPPED','status response serialized after actual Stop');
 const tabs=await b.worker.evaluate(()=>chrome.tabs.query({}));
 assert.equal(tabs.filter(t=>t.url?.startsWith(root)).length,1,'Stop cancels queued Start before it can create/navigate work tabs');
 console.log('PASS rapid Start/Stop cancels pending startup without creating work tabs');
}finally{await b.close();}
