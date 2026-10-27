import test from 'node:test';import assert from 'node:assert/strict';
import {DualRunner,classScope,collectJobs,problemKey,algebraEqual,answerDelaySeconds} from '../extension/dual.js';
import {pageSnapshot,pageAction,mediaStep,stopMedia,readEditor} from '../extension/automation-page.js';
import {paginationUI} from '../extension/pagination.js';
import {insertReviewed} from '../extension/input.js';
const ROOT='https://classroom.khanacademy.org/learner/class/FIXTURE';
function fixture({pages=1,questions=2,wrong=false,unsupported=false,unknownSubmit=false,iframe=false,initialPage=1,articleFirst=false}={}){
 let time=100000,page=initialPage,nextId=20,checks=0,insertions=0,plays=0,stops=0;const storage={},tabs=new Map([[7,{id:7,url:ROOT}]]),models=new Map(),calls=[],alarms=new Set();
 const items=Array.from({length:pages},(_,i)=>[{url:ROOT+'/assignment/video'+i,kind:'video'},{url:ROOT+'/assignment/exercise'+i,kind:'exercise'}]);
 if(articleFirst)items[0]=[];
 function model(url){if(!models.has(url))models.set(url,{q:1,value:'',accepted:false,done:false,ended:false});return models.get(url);}
 const api={storage:{session:{async get(k){return {[k]:structuredClone(storage[k])};},async set(p){Object.assign(storage,structuredClone(p));}}},alarms:{async create(n){alarms.add(n);},async clear(n){alarms.delete(n);}},tabs:{async get(id){if(!tabs.has(id))throw Error('closed');return {...tabs.get(id)};},async update(id,p){Object.assign(tabs.get(id),p);return tabs.get(id);},async create(p){const t={id:nextId++,...p};tabs.set(t.id,t);return t;},async sendMessage(){return {ok:true};}},scripting:{async executeScript({target,func,args=[],files,world}){
  calls.push({target,name:func?.name||'files',args,world});if(files)return [{result:undefined}];
  const tab=tabs.get(target.tabId);if(!tab)throw Error('closed');const m=model(tab.url);let r;
  if(func===pageSnapshot){
   if(tab.url===ROOT)r={url:ROOT,token:ROOT+'|',items:items[page-1],assignmentCount:items[page-1].length||3,page,pages,isTodo:true,controls:page<pages?['Next']:[]};
   else{const expression=unsupported?'\\sin(x)':'10x^2+13x+4';r={url:tab.url,token:tab.url+'|'+expression,expression,operation:'factor',fieldCount:m.done?0:1,fieldValue:m.value,mathquill:false,ordinal:m.q,total:questions,accepted:m.accepted,negative:wrong&&m.accepted,done:m.done,radioCount:0,controls:m.done?[]:m.accepted?(m.q===questions?['Done']:['Next question']):['Check']};}
  }else if(func===paginationUI){const [action]=args;if(action==='next')page++;if(action==='previous')page--;r={ok:true,page,pages,next:{state:page<pages?'ready':'disabled',enabled:page<pages?1:0,found:1},previous:{state:page>1?'ready':'disabled',enabled:page>1?1:0,found:1},conflictingLabels:0};
  }else if(func===pageAction){const [action]=args;if(action==='LIST_NEXT')page++;if(action==='LIST_PREVIOUS')page--;if(action==='CHECK'){checks++;if(!unknownSubmit)m.accepted=true;}if(action==='NEXT_QUESTION'){m.q++;m.value='';m.accepted=false;}if(action==='FINISH')m.done=true;r={ok:true};
  }else if(func===insertReviewed){insertions++;if(m.value)r={ok:false,error:'ANSWER_FIELD_NOT_EMPTY'};else{m.value=args[0].answer;r={ok:true,kind:'plain'};}}
  else if(func===mediaStep){plays++;r={videos:iframe&&target.frameIds[0]===0?[]:[{time:m.ended?10:time/1000,rate:2,duration:10,paused:false,ended:m.ended,error:''}]};}
  else if(func===stopMedia){stops++;r={ok:true};}else if(func===readEditor)r={ok:false};else throw Error('unknown function');
  return [{result:r,frameId:target.frameIds[0]}];
 }}};
 const runner=new DualRunner(api,()=>time,()=>0);
 return {runner,api,tabs,models,calls,alarms,storage,now:()=>time,advance(ms=5000){time+=ms;},endVideos(){for(const [url,m]of models)if(url.includes('/video'))m.ended=true;},get checks(){return checks;},get insertions(){return insertions;},get plays(){return plays;},get stops(){return stops;},async tick({waitForDelay=true}={}){time+=5000;await runner.tick();
 // Unrelated flow tests advance the fake clock to the real persisted deadline.
 // Dedicated pacing tests below disable this helper and observe every boundary.
 if(waitForDelay){const lane=(await runner.get()).lanes.exercise;if(lane?.state==='WAITING_BEFORE_ANSWER'){time=Math.max(time,lane.delay.until);await runner.tick(lane.tabId);}}
 }};
}
test('queue only accepts supported, same-class, unique assignment links',()=>{const q=collectJobs([{kind:'video',url:ROOT+'/assignment/1'},{kind:'video',url:ROOT+'/assignment/1#x'},{kind:'exercise',url:'https://evil.com/assignment/2'},{kind:'exercise',url:ROOT+'X/assignment/2'},{kind:'article',url:ROOT+'/assignment/3'}],ROOT);assert.equal(q.video.length,1);assert.equal(q.exercise.length,0);});
test('class scope only on actual classroom URL',()=>{assert.equal(classScope(ROOT+'/assignment/1'),ROOT);assert.throws(()=>classScope('https://www.khanacademy.org/math'));});
test('problem signatures distinguish repeated expression at another ordinal',async()=>{const p={url:ROOT+'/assignment/1',expression:'x+1',operation:'factor',ordinal:1};const key=await problemKey(p);assert.match(key,/^[a-f0-9]{64}$/);assert.notEqual(key,await problemKey({...p,ordinal:2}));assert.ok(!key.includes('x+1'));});
test('algebraic equivalence for input readback',()=>{assert.ok(algebraEqual('(2x+1)(5x+4)','10x^2+13x+4'));assert.ok(!algebraEqual('x+1','x+2'));assert.ok(!algebraEqual('', '0'));});
test('full coordinated two-tab flow: pagination, two videos, four answers, two exercise completions',async()=>{
 const f=fixture({pages:2,questions:2});await f.runner.start(7,{continueBlocked:false});assert.equal((await f.runner.get()).state,'DISCOVERING');
 await f.tick();await f.tick();let s=await f.runner.get();assert.equal(s.jobs.video.length,2);assert.equal(s.jobs.exercise.length,2);assert.equal(f.tabs.size,2);assert.equal(s.lanes.video.tabId,7);assert.notEqual(s.lanes.exercise.tabId,7);
 for(let i=0;i<30;i++){f.endVideos();await f.tick();if(!(await f.runner.get()).running)break;}
 s=await f.runner.get();assert.equal(s.state,'DONE',JSON.stringify(s));assert.equal(s.counts.video,2);assert.equal(s.counts.exercise,2);assert.equal(s.counts.answers,4);assert.equal(f.checks,4);assert.equal(f.insertions,4);assert.equal(f.alarms.size,0);
});
test('input insertion is verified on a later observation before Check',async()=>{const f=fixture();await f.runner.start(7,{continueBlocked:false});await f.tick();assert.equal(f.insertions,1);assert.equal(f.checks,0);await f.tick();assert.equal(f.checks,1);});
test('unsupported math pauses only exercise lane, video continues',async()=>{const f=fixture({unsupported:true});await f.runner.start(7,{continueBlocked:false});await f.tick();await f.tick();let s=await f.runner.get();assert.equal(s.lanes.exercise.error,'UNSUPPORTED_MATH_FORMAT');assert.equal(f.checks,0);assert.equal(s.lanes.video.state,'PLAYING');assert.equal(s.running,true);});
test('incorrect site feedback does not resubmit or advance',async()=>{const f=fixture({wrong:true});await f.runner.start(7,{continueBlocked:false});for(let i=0;i<8;i++)await f.tick();const s=await f.runner.get();assert.equal(s.lanes.exercise.error,'SITE_REJECTED_ANSWER');assert.equal(f.checks,1);assert.equal(s.counts.exercise,0);});
test('ambiguous submission is not retried after worker restart',async()=>{const f=fixture({unknownSubmit:true});await f.runner.start(7,{continueBlocked:false});for(let i=0;i<4;i++)await f.tick();assert.equal(f.checks,1);const restarted=new DualRunner(f.api,()=>200000);await restarted.tick();const s=await restarted.get();assert.equal(s.lanes.exercise.error,'SUBMISSION_RESULT_NOT_OBSERVED');assert.equal(f.checks,1);});
test('STOP all cancels future actions and pauses runner media',async()=>{const f=fixture();await f.runner.start(7,{continueBlocked:false});await f.tick();await f.tick();const before=f.checks;await f.runner.stop();await f.tick();assert.equal(f.checks,before);assert.ok(f.stops>0);assert.equal((await f.runner.get()).state,'STOPPED');assert.equal(f.alarms.size,0);});
test('closed exercise tab pauses with explicit code',async()=>{const f=fixture();await f.runner.start(7,{continueBlocked:false});await f.tick();const s=await f.runner.get();f.tabs.delete(s.lanes.exercise.tabId);await f.tick();assert.equal((await f.runner.get()).lanes.exercise.error,'WORKER_TAB_CLOSED');});
test('user navigation outside class blocks work in that lane',async()=>{const f=fixture();await f.runner.start(7,{continueBlocked:false});await f.tick();const s=await f.runner.get();f.tabs.get(s.lanes.exercise.tabId).url='https://example.com';await f.tick();assert.equal((await f.runner.get()).lanes.exercise.error,'WORKER_LEFT_CLASS_SCOPE');assert.equal(f.checks,0);});
test('scope-preserving unexpected assignment is not operated on',async()=>{const f=fixture();await f.runner.start(7,{continueBlocked:false});await f.tick();const s=await f.runner.get();f.tabs.get(s.lanes.exercise.tabId).url=ROOT+'/assignment/other';f.advance(31000);await f.tick();assert.equal((await f.runner.get()).lanes.exercise.error,'UNEXPECTED_PAGE_OR_NAVIGATION_TIMEOUT');assert.equal(f.checks,0);});
test('existing answer is never overwritten on automatic start',async()=>{const f=fixture();await f.runner.start(7,{continueBlocked:false});const s=await f.runner.get();f.models.set(s.jobs.exercise[0],{q:1,value:'my work',accepted:false,done:false});await f.tick();assert.equal((await f.runner.get()).lanes.exercise.error,'ANSWER_FIELD_NOT_EMPTY');assert.equal(f.checks,0);});
test('Khan media iframe registered before playback, without all-frame injection',async()=>{const f=fixture({iframe:true});await f.runner.start(7,{continueBlocked:false});await f.tick();await f.runner.frame({tab:{id:7,url:ROOT+'/assignment/video0'},frameId:2});await f.tick();const s=await f.runner.get();assert.equal(s.lanes.video.state,'PLAYING');assert.ok(f.calls.some(c=>c.name==='mediaStep'&&c.target.frameIds[0]===2));assert.ok(f.calls.every(c=>!c.target.allFrames));});
test('resume cannot forget an uncertain submission',async()=>{const f=fixture({unknownSubmit:true});await f.runner.start(7,{continueBlocked:false});for(let i=0;i<9;i++)await f.tick();assert.equal(f.checks,1);await f.runner.resume();await f.tick();assert.equal(f.checks,1);});
test('one active run prevents duplicate worker tabs',async()=>{const f=fixture();await f.runner.start(7,{continueBlocked:false});await assert.rejects(f.runner.start(7,{continueBlocked:false}),/RUN_ALREADY_ACTIVE/);await f.tick();assert.equal(f.tabs.size,2);});
test('article-only list pages are passed without losing later video/exercise jobs',async()=>{const f=fixture({pages:2,articleFirst:true});await f.runner.start(7,{continueBlocked:false});await f.tick();await f.tick();const s=await f.runner.get();assert.equal(s.state,'RUNNING');assert.equal(s.jobs.video.length,1);assert.equal(s.jobs.exercise.length,1);});
test('starting on a later page first returns to page one',async()=>{const f=fixture({pages:3,initialPage:3});await f.runner.start(7,{continueBlocked:false});for(let i=0;i<5;i++)await f.tick();const s=await f.runner.get();assert.equal(s.jobs.video.length,3);assert.equal(s.jobs.exercise.length,3);assert.ok(f.calls.some(c=>c.name==='paginationUI'&&c.args[0]==='previous'));});
test('Start performs a real queue read before any content timer or alarm',async()=>{const f=fixture();const result=await f.runner.start(7,{continueBlocked:false});assert.ok(result.ok);assert.equal(result.run.state,'RUNNING');assert.equal(result.run.queued.video,1);assert.equal(f.tabs.size,2);assert.ok(f.calls.some(c=>c.name==='pageSnapshot'));});
test('heartbeat creation failure is a persisted startup error',async()=>{const f=fixture();f.api.alarms.create=async()=>{throw Error('alarm unavailable');};const r=await f.runner.start(7,{continueBlocked:false});assert.equal(r.ok,false);assert.equal(r.error,'STARTUP_ALARM_FAILED');const s=await f.runner.get();assert.equal(s.running,false);assert.equal(s.state,'ERROR');assert.equal(s.startupStage,'HEARTBEAT');});
test('content attachment failure cannot masquerade as connected ready',async()=>{const f=fixture();const original=f.api.scripting.executeScript;f.api.scripting.executeScript=async args=>{if(args.files)throw Error('Cannot access contents of url');return original(args);};const r=await f.runner.start(7,{continueBlocked:false});assert.equal(r.ok,false);assert.equal(r.error,'SITE_ACCESS_DENIED');assert.equal((await f.runner.get()).state,'ERROR');assert.equal(f.alarms.size,0);});

test('an expression change before accepted feedback is not credited or resubmitted',async()=>{
 const f=fixture({unknownSubmit:true});
 const original=f.api.scripting.executeScript;
 f.api.scripting.executeScript=async args=>{
  const r=await original(args);
  if(args.func===pageSnapshot&&f.checks&&f.tabs.get(args.target.tabId)?.url.includes('/assignment/exercise')){
   r[0].result.expression='x^2-1';r[0].result.token=r[0].result.url+'|x^2-1';
  }
  return r;
 };
 await f.runner.start(7,{continueBlocked:false});for(let i=0;i<6;i++)await f.tick();
 const s=await f.runner.get();assert.equal(s.lanes.exercise.error,'PROBLEM_CHANGED_BEFORE_FEEDBACK');
 assert.equal(s.counts.answers,0);assert.equal(f.checks,1);
});

test('Stop during asynchronous startup cannot be cleared by late tab lookup',async()=>{const f=fixture();const get=f.api.tabs.get;f.api.tabs.get=async id=>{f.runner.cancel();return get(id);};const r=await f.runner.start(7,{continueBlocked:false});assert.equal(r.error,'START_CANCELLED_BY_STOP');assert.equal(f.tabs.size,1);assert.equal((await f.runner.get()).running,false);});

test('missing Next waits then fails without dropping a page or starting partial jobs',async()=>{
 const f=fixture({pages:2}),original=f.api.scripting.executeScript;
 f.api.scripting.executeScript=async args=>{const r=await original(args);if(args.func===paginationUI&&args.args[0]==='inspect')r[0].result.next={state:'missing',found:0,enabled:0};return r;};
 const started=await f.runner.start(7,{continueBlocked:false});assert.ok(started.ok);assert.equal(started.run.state,'DISCOVERING');assert.equal(started.run.startup.probe.waitingFor,'next');
 assert.equal((await f.runner.get()).scan.pages,0);assert.equal(f.tabs.size,1);
 f.advance(21000);await f.tick();const s=await f.runner.get();assert.equal(s.state,'ERROR');assert.equal(s.errors.at(-1).code,'LIST_NEXT_UNAVAILABLE');assert.equal(f.tabs.size,1);
 assert.ok(!f.calls.some(c=>c.name==='paginationUI'&&c.args[0]==='next'));
});
test('a briefly empty later list page gets its own loading deadline',async()=>{
 const f=fixture({pages:3}),original=f.api.scripting.executeScript;let loading=false;
 f.api.scripting.executeScript=async args=>{const r=await original(args);if(loading&&args.func===pageSnapshot){r[0].result.items=[];r[0].result.assignmentCount=0;}return r;};
 await f.runner.start(7,{continueBlocked:false});await f.tick();loading=true;f.advance(30000);await f.tick();assert.equal((await f.runner.get()).state,'DISCOVERING');
 loading=false;await f.tick();const s=await f.runner.get();assert.equal(s.state,'RUNNING');assert.equal(s.jobs.video.length,3);
});
test('ambiguous pagination is never chosen arbitrarily',async()=>{
 const f=fixture({pages:2}),original=f.api.scripting.executeScript;
 f.api.scripting.executeScript=async args=>{const r=await original(args);if(args.func===paginationUI&&args.args[0]==='inspect')r[0].result.next={state:'ambiguous',found:2,enabled:2};return r;};
 const r=await f.runner.start(7,{continueBlocked:false});assert.equal(r.error,'LIST_PAGINATION_AMBIGUOUS');assert.equal(f.tabs.size,1);
});

test('a removed frame after a real navigation keeps intent and observes the next page',async()=>{
 const f=fixture({pages:2}),original=f.api.scripting.executeScript;
 f.api.scripting.executeScript=async args=>{const r=await original(args);if(args.func===paginationUI&&args.args[0]==='next')throw Error('Frame with ID 0 was removed.');return r;};
 const r=await f.runner.start(7,{continueBlocked:false});assert.ok(r.ok);assert.equal((await f.runner.get()).scan.lastNavigationError,'LIST_FRAME_REMOVED');
 await f.tick();const s=await f.runner.get();assert.equal(s.state,'RUNNING');assert.equal(s.jobs.video.length,2);assert.equal(f.calls.filter(c=>c.name==='paginationUI'&&c.args[0]==='next').length,1);
});
test('an unknown pagination reply is not blindly clicked again if the page never changes',async()=>{
 const f=fixture({pages:2}),original=f.api.scripting.executeScript;let attempts=0;
 f.api.scripting.executeScript=async args=>{if(args.func===paginationUI&&args.args[0]==='next'){attempts++;throw Error('Frame with ID 0 was removed.');}return original(args);};
 await f.runner.start(7,{continueBlocked:false});f.advance(21000);await f.tick();const s=await f.runner.get();assert.equal(s.state,'ERROR');assert.equal(s.errors.at(-1).code,'LIST_PAGINATION_DID_NOT_CHANGE');assert.equal(attempts,1);
});

test('temporarily missing question math waits before entry and resumes when ready',async()=>{
 const f=fixture(),original=f.api.scripting.executeScript;let missing=true;
 f.api.scripting.executeScript=async args=>{const r=await original(args);if(missing&&args.func===pageSnapshot&&f.tabs.get(args.target.tabId)?.url.includes('/assignment/exercise')){r[0].result.expression='';r[0].result.probe={fields:1,mathAnnotations:0,expressions:0,answerLabels:0,operation:'unknown',checkControls:1,scope:'main',readState:'NO_QUESTION_MATH'};}return r;};
 await f.runner.start(7,{continueBlocked:false});await f.tick();assert.equal((await f.runner.get()).lanes.exercise.state,'WAITING_FOR_QUESTION');assert.equal(f.insertions,0);assert.equal(f.checks,0);
 missing=false;await f.tick();assert.equal((await f.runner.get()).lanes.exercise.state,'ANSWER_ENTERED');await f.tick();assert.equal(f.checks,1);
});
test('unreadable question pauses with a specific probe and no private content',async()=>{
 const f=fixture(),original=f.api.scripting.executeScript;
 f.api.scripting.executeScript=async args=>{const r=await original(args);if(args.func===pageSnapshot&&f.tabs.get(args.target.tabId)?.url.includes('/assignment/exercise')){r[0].result.expression='';r[0].result.probe={fields:1,mathAnnotations:0,expressions:0,answerLabels:0,operation:'unknown',checkControls:1,scope:'main',readState:'NO_QUESTION_MATH'};}return r;};
 await f.runner.start(7,{continueBlocked:false});for(let i=0;i<5;i++)await f.tick();const s=await f.runner.status();assert.equal(s.run.lanes.exercise.error,'NO_QUESTION_MATH');assert.equal(f.checks,0);assert.equal(f.insertions,0);
 assert.equal(s.run.lanes.exercise.probe.readState,'NO_QUESTION_MATH');assert.ok(!JSON.stringify(s).includes('10x'));assert.ok(!JSON.stringify(s).includes(ROOT));
});
test('missing Check is observed before entry instead of persisting an uncertain submission',async()=>{
 const f=fixture(),original=f.api.scripting.executeScript;let missing=true;
 f.api.scripting.executeScript=async args=>{const r=await original(args);if(missing&&args.func===pageSnapshot&&f.tabs.get(args.target.tabId)?.url.includes('/assignment/exercise'))r[0].result.controls=[];return r;};
 await f.runner.start(7,{continueBlocked:false});await f.tick();assert.equal(f.insertions,0);assert.equal(f.checks,0);missing=false;await f.tick();assert.equal(f.insertions,1);await f.tick();assert.equal(f.checks,1);
});

test('answer pacing draws every whole second from 10 through 30 inclusive',()=>{
 assert.deepEqual(Array.from({length:21},(_,i)=>answerDelaySeconds(()=>(i+0.5)/21)),Array.from({length:21},(_,i)=>10+i));
 assert.equal(answerDelaySeconds(()=>0),10);assert.equal(answerDelaySeconds(()=>1-Number.EPSILON),30);
 for(const bad of [-1,1,NaN,Infinity])assert.throws(()=>answerDelaySeconds(()=>bad),/INVALID_RANDOM_SOURCE/);
});
test('no entry or Check before the exact saved deadline; readback still precedes Check',async()=>{
 const f=fixture();await f.runner.start(7,{continueBlocked:false});await f.tick({waitForDelay:false});const lane=(await f.runner.get()).lanes.exercise;
 assert.equal(lane.state,'WAITING_BEFORE_ANSWER');assert.equal(lane.delay.seconds,10);assert.equal(f.insertions,0);assert.equal(f.checks,0);
 f.advance(9999);const wake=await f.runner.tick(lane.tabId);assert.equal(f.insertions,0);assert.equal(wake.nextPulseMs,50);
 f.advance(1);await f.runner.tick(lane.tabId);assert.equal(f.insertions,1);assert.equal(f.checks,0);assert.equal((await f.runner.get()).lanes.exercise.delay,undefined);
 await f.runner.tick(lane.tabId);assert.equal(f.checks,1);
});
test('restart preserves the original deadline without another random draw',async()=>{
 const f=fixture();let draws=0;f.runner.random=()=>{draws++;return 1-Number.EPSILON;};await f.runner.start(7,{continueBlocked:false});await f.tick({waitForDelay:false});
 const before=(await f.runner.get()).lanes.exercise;assert.equal(before.delay.seconds,30);
 const restarted=new DualRunner(f.api,f.now,()=>{throw Error('Must not draw again');});await restarted.tick(before.tabId);assert.deepEqual((await restarted.get()).lanes.exercise.delay,before.delay);assert.equal(draws,1);assert.equal(f.insertions,0);
 f.advance(30000);await restarted.tick(before.tabId);assert.equal(f.insertions,1);assert.equal(f.checks,0);
});
test('Stop during pacing prevents entry and Check even after the deadline',async()=>{
 const f=fixture();await f.runner.start(7,{continueBlocked:false});await f.tick({waitForDelay:false});await f.runner.stop();f.advance(31000);await f.runner.tick();assert.equal(f.insertions,0);assert.equal(f.checks,0);assert.equal((await f.runner.get()).state,'STOPPED');
});
test('a changed question during pacing pauses without submitting either problem',async()=>{
 const f=fixture(),original=f.api.scripting.executeScript;let changed=false;
 f.api.scripting.executeScript=async args=>{const r=await original(args);if(changed&&args.func===pageSnapshot&&f.tabs.get(args.target.tabId)?.url.includes('/assignment/exercise'))r[0].result.expression='x^2-1';return r;};
 await f.runner.start(7,{continueBlocked:false});await f.tick({waitForDelay:false});changed=true;f.advance(11000);await f.runner.tick();assert.equal((await f.runner.get()).lanes.exercise.error,'PROBLEM_CHANGED_DURING_WAIT');assert.equal(f.insertions,0);assert.equal(f.checks,0);
});
test('each following question draws a fresh pause',async()=>{
 const f=fixture();let draws=0;f.runner.random=()=>{draws++;return 0;};await f.runner.start(7,{continueBlocked:false});
 for(let i=0;i<8&&draws<2;i++)await f.tick();
 assert.equal(draws,2);assert.equal(f.checks,1);assert.equal((await f.runner.get()).counts.answers,1);
});

test('a results summary cannot complete an assignment without accepted final-question intent',async()=>{
 const f=fixture(),original=f.api.scripting.executeScript;
 f.api.scripting.executeScript=async args=>{const r=await original(args);if(args.func===pageSnapshot&&f.tabs.get(args.target.tabId)?.url.includes('/assignment/exercise'))Object.assign(r[0].result,{resultSummary:true,expression:'',fieldCount:0,done:false,controls:['Return to assignments']});return r;};
 await f.runner.start(7,{continueBlocked:false});await f.tick();const s=await f.runner.get();assert.equal(s.counts.exercise,0);assert.equal(s.counts.answers,0);assert.equal(s.lanes.exercise.index,0);assert.equal(f.checks,0);
});
test('accepted final Next followed by a results summary completes exactly one assignment',async()=>{
 const f=fixture({questions:1}),original=f.api.scripting.executeScript;let results=false;
 f.api.scripting.executeScript=async args=>{const r=await original(args);if(args.func===pageAction&&args.args[0]==='NEXT_QUESTION')results=true;if(args.func===pageSnapshot&&f.tabs.get(args.target.tabId)?.url.includes('/assignment/exercise')){if(results)Object.assign(r[0].result,{resultSummary:true,expression:'',fieldCount:0,done:false,controls:['Return to assignments']});else if(r[0].result.accepted)r[0].result.controls=['Next'];}return r;};
 await f.runner.start(7,{continueBlocked:false});for(let i=0;i<7;i++)await f.tick();const s=await f.runner.get();assert.equal(s.counts.exercise,1);assert.equal(s.counts.answers,1);assert.equal(f.checks,1);assert.equal(s.lanes.exercise.state,'DONE');
});
test('an exercise adapter failure pauses only that lane while video playback continues',async()=>{
 const f=fixture(),original=f.api.scripting.executeScript;
 f.api.scripting.executeScript=async args=>{if(args.func===pageSnapshot&&f.tabs.get(args.target.tabId)?.url.includes('/assignment/exercise'))throw Error('Frame was removed');return original(args);};
 await f.runner.start(7,{continueBlocked:false});await f.tick();const s=await f.runner.get();assert.equal(s.running,true);assert.equal(s.lanes.exercise.error,'LANE_BROWSER_ADAPTER_ERROR');assert.equal(s.lanes.video.state,'PLAYING');assert.equal(f.checks,0);
});
test('explicit unsupported factor domain pauses without entering or checking while video lane continues',async()=>{
 const f=fixture(),original=f.api.scripting.executeScript;
 f.api.scripting.executeScript=async args=>{const r=await original(args);if(args.func===pageSnapshot&&r[0]?.result?.expression)r[0].result.unsupportedFactorDomain=true;return r;};
 await f.runner.start(7,{continueBlocked:false});for(let i=0;i<5;i++)await f.tick();const s=await f.runner.get();assert.equal(s.lanes.exercise.state,'PAUSED');assert.equal(s.lanes.exercise.error,'UNSUPPORTED_MATH_FORMAT');assert.equal(f.insertions,0);assert.equal(f.checks,0);assert.ok(f.plays>0);
});
