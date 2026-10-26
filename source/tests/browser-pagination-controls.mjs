import assert from 'node:assert/strict';
import {launch} from './browser-support.mjs';
import {paginationUI} from '../extension/pagination.js';
const b=await launch(),URL='https://classroom.khanacademy.org/learner/class/CONTROLS';
try{
 let html='';await b.context.route('https://classroom.khanacademy.org/**',r=>r.fulfill({contentType:'text/html',body:html}));
 const page=await b.context.newPage();let count=0;
 async function load(markup){
  html=`<h1>All assignments</h1><p>Current page: 1 of 5.</p>${markup}<script>window.clicks=0;document.addEventListener('click',e=>{if(e.target.closest('[data-target]'))window.clicks++;});</script>`;
  await page.goto(URL);
  return b.worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,URL);
 }
 async function action(markup,expectedState,expectedClicks=1,direction='next'){
  const id=await load(markup),args=[direction,{url:URL,page:1}];
  const result=await b.worker.evaluate(`(async()=> (await chrome.scripting.executeScript({target:{tabId:${id}},func:${paginationUI.toString()},args:${JSON.stringify(args)}}))[0].result)()`);
  assert.equal(result[direction].state,expectedState,JSON.stringify(result));
  assert.equal(result.ok,expectedState==='ready',JSON.stringify(result));
  assert.equal(await page.evaluate(()=>window.clicks),expectedClicks,markup);count++;
 }
 await action('<button data-target>Next</button>','ready');
 await action('<button data-target aria-label="Next page">Next</button>','ready');
 await action('<button data-target aria-label="Go to next page">Next</button>','ready');
 await action('<span id="name" hidden>Next page</span><button data-target aria-labelledby="name">→</button>','ready');
 await action('<a data-target rel="next" href="#page2">→</a>','ready');
 await action('<div data-target role="button" tabindex="0" aria-label="Next page">Next</div>','ready');
 await action('<input data-target type="button" value="Next page">','ready');
 await action('<button data-target title="Next page">→</button>','ready');
 await action('<button data-target aria-label="Previous page">Previous</button>','ready',1,'previous');
 await action('<button data-target aria-label="Go to previous page">Previous</button>','ready',1,'previous');
 await action('<button>Next</button><nav aria-label="Assignment pagination"><button data-target aria-label="Next page">Next</button></nav>','ready');
 await action('<button data-target disabled aria-label="Next page">Next</button>','disabled',0);
 await action('<fieldset disabled><button data-target aria-label="Next page">Next</button></fieldset>','disabled',0);
 await action('<div aria-disabled="true"><button data-target aria-label="Next page">Next</button></div>','disabled',0);
 await action('<button data-target style="pointer-events:none" aria-label="Next page">Next</button>','disabled',0);
 await action('<button data-target hidden>Next</button>','missing',0);
 await action('<button data-target>Next</button><button data-target>Next page</button>','ambiguous',0);
 await action('<a data-target href="https://example.com" aria-label="Next page">Next</a>','unsafe',0);
 await action('<a data-target href="/learner/class/OTHER" aria-label="Next page">Next</a>','unsafe',0);
 await action('<button data-target aria-label="Next question">Next</button>','missing',0);
 await action('<button data-target aria-label="Previous page">Next</button>','missing',0);
 const id=await load('<button data-target>Next</button>');
 for(const expected of [{url:URL,page:4},{url:URL+'?stale',page:1}]){
  const args=['next',expected];
  const result=await b.worker.evaluate(`(async()=> (await chrome.scripting.executeScript({target:{tabId:${id}},func:${paginationUI.toString()},args:${JSON.stringify(args)}}))[0].result)()`);
  assert.equal(result.error,'STALE_LIST_PAGE');assert.equal(await page.evaluate(()=>window.clicks),0);count++;
 }
 console.log(`PASS ${count} real DOM pagination cases: visible/accessibility/relationship labels, scoped disambiguation, disabled ancestors, stale/foreign targets and no exercise-Next confusion`);
}finally{await b.close();}
