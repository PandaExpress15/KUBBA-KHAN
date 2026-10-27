import {isKhan,inScope,safeRate} from './policy.js';
import {solve} from './math.js';
import {solveSupported,equivalent} from './advanced-math.js';
import {insertReviewed} from './input.js';
import {mathQuillDOM} from './mq-dom.js';
import {pageSnapshot,pageAction,mediaStep,stopMedia,readEditor} from './automation-page.js';
import {paginationUI} from './pagination.js';
const STORE='dual-run',ALARM='klr-dual-heartbeat';
const idle=()=>({version:'2.1.9',running:false,state:'IDLE',revision:0,lanes:{},counts:{video:0,exercise:0,answers:0},errors:[]});
const cleanURL=u=>u.split(/[?#]/)[0];
export function classScope(url){if(!isKhan(url))throw Error('OPEN_CLASSROOM_ASSIGNMENT_LIST');const u=new URL(url),m=u.pathname.match(/^\/learner\/class\/[^/]+/);if(!m)throw Error('OPEN_CLASSROOM_ASSIGNMENT_LIST');return u.origin+m[0];}
export function collectJobs(items,scope){const seen=new Set(),out={video:[],exercise:[]};for(const x of items||[]){if(!['video','exercise'].includes(x.kind)||!inScope(x.url,scope)||!new URL(x.url).pathname.includes('/assignment/')||seen.has(cleanURL(x.url)))continue;seen.add(cleanURL(x.url));out[x.kind].push(cleanURL(x.url));}return out;}
export async function problemKey(p){const s=[cleanURL(p.url),p.ordinal??'?',p.operation||'?',p.expression].join('|');const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function answerDelaySeconds(random=Math.random){const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw Error('INVALID_RANDOM_SOURCE');return 10+Math.floor(value*21);}
export function algebraEqual(a,b){return equivalent(a,b);}
export class DualRunner{
 constructor(api,now=()=>Date.now(),random=Math.random){this.api=api;this.now=now;this.random=random;this.cancelled=false;this.cancelRevision=0;}
 cancel(){this.cancelled=true;this.cancelRevision++;}
 async get(){return (await this.api.storage.session.get(STORE))[STORE]||idle();}
 async save(s){await this.api.storage.session.set({[STORE]:s});}
 async invoke(tabId,func,args=[],world='ISOLATED',frameId=0){const r=await this.api.scripting.executeScript({target:{tabId,frameIds:[frameId]},world,func,args});return r[0]?.result;}
 async media(s,lane,func,args=[]){const out=[];for(const id of lane.frameIds||[0]){if(this.cancelled&&func!==stopMedia)break;try{out.push(await this.invoke(lane.tabId,func,args,'ISOLATED',id));}catch{/* Detached or inaccessible iframe. Remaining permitted frames are still inspected. */}}return out;}
 async signal(s){for(const id of new Set([s.sourceTab,...Object.values(s.lanes||{}).map(l=>l.tabId)].filter(Number.isInteger)))await this.api.tabs.sendMessage(id,{type:'AUTO_CONFIG',running:s.running,revision:s.revision}).catch(()=>{});}
 async stop(){this.cancel();const s=await this.get();s.running=false;s.state='STOPPED';s.revision++;await this.save(s);await this.api.alarms.clear(ALARM);await this.signal(s);for(const lane of Object.values(s.lanes))await this.media(s,lane,stopMedia);return {ok:true,run:this.public(s)};}
 public(s){return {version:s.version,running:s.running,state:s.state,counts:s.counts,startup:{stage:s.startupStage||'',pages:s.scan?.pages||0,probe:s.scan?.probe||null,navigationInterruptions:s.scan?.navigationInterruptions||0,lastNavigationError:s.scan?.lastNavigationError||''},queued:{video:s.jobs?.video.length||0,exercise:s.jobs?.exercise.length||0},lanes:Object.fromEntries(Object.entries(s.lanes).map(([k,l])=>[k,{tabId:l.tabId,state:l.state,error:l.error||'',index:l.index,total:s.jobs?.[k].length||0,rate:l.rate||0,completed:l.index,remaining:Math.max(0,(s.jobs?.[k].length||0)-l.index),probe:l.probe||null,wait:l.state==='WAITING_BEFORE_ANSWER'&&l.delay?{seconds:l.delay.seconds,remainingSeconds:Math.max(0,Math.ceil((l.delay.until-this.now())/1000))}:null}])),errors:s.errors.slice(-5)};}
 async status(){return {ok:true,run:this.public(await this.get())};}
 async start(tabId,options={}){
  const cancelRevision=this.cancelRevision;
  const existing=await this.get();if(existing.running)throw Error('RUN_ALREADY_ACTIVE_STOP_FIRST');
  const tab=await this.api.tabs.get(tabId),scope=classScope(tab.url);
  if(cancelRevision!==this.cancelRevision)return {ok:false,error:'START_CANCELLED_BY_STOP',run:this.public(existing)};
  this.cancelled=false;
  const s={...idle(),running:true,state:'DISCOVERING',revision:existing.revision+1,sourceTab:tabId,scope,started:this.now(),rate:safeRate(options.rate),muted:options.muted!==false,jobs:{video:[],exercise:[]},scan:{pages:0,seen:[],pending:null,since:this.now()}};
  await this.save(s);
  const cancelled=()=>({ok:false,error:'START_CANCELLED_BY_STOP',run:this.public(s)});
  try{
   if(this.cancelled)return cancelled();
   s.startupStage='HEARTBEAT';await this.save(s);await this.api.alarms.create(ALARM,{periodInMinutes:.5});
   if(this.cancelled)return cancelled();
   s.startupStage='ATTACH';await this.save(s);await this.api.scripting.executeScript({target:{tabId,frameIds:[0]},files:['runner-content.js']});
   if(this.cancelled)return cancelled();
   if(cleanURL(tab.url)!==scope)await this.api.tabs.update(tabId,{url:scope});
   s.startupStage='READ_QUEUE';await this.save(s);await this.signal(s);
   // Start has a real first action, even if content timers have not connected yet.
   await this.tick(tabId);const current=await this.get();return {ok:current.state!=='ERROR',run:this.public(current),error:current.state==='ERROR'?current.errors.at(-1)?.code:undefined};
  }catch(e){
   s.running=false;s.state='ERROR';const code=/cannot access|permission|host access/i.test(e.message)?'SITE_ACCESS_DENIED':s.startupStage==='HEARTBEAT'?'STARTUP_ALARM_FAILED':s.startupStage==='ATTACH'?'STARTUP_INJECTION_FAILED':'STARTUP_FAILED';s.errors.push({lane:'controller',code,at:this.now()});await this.save(s);await this.api.alarms.clear(ALARM).catch(()=>{});await this.signal(s);return {ok:false,error:code,run:this.public(s)};
  }
 }
 async pause(s,lane,code){lane.state='PAUSED';lane.error=code;s.errors.push({lane:lane.kind,code,at:this.now()});await this.save(s);}
 async finishIfDone(s){if(Object.values(s.lanes).every(l=>l.state==='DONE')){s.running=false;s.state='DONE';await this.save(s);await this.api.alarms.clear(ALARM);await this.signal(s);}}
 async advance(s,lane){
  if(this.cancelled||!s.running)return;
  s.counts[lane.kind]++;lane.index++;lane.problem=null;lane.started=this.now();lane.error='';lane.frameIds=[0];delete lane.introClicked;delete lane.playFailures;delete lane.probe;delete lane.questionWait;delete lane.delay;
  if(lane.index>=s.jobs[lane.kind].length){lane.state='DONE';await this.save(s);await this.finishIfDone(s);return;}
  lane.state='NAVIGATING';await this.save(s);if(!this.cancelled)await this.api.tabs.update(lane.tabId,{url:s.jobs[lane.kind][lane.index]});
 }
 async discover(s){
  const tab=await this.api.tabs.get(s.sourceTab);if(cleanURL(tab.url)!==s.scope){if(this.now()-s.scan.since>30000)throw Error('CLASS_LIST_NAVIGATION_TIMEOUT');return;}
  const p=await this.listInvoke(s,pageSnapshot);if(p?.navigationPending)return;if(!p)throw Error('CLASS_LIST_UNREADABLE');
  const navigation=await this.listInvoke(s,paginationUI,['inspect',{url:p.url,page:p.page}]);
  if(navigation?.navigationPending)return;
  if(navigation?.error==='STALE_LIST_PAGE')return;
  if(!navigation?.ok)throw Error(navigation?.error||'LIST_PAGINATION_UNREADABLE');
  const page=navigation.page??p.page,pages=navigation.pages??p.pages;
  s.scan.probe={supportedRows:p.items?.length||0,assignmentLinks:p.assignmentCount||0,page:page||null,pages:pages||null,todo:p.isTodo??null,next:navigation.next.state==='ready',navigation:{next:navigation.next,previous:navigation.previous,conflictingLabels:navigation.conflictingLabels}};await this.save(s);
  if(p.isTodo===false){if(s.scan.filterTried)throw Error('SELECT_TO_DO_FILTER_ON_CLASS_LIST');s.scan.filterTried=true;await this.save(s);if(!this.cancelled)await this.invoke(s.sourceTab,pageAction,['FILTER_TODO',{url:p.url}]);return;}
  if(!p.items.length&&!p.assignmentCount){s.scan.loadingSince??=this.now();await this.save(s);if(this.now()-s.scan.loadingSince>20000)throw Error('NO_SUPPORTED_ASSIGNMENT_ROWS');return;}
  delete s.scan.loadingSince;
  if(s.scan.backPending){if(page===s.scan.backPending){if(this.now()-s.scan.backSince>20000)throw Error('LIST_PREVIOUS_DID_NOT_CHANGE');return;}delete s.scan.backPending;}
  if(!s.scan.pages&&page>1){if(!await this.listReady(s,navigation,'previous'))return;s.scan.backAttempts=(s.scan.backAttempts||0)+1;if(s.scan.backAttempts>10)throw Error('PAGE_RESET_LIMIT');s.scan.backPending=page;s.scan.backSince=this.now();await this.save(s);if(!this.cancelled){const r=await this.listInvoke(s,paginationUI,['previous',{url:p.url,page}]);if(r?.navigationPending)return;if(!r?.ok){s.scan.probe.lastActionCode=r?.error||'NO_REPLY';throw Error('LIST_PREVIOUS_UNAVAILABLE');}}return;}
  const signature=(page||'?')+'|'+p.items.map(x=>x.url).join('|');
  if(s.scan.pending){if(signature===s.scan.pending){if(this.now()-s.scan.pendingAt>20000)throw Error('LIST_PAGINATION_DID_NOT_CHANGE');return;}s.scan.pending=null;}
  const hasNext=pages?page<pages:navigation.next.enabled>0;
  if(hasNext&&!await this.listReady(s,navigation,'next'))return;
  if(s.scan.seen.includes(signature))throw Error('DUPLICATE_LIST_PAGE');s.scan.seen.push(signature);s.scan.pages++;
  const merged=collectJobs([...s.jobs.video.map(url=>({url,kind:'video'})),...s.jobs.exercise.map(url=>({url,kind:'exercise'})),...p.items],s.scope);s.jobs=merged;
  if(s.jobs.video.length+s.jobs.exercise.length>100)throw Error('QUEUE_LIMIT_100_ITEMS');
  if(hasNext){if(s.scan.pages>=10)throw Error('PAGE_LIMIT_10');s.scan.pending=signature;s.scan.pendingAt=this.now();await this.save(s);if(!this.cancelled){const r=await this.listInvoke(s,paginationUI,['next',{url:p.url,page}]);if(r?.navigationPending)return;if(!r?.ok){s.scan.probe.lastActionCode=r?.error||'NO_REPLY';throw Error('LIST_NEXT_UNAVAILABLE');}}return;}
  if(!s.jobs.video.length&&!s.jobs.exercise.length)throw Error('NO_SUPPORTED_ASSIGNMENTS_IN_CLASS_SCOPE');
  if(this.cancelled)return;s.state='RUNNING';
  // The list tab becomes the video lane. Only one additional exercise tab is opened.
  for(const kind of ['video','exercise']){
   if(!s.jobs[kind].length)continue;
   const tabId=kind==='video'?s.sourceTab:(await this.api.tabs.create({url:'about:blank',active:false})).id;
   s.lanes[kind]={kind,tabId,index:0,state:'NAVIGATING',started:this.now(),problem:null,frameIds:[0]};
  }
  await this.save(s);if(this.cancelled)return;
  for(const l of Object.values(s.lanes))await this.api.tabs.update(l.tabId,{url:s.jobs[l.kind][0]});await this.signal(s);
 }
 async listInvoke(s,func,args=[]){
  try{const result=await this.invoke(s.sourceTab,func,args);delete s.scan.navigationWaitSince;return result;}
  catch(e){
   const message=String(e.message||'');
   const code=/frame.*(?:removed|unloaded)/i.test(message)?'LIST_FRAME_REMOVED':/document.*(?:unloaded|removed)/i.test(message)?'LIST_DOCUMENT_UNLOADED':/(?:execution|script) context.*(?:destroyed|invalidated)|cannot find context with specified id/i.test(message)?'LIST_CONTEXT_DESTROYED':'';
   if(!code)throw e;
   // A normal document navigation can destroy the injected function before
   // Chrome delivers its reply. Keep the saved navigation intent; observe the
   // next document instead of repeating an uncertain Next/Previous click.
   s.scan.navigationWaitSince??=this.now();s.scan.navigationInterruptions=(s.scan.navigationInterruptions||0)+1;s.scan.lastNavigationError=code;
   await this.save(s);if(this.now()-s.scan.navigationWaitSince>30000)throw Error('LIST_NAVIGATION_TIMEOUT');
   return {navigationPending:true};
  }
 }
 async listReady(s,navigation,direction){
  const control=navigation[direction],code=direction==='next'?'LIST_NEXT_UNAVAILABLE':'LIST_PREVIOUS_UNAVAILABLE';
  if(control.state==='ready'){delete s.scan.controlWait;return true;}
  if(['ambiguous','unsafe'].includes(control.state))throw Error(control.state==='ambiguous'?'LIST_PAGINATION_AMBIGUOUS':'LIST_PAGINATION_TARGET_UNSAFE');
  const pending=s.scan.controlWait;
  if(!pending||pending.direction!==direction||pending.page!==navigation.page)s.scan.controlWait={direction,page:navigation.page,since:this.now()};
  s.scan.probe.waitingFor=direction;await this.save(s);
  if(this.now()-s.scan.controlWait.since>20000)throw Error(code);
  return false;
 }
 async video(s,lane){
  const frames=await this.media(s,lane,mediaStep,[s.rate,s.muted]);if(this.cancelled)return;
  const videos=frames.flatMap(f=>f?.videos||[]);if(videos.length!==1){if(this.now()-lane.started>20000)await this.pause(s,lane,videos.length?'MULTIPLE_MEDIA_ELEMENTS':'NO_ACCESSIBLE_VIDEO');return;}
  const v=videos[0];lane.rate=v.rate;
  if(v.error){lane.playFailures=(lane.playFailures||0)+1;if(lane.playFailures>=3)await this.pause(s,lane,v.error);else await this.save(s);return;}
  if(v.ended){if(!lane.endedAt){lane.endedAt=this.now();lane.state='MEDIA_ENDED';await this.save(s);return;}if(this.now()-lane.endedAt>=2000){delete lane.endedAt;delete lane.lastTime;delete lane.lastProgress;await this.advance(s,lane);}return;}
  if(v.time!==lane.lastTime){lane.lastTime=v.time;lane.lastProgress=this.now();}
  if(this.now()-(lane.lastProgress||lane.started)>120000){await this.pause(s,lane,'MEDIA_STALLED');return;}
  lane.state='PLAYING';await this.save(s);
 }
 async click(s,lane,p,action){if(this.cancelled)return false;const r=await this.invoke(lane.tabId,pageAction,[action,{url:p.url,token:p.token,accepted:p.accepted===true}]);if(!r?.ok){await this.pause(s,lane,r?.error||'ACTION_NOT_OBSERVED');return false;}return true;}
 async waitForQuestion(s,lane,code){
  lane.questionWait??=this.now();lane.state='WAITING_FOR_QUESTION';
  if(this.now()-lane.questionWait>=12000)await this.pause(s,lane,code);else await this.save(s);
 }
 async exercise(s,lane){
  const p=await this.invoke(lane.tabId,pageSnapshot);if(this.cancelled||!p)return;
  lane.probe=p.probe?{...p.probe,phase:lane.problem?.phase||'READING'}:null;
  if(p.resultSummary&&lane.problem?.acceptedFinal&&['NEXT_CLICKED','FINISH_CLICKED'].includes(lane.problem.phase)){s.counts.answers++;lane.state='ASSIGNMENT_RESULTS_OBSERVED';await this.advance(s,lane);return;}
  if(p.done){if(lane.problem&&['CHECKING','WAITING_FEEDBACK','NEXT_CLICKED','FINISH_CLICKED'].includes(lane.problem.phase))s.counts.answers++;lane.state='ASSIGNMENT_COMPLETE_OBSERVED';await this.advance(s,lane);return;}
  if(lane.problem?.phase==='FINISH_CLICKED'){if(this.now()-lane.problem.at>20000)await this.pause(s,lane,'FINISH_RESULT_NOT_OBSERVED');return;}
  if(lane.problem&&['CHECKING','WAITING_FEEDBACK','NEXT_CLICKED'].includes(lane.problem.phase)){
   if(p.negative){await this.pause(s,lane,'SITE_REJECTED_ANSWER');return;}
   const key=await problemKey(p);
   if(p.expression&&key!==lane.problem.key){
    if(lane.problem.phase!=='NEXT_CLICKED'){await this.pause(s,lane,'PROBLEM_CHANGED_BEFORE_FEEDBACK');return;}
    s.counts.answers++;lane.problem=null;lane.state='READING_NEXT';await this.save(s);return;
   }
   if(p.accepted||lane.problem.phase==='NEXT_CLICKED'){
    if(lane.problem.phase==='NEXT_CLICKED'){if(this.now()-lane.problem.at>20000)await this.pause(s,lane,'NEXT_QUESTION_DID_NOT_CHANGE');return;}
    const finish=p.controls.some(x=>/^(done|finish|finish exercise|finish assignment)$/i.test(x));
    lane.problem.acceptedFinal=Number.isInteger(p.ordinal)&&Number.isInteger(p.total)&&p.total>0&&p.ordinal===p.total;
    lane.problem.phase=finish?'FINISH_CLICKED':'NEXT_CLICKED';lane.problem.at=this.now();lane.state='ADVANCING_QUESTION';await this.save(s);if(this.cancelled)return;
    await this.click(s,lane,p,finish?'FINISH':'NEXT_QUESTION');return;
   }
   lane.problem.phase='WAITING_FEEDBACK';lane.state='WAITING_FEEDBACK';await this.save(s);if(this.now()-lane.problem.at>20000)await this.pause(s,lane,'SUBMISSION_RESULT_NOT_OBSERVED');return;
  }
  if(!p.fieldCount){if(p.controls.some(x=>/^(start|start exercise|begin practice|let's go)$/i.test(x))&&!lane.introClicked){lane.introClicked=true;await this.save(s);await this.click(s,lane,p,'START_EXERCISE');return;}if(this.now()-lane.started>20000)await this.pause(s,lane,p.radioCount?'MULTIPLE_CHOICE_UNSUPPORTED':'NO_SUPPORTED_ANSWER_FIELD');return;}
  if(p.fieldCount!==1){await this.pause(s,lane,'MULTIPLE_ANSWER_FIELDS');return;}
  if(!p.expression||!p.operation){await this.waitForQuestion(s,lane,p.probe?.readState||'PROBLEM_NOT_UNAMBIGUOUS');return;}
  const answer=solveSupported(p.expression,p.operation);if(lane.probe)lane.probe.solver=answer.status==='solved'?'solved':'unsupported';if(answer.status!=='solved'){await this.pause(s,lane,'UNSUPPORTED_MATH_FORMAT');return;}
  const key=await problemKey(p);
  const checks=p.controls.filter(x=>/^(check|check answer|check answers|submit answer)$/i.test(x)).length;
  if(checks!==1){await this.waitForQuestion(s,lane,'CHECK_CONTROL_MISSING_OR_AMBIGUOUS');return;}
  delete lane.questionWait;
  if(!lane.problem){
   if(lane.delay&&lane.delay.key!==key){await this.pause(s,lane,'PROBLEM_CHANGED_DURING_WAIT');return;}
   if(!lane.delay){const seconds=answerDelaySeconds(this.random);lane.delay={key,seconds,until:this.now()+seconds*1000};}
   if(this.now()<lane.delay.until){lane.state='WAITING_BEFORE_ANSWER';await this.save(s);return;}
   delete lane.delay;
   lane.problem={key,phase:'ENTERING',at:this.now()};lane.state='ENTERING_ANSWER';await this.save(s);if(this.cancelled)return;
   let entry=await this.invoke(lane.tabId,insertReviewed,[{answer:answer.answer,latex:answer.latex},p.token],'MAIN');
   if(entry?.error==='MATHQUILL_PUBLIC_API_UNAVAILABLE_COPY_MANUALLY'&&!this.cancelled)entry=await this.invoke(lane.tabId,mathQuillDOM,['insert',{token:p.token},answer],'MAIN');
   if(!entry?.ok){await this.pause(s,lane,entry?.error||'INPUT_NOT_OBSERVED');return;}
   if(entry.kind==='mathquill'&&!algebraEqual(entry.observed,answer.answer)){await this.pause(s,lane,'INPUT_READBACK_MISMATCH');return;}
   lane.problem.phase='READY_TO_CHECK';lane.problem.at=this.now();lane.state='ANSWER_ENTERED';await this.save(s);return;
  }
  if(lane.problem.key!==key){await this.pause(s,lane,'PROBLEM_CHANGED_DURING_ENTRY');return;}
  let value=p.fieldValue;if(p.mathquill){let r=await this.invoke(lane.tabId,readEditor,[],'MAIN');if(!r?.ok)r=await this.invoke(lane.tabId,mathQuillDOM,['read',{token:p.token}],'MAIN');if(!r?.ok){await this.pause(s,lane,r?.error||'EDITOR_READBACK_UNAVAILABLE');return;}value=r.latex;}
  if(!algebraEqual(value||'',answer.answer)){await this.pause(s,lane,'ANSWER_DID_NOT_PERSIST');return;}
  // Durable intent BEFORE click: refresh/restart never blindly repeats a submission.
  lane.problem.phase='CHECKING';lane.problem.at=this.now();lane.state='SUBMITTING';await this.save(s);if(!this.cancelled)await this.click(s,lane,p,'CHECK');
 }
 async tick(tabId){
  const s=await this.get();if(!s.running||this.cancelled)return {ok:true,running:false};
  try{
   if(this.now()-s.started>4*60*60*1000)throw Error('RUN_TIME_LIMIT_4_HOURS');
   if(s.state==='DISCOVERING'){if(tabId==null||tabId===s.sourceTab)await this.discover(s);return {ok:true,running:s.running};}
   for(const lane of Object.values(s.lanes)){
    if(tabId!=null&&lane.tabId!==tabId||['DONE','PAUSED'].includes(lane.state))continue;
    let tab;try{tab=await this.api.tabs.get(lane.tabId);}catch{await this.pause(s,lane,'WORKER_TAB_CLOSED');continue;}
    if(!inScope(tab.url,s.scope)){await this.pause(s,lane,'WORKER_LEFT_CLASS_SCOPE');continue;}
    if(cleanURL(tab.url)!==s.jobs[lane.kind][lane.index]){if(lane.problem?.phase==='FINISH_CLICKED'&&cleanURL(tab.url)===s.scope){s.counts.answers++;await this.advance(s,lane);}else if(this.now()-lane.started>30000)await this.pause(s,lane,'UNEXPECTED_PAGE_OR_NAVIGATION_TIMEOUT');continue;}
    try{if(lane.kind==='video')await this.video(s,lane);else await this.exercise(s,lane);}catch{await this.pause(s,lane,'LANE_BROWSER_ADAPTER_ERROR');}
   }
  }catch(e){s.running=false;s.state='ERROR';s.errors.push({lane:'controller',code:/^[A-Z_0-9]+$/.test(e.message)?e.message:'BROWSER_ADAPTER_ERROR',at:this.now()});await this.save(s);await this.signal(s);for(const l of Object.values(s.lanes))await this.media(s,l,stopMedia);await this.api.alarms.clear(ALARM);}
  const pending=s.lanes.exercise;const nextPulseMs=s.running&&pending?.state==='WAITING_BEFORE_ANSWER'&&pending.tabId===tabId?Math.min(4000,Math.max(50,pending.delay.until-this.now())):4000;
  const resultWatch=s.running&&pending?.problem?.acceptedFinal&&['NEXT_CLICKED','FINISH_CLICKED'].includes(pending.problem.phase)&&pending.tabId===tabId;
  return {ok:true,running:s.running,nextPulseMs:resultWatch?1000:nextPulseMs};
 }
 async resume(){const s=await this.get();if(!s.running)throw Error('START_A_NEW_RUN');this.cancelled=false;for(const l of Object.values(s.lanes))if(l.state==='PAUSED'){if(l.error==='PROBLEM_CHANGED_DURING_WAIT')delete l.delay;l.state='READING';l.error='';l.started=this.now();if(l.problem?.phase==='ENTERING')l.problem=null;}await this.save(s);await this.signal(s);return {ok:true,run:this.public(s)};}
 async frame(sender){const s=await this.get();const lane=s.lanes.video;if(s.running&&lane?.tabId===sender.tab.id&&cleanURL(sender.tab.url)===s.jobs.video[lane.index]){lane.frameIds||=[0];if(!lane.frameIds.includes(sender.frameId)){lane.frameIds.push(sender.frameId);await this.save(s);}}return {ok:true};}
 async hello(sender){const s=await this.get();const active=s.running&&!this.cancelled&&(s.state==='DISCOVERING'&&s.sourceTab===sender.tab.id||Object.values(s.lanes).some(l=>l.tabId===sender.tab.id&&!['DONE','PAUSED'].includes(l.state)));return {ok:true,running:active,revision:s.revision};}
 async recoverAlarm(){const s=await this.get();if(s.running)await this.api.alarms.create(ALARM,{periodInMinutes:.5});}
}
export {ALARM};
