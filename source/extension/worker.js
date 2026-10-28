import {recoverTypedInterpretation} from './typed-client.js';
import {readProblemDOM} from './problem-dom.js';
import {questionSample,publicWidgetInventory} from './problem-capture.js';
import {localRequest} from './local-cas.js';
import {SurveyRunner,SURVEY_ALARM,executableJobs} from './survey.js';
import {localHealth,localHealthInfo,helperPort,localReason,cancelLocalReason,cancelLocalMath,reasonEpoch,setReviewCommitter,commitReview} from './local-cas.js';
import {isKhan,scope,inScope,validMedia,safeRate} from './policy.js';
import {insertReviewed} from './input.js';
import {DualRunner,ALARM,classScope as classScopeForPlan} from './dual.js';
import {mathQuillDOM} from './mq-dom.js';
import {solveSupported,equivalent} from './advanced-math.js';
const dual=new DualRunner(chrome),survey=new SurveyRunner(chrome);
const VERSION=(chrome.runtime.getManifest?.()||{}).version||'2.2.0';
let typedStopSignal=Promise.resolve();
async function signalTypedStop(){const run=(await chrome.storage.session.get('dual-run'))['dual-run'];await Promise.all(Object.values(run?.lanes||{}).filter(l=>l.kind==='exercise').map(async lane=>{try{const tab=await chrome.tabs.get(lane.tabId);if(!inScope(tab.url,run.scope))return;await chrome.scripting.executeScript({target:{tabId:lane.tabId,frameIds:[0]},world:'MAIN',func:()=>{globalThis.__kublaTypedStopEpoch=(globalThis.__kublaTypedStopEpoch||0)+1;}});}catch{}}));}
const key=id=>'tab:'+id;
const empty=()=>({running:false,rate:2,autoNext:false,state:'IDLE',revision:0});
async function get(id){return (await chrome.storage.session.get(key(id)))[key(id)]||empty();}
async function save(id,s){await chrome.storage.session.set({[key(id)]:s});}
async function broadcast(id,s){try{await chrome.tabs.sendMessage(id,{type:'CONFIG',config:s});}catch{ /* Page may be navigating. HELLO reconnects. */ }}
async function mainTab(id){const tab=await chrome.tabs.get(id);if(!isKhan(tab.url))throw Error('OPEN_KHAN_TAB');return tab;}
async function handle(m,sender,requestEpoch){
  const internal=sender.url?.startsWith(chrome.runtime.getURL(''))&&!sender.tab;
  if(!m||typeof m.type!=='string')throw Error('INVALID_MESSAGE');
  if(!internal){
    const id=sender.tab?.id;if(!Number.isInteger(id)||!isKhan(sender.tab.url)||!(isKhan(sender.url)||validMedia(sender.url)))throw Error('UNAUTHORIZED_FRAME');
    if(m.type==='AUTO_FRAME')return dual.frame(sender);
    if(m.type==='AUTO_HELLO'&&sender.frameId===0)return (await survey.get()).running?survey.hello(sender):dual.hello(sender);
    if(m.type==='AUTO_PULSE'&&sender.frameId===0){if((await survey.get()).running){const r=await survey.hello(sender);return r.running?survey.tick(id):{ok:true,running:false};}const r=await dual.hello(sender);return r.running?dual.tick(id):{ok:true,running:false};}
    const s=await get(id);
    if(m.type==='HELLO')return {ok:true,config:inScope(sender.tab.url,s.scope||'')?s:empty()};
    if(m.type==='REPORT'){
      if(!s.running||m.revision!==s.revision||!inScope(sender.tab.url,s.scope))return {ok:false,error:'STALE_SESSION'};
      if(!['IDENTIFY_PAGE','VIDEO_READY','VIDEO_PLAYING','VIDEO_ENDED','WAIT_FOR_USER_REVIEW','UNSUPPORTED','ERROR','NAVIGATED'].includes(m.state))throw Error('INVALID_STATE');
      // Keep only enum/numeric diagnostics, never URL, page text, exercise or student records.
      s.frames||={};s.frames[sender.frameId]={state:m.state,code:/^[A-Z_]{1,64}$/.test(m.code||'')?m.code:'',videos:Math.min(Number(m.videos)||0,20),rate:Number(m.rate)||0};
      if(sender.frameId===0||m.state.startsWith('VIDEO_'))s.state=m.state;
      if(m.code==='SESSION_TIME_LIMIT'){s.running=false;s.state='ERROR';s.revision++;await save(id,s);await broadcast(id,s);return {ok:true};}
      await save(id,s);
      if(m.state==='VIDEO_ENDED'&&sender.frameId!==0)await chrome.tabs.sendMessage(id,{type:'MEDIA_ENDED',revision:s.revision},{frameId:0}).catch(()=>{});
      return {ok:true};
    }
    throw Error('UNKNOWN_CONTENT_ACTION');
  }
  const id=m.tabId;if(!Number.isInteger(id))throw Error('NO_TAB');
  if(m.type==='QUESTION_SAMPLE'){const tab=await mainTab(id);if(!/\/assignment\//.test(new URL(tab.url).pathname))throw Error('OPEN_ASSIGNMENT_QUESTION');const r=(await chrome.scripting.executeScript({target:{tabId:id,frameIds:[0]},func:readProblemDOM,args:['read']}))[0]?.result;if(!r?.ok)throw Error(r?.error||'QUESTION_UNREADABLE');const inventory=(await chrome.scripting.executeScript({target:{tabId:id,frameIds:[0]},func:publicWidgetInventory}))[0]?.result;return {ok:true,sample:questionSample(r.document,{...r.probe,widgetInventory:inventory})};}
  if(m.type==='LOCAL_OCR'){const tab=await mainTab(id);if(!/\/assignment\//.test(new URL(tab.url).pathname)||typeof m.data!=='string'||m.data.length>2800000||!/^[A-Za-z0-9+/=]+$/.test(m.data))throw Error('CROPPED_PNG_REQUIRED');const r=(await chrome.scripting.executeScript({target:{tabId:id,frameIds:[0]},func:readProblemDOM,args:['read']}))[0]?.result;if(!r?.ok)throw Error('QUESTION_UNREADABLE');const result=await localRequest(chrome,'/v2/transcribe',{image:{mime:'image/png',data:m.data},fingerprint:r.document.fingerprint,source:'question-crop'});if(result?.status!=='transcribed'||result.fingerprint!==r.document.fingerprint||result.verification?.exact!==false)throw Error('OCR_UNAVAILABLE');return {ok:true,result};}
  if(m.type==='SURVEY_STATUS')return {ok:true,survey:survey.public(await survey.get())};
  if(m.type==='SURVEY_START'){await chrome.storage.session.remove('typed-interpretation');if(requestEpoch!==stopEpoch)throw Error('START_CANCELLED_BY_STOP');if((await dual.get()).running)throw Error('STOP_CURRENT_RUN_BEFORE_SURVEY');if(requestEpoch!==stopEpoch)throw Error('START_CANCELLED_BY_STOP');return survey.start(id);}
  if(m.type==='SURVEY_EXPORT')return {ok:true,plan:await survey.exportPlan()};
  if(m.type==='SURVEY_EXECUTE'){if(requestEpoch!==stopEpoch)throw Error('START_CANCELLED_BY_STOP');if((await survey.get()).running)throw Error('WAIT_FOR_SURVEY_COMPLETION');const plan=await survey.exportPlan(),tab=await chrome.tabs.get(id);if(classScopeForPlan(tab.url)!==plan.scope||new URL(tab.url).origin+new URL(tab.url).pathname.replace(/\/$/,'')!==plan.scope)throw Error('PLAN_REQUIRES_CLASS_ASSIGNMENT_LIST');if(requestEpoch!==stopEpoch)throw Error('START_CANCELLED_BY_STOP');await survey.closePreview();if(requestEpoch!==stopEpoch)throw Error('START_CANCELLED_BY_STOP');return dual.startPlan(id,executableJobs(plan),{rate:m.rate,muted:m.muted,continueBlocked:m.continueBlocked});}
  if(m.type==='LOCAL_REASON_STATUS'){return {ok:true,job:(await chrome.storage.session.get('reason-review'))['reason-review']||null};}
  if(m.type==='LOCAL_REASON_START'){const interrupted=(await chrome.storage.session.get('typed-interpretation'))['typed-interpretation'];if(interrupted?.state==='RUNNING')await chrome.storage.session.set({'typed-interpretation':{...interrupted,state:'CANCELLED',reason:'MODEL_REQUEST_SUPERSEDED'}});if(typeof m.expression!=='string'||m.expression.length>300||typeof m.instruction!=='string'||m.instruction.length>600||!['factor','expand','simplify','evaluate','equation','unknown'].includes(m.operation))throw Error('INVALID_REASONING_REQUEST');const job={id:crypto.randomUUID(),state:'RUNNING'};await chrome.storage.session.set({'reason-review':job});const work=localReason(chrome,m),generation=reasonEpoch();void work.then(result=>commitReview(async()=>{const current=(await chrome.storage.session.get('reason-review'))['reason-review'];if(generation===reasonEpoch()&&current?.id===job.id&&current.state==='RUNNING')await chrome.storage.session.set({'reason-review':{...job,state:result?'READY':'UNAVAILABLE',result}});})).catch(()=>{});return {ok:true,job};}
  if(m.type==='LOCAL_HEALTH')return {ok:true,health:await localHealthInfo(chrome)};
  if(m.type==='LOCAL_ENABLE'){if(!/^[A-Za-z0-9_-]{24,128}$/.test(m.token||''))throw Error('INVALID_HELPER_TOKEN');await chrome.storage.local.set({'local-cas':{enabled:true,token:m.token,port:helperPort(m.port)}});const health=await localHealthInfo(chrome);return {ok:true,connected:health.connected,health};}
  if(m.type==='LOCAL_DISABLE'){cancelLocalReason();await chrome.storage.local.remove('local-cas');return {ok:true};}
  if(m.type==='LOCAL_STATUS'){const settings=(await chrome.storage.local.get('local-cas'))['local-cas'];return {ok:true,enabled:!!settings?.enabled,port:settings?.port||9000};}
  if(m.type==='AUTO_STATUS')return dual.status();
  if(m.type==='AUTO_STOP'){await typedStopSignal;const typedJob=(await chrome.storage.session.get('typed-interpretation'))['typed-interpretation'];if(typedJob)await chrome.storage.session.set({'typed-interpretation':{id:typedJob.id,fingerprint:typedJob.fingerprint,state:'CANCELLED'}});cancelLocalMath();if((await survey.get()).running)await survey.stop();cancelLocalReason();const job=(await chrome.storage.session.get('reason-review'))['reason-review'];if(job)await chrome.storage.session.set({'reason-review':{id:job.id,state:'CANCELLED'}});return dual.stop();}
  if(m.type==='AUTO_RESUME')return dual.resume();
  if(m.type==='AUTO_START'){await chrome.storage.session.remove('typed-interpretation');
    if((await survey.get()).running)throw Error('STOP_SURVEY_BEFORE_START');
    if(requestEpoch!==stopEpoch)throw Error('START_CANCELLED_BY_STOP');
    const old=await get(id);old.running=false;old.revision++;await save(id,old);await broadcast(id,old);
    if(requestEpoch!==stopEpoch)throw Error('START_CANCELLED_BY_STOP');
    return dual.start(id,{rate:m.rate,muted:m.muted,continueBlocked:m.continueBlocked});
  }
  if(m.type==='STOP'){
    const s=await get(id);s.running=false;s.state='IDLE';s.revision++;s.frames={};await save(id,s);await broadcast(id,s);return {ok:true,config:s};
  }
  const tab=await mainTab(id);
  if(m.type==='STATUS')return {ok:true,version:VERSION,config:await get(id)};
  if(m.type==='START'){
    const old=await get(id);const s={running:true,scope:scope(tab.url),rate:safeRate(m.rate),autoNext:m.autoNext===true,state:'IDENTIFY_PAGE',revision:old.revision+1,frames:{}};
    await save(id,s);await broadcast(id,s);return {ok:true,config:s};
  }
  if(['READ','PLAY'].includes(m.type))return await chrome.tabs.sendMessage(id,{type:m.type},{frameId:0});
  if(m.type==='INSERT'){
    // Recompute, do not accept arbitrary code, selectors, LaTeX or answers from a web page.
    const result=solveSupported(m.expression,m.mode);if(result.status!=='solved')throw Error('NO_VERIFIED_ANSWER');
    if(typeof m.token!=='string'||m.token.length>3000)throw Error('READ_PROBLEM_AGAIN');
    const results=await chrome.scripting.executeScript({target:{tabId:id,frameIds:[0]},world:'MAIN',func:insertReviewed,args:[{answer:result.answer,latex:result.latex},m.token]});
    let entry=results[0]?.result||{ok:false,error:'INPUT_BRIDGE_FAILED'};
    if(entry.error==='MATHQUILL_PUBLIC_API_UNAVAILABLE_COPY_MANUALLY'){
      const fallback=await chrome.scripting.executeScript({target:{tabId:id,frameIds:[0]},world:'MAIN',func:mathQuillDOM,args:['insert',{token:m.token},result]});entry=fallback[0]?.result||entry;
    }
    if(entry.ok&&entry.kind==='mathquill'){
      if(!equivalent(entry.observed,result.answer))return {ok:false,error:'ENTRY_CHANGED_OR_UNVERIFIED_INSPECT_FIELD_MANUALLY'};
    }
    return entry;
  }
  throw Error('UNKNOWN_POPUP_ACTION');
}
// Serialize state mutations: a pending old REPORT cannot resurrect a stopped session.
let queue=Promise.resolve(),stopEpoch=0;
setReviewCommitter(work=>{queue=queue.then(work).catch(()=>{});return queue;});
queue=queue.then(()=>recoverTypedInterpretation(chrome)).catch(()=>{});
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.type==='AUTO_STOP'&&sender.url?.startsWith(chrome.runtime.getURL(''))&&!sender.tab){stopEpoch++;dual.cancel();survey.cancel();cancelLocalReason();cancelLocalMath();typedStopSignal=signalTypedStop();}
  const requestEpoch=stopEpoch;
  queue=queue.then(()=>handle(m,sender,requestEpoch)).then(reply,e=>reply({ok:false,error:e.message||'REQUEST_FAILED'}));return true;
});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM)queue=queue.then(()=>dual.tick()).catch(()=>{});if(alarm.name===SURVEY_ALARM)queue=queue.then(()=>survey.tick()).catch(()=>{});});
void dual.recoverAlarm().catch(()=>{});void survey.get().then(s=>{if(s.running)return chrome.alarms.create(SURVEY_ALARM,{periodInMinutes:.5});}).catch(()=>{});
chrome.tabs.onRemoved.addListener(id=>{queue=queue.then(()=>chrome.storage.session.remove(key(id)));});
chrome.tabs.onUpdated.addListener((id,change)=>{if(change.url)queue=queue.then(async()=>{const s=await get(id);if(s.running&&!inScope(change.url,s.scope)){s.running=false;s.revision++;s.state='IDLE';await save(id,s);await broadcast(id,s);}});});
