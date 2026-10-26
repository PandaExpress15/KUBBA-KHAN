import assert from 'node:assert/strict';
import {launch,popup,until} from './browser-support.mjs';
import {ROOT,exerciseHTML} from './classroom-fixture.mjs';
const b=await launch(),events=[];
try{
 await b.context.exposeBinding('recordFixture',(_,e)=>events.push(e));
 await b.context.route('https://classroom.khanacademy.org/**',r=>r.fulfill({contentType:'text/html',body:exerciseHTML({questions:1})}));
 const page=await b.context.newPage();await page.goto(ROOT+'/assignment/exercise-manual');await page.bringToFront();
 const p=await popup(b);
 async function click(selector){await p.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center'}),selector);await p.click(selector);}
 await click('summary');await click('#read');
 await until(()=>p.evaluate(()=>document.getElementById('expression').value==='10x^2+13x+4'),{label:'manual Read'});
 await click('#solve');await click('#insert');
 const answer=await until(()=>page.evaluate(()=>fixtureAnswer()),{label:'manual INSERT through MV3 worker'});
 assert.ok(['(2x+1)(5x+4)','(5x+4)(2x+1)'].includes(answer.replace(/[ *]/g,'')));
 assert.equal(events.filter(e=>e.kind==='check').length,0);
 console.log('PASS actual popup manual Read/Solve/Insert → MV3 static import → controlled native field; no Check');
}finally{await b.close();}
