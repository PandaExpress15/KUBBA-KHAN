import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {launch} from './browser-support.mjs';
import {pageSnapshot,pageAction} from '../extension/automation-page.js';
const b=await launch(),url='https://classroom.khanacademy.org/learner/class/SAFETY/assignment/1';let scoped=false;
try{
 await b.context.route(url,r=>r.fulfill({contentType:'text/html',body:scoped?`<main><p>Factor the expression completely.</p><span data-tex="x^2-9">x²-9</span><input aria-label="Answer"><div>Incorrect</div></main><div><button aria-label="Next" onclick="window.hits++">➜</button></div><script>window.hits=0;</script>`:`<p>Factor the expression completely.</p><span data-tex="x^2-9">x²-9</span><input aria-label="Answer"><div>Correct!</div><button>Next</button>`}));
 const page=await b.context.newPage();await page.goto(url);const lost=await page.evaluate(pageSnapshot);
 assert.equal(lost.probe.scope,'document');assert.equal(lost.accepted,false,'missing active question scope must not accept arbitrary body Correct');assert.equal(lost.probe.feedbackCandidates,0);
 scoped=true;await page.reload();const negative=await page.evaluate(pageSnapshot);assert.equal(negative.negative,true);assert.equal(negative.accepted,false);
 const tabId=await b.worker.evaluate(async u=>(await chrome.tabs.query({})).find(t=>t.url===u).id,url);
 const args=['NEXT_QUESTION',{url,token:negative.token,accepted:negative.accepted}];
 const action=await b.worker.evaluate(`(async()=> (await chrome.scripting.executeScript({target:{tabId:${tabId}},func:${pageAction.toString()},args:${JSON.stringify(args)}}))[0].result)()`);
 assert.equal(action.ok,false,'negative/unconfirmed feedback cannot authorize external Next');assert.equal(await page.evaluate(()=>window.hits),0);
 const results={browser:b.context.browser().version(),syntheticSite:true,liveClassroomVerified:false,lostScopeAcceptanceRejected:true,negativeExternalNextRejected:true,lostProbe:lost.probe,negativeProbe:negative.probe,action};
 console.log('PASS actual question-scope loss rejects body Correct; negative/unconfirmed feedback prevents external Next',JSON.stringify(results));
 if(process.env.BROWSER_EVIDENCE_DIR)await writeFile(process.env.BROWSER_EVIDENCE_DIR+'/feedback-safety.json',JSON.stringify(results,null,2));
}finally{await b.close();}
