import {isKhan,scope,inScope,validMedia,safeRate} from './policy.js';
import {insertReviewed} from './input.js';
import {DualRunner,ALARM} from './dual.js';
import {mathQuillDOM} from './mq-dom.js';
import {solveSupported,equivalent} from './advanced-math.js';
const dual=new DualRunner(chrome);
const VERSION='2.1.3';
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
    if(m.type==='AUTO_HELLO'&&sender.frameId===0)return dual.hello(sender);
    if(m.type==='AUTO_PULSE'&&sender.frameId===0){const r=await dual.hello(sender);return r.running?dual.tick(id):{ok:true,running:false};}
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
  if(m.type==='AUTO_STATUS')return dual.status();
  if(m.type==='AUTO_STOP')return dual.stop();
  if(m.type==='AUTO_RESUME')return dual.resume();
  if(m.type==='AUTO_START'){
    if(requestEpoch!==stopEpoch)throw Error('START_CANCELLED_BY_STOP');
    const old=await get(id);old.running=false;old.revision++;await save(id,old);await broadcast(id,old);
    if(requestEpoch!==stopEpoch)throw Error('START_CANCELLED_BY_STOP');
    return dual.start(id,{rate:m.rate,muted:m.muted});
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
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.type==='AUTO_STOP'&&sender.url?.startsWith(chrome.runtime.getURL(''))&&!sender.tab){stopEpoch++;dual.cancel();}
  const requestEpoch=stopEpoch;
  queue=queue.then(()=>handle(m,sender,requestEpoch)).then(reply,e=>reply({ok:false,error:e.message||'REQUEST_FAILED'}));return true;
});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM)queue=queue.then(()=>dual.tick()).catch(()=>{});});
void dual.recoverAlarm().catch(()=>{});
chrome.tabs.onRemoved.addListener(id=>{queue=queue.then(()=>chrome.storage.session.remove(key(id)));});
chrome.tabs.onUpdated.addListener((id,change)=>{if(change.url)queue=queue.then(async()=>{const s=await get(id);if(s.running&&!inScope(change.url,s.scope)){s.running=false;s.revision++;s.state='IDLE';await save(id,s);await broadcast(id,s);}});});
