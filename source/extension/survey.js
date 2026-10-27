import {isKhan,inScope} from './policy.js';
import {pageSnapshot} from './automation-page.js';
import {paginationUI} from './pagination.js';
import {solveSupported} from './advanced-math.js';
import {choiceDOM} from './choice-dom.js';
import {uniqueChoice} from './choice.js';
import {localAnswer,localComparison} from './local-cas.js';
import {surveyListSnapshot,surveyPreviewSnapshot} from './survey-page.js';
export const SURVEY_ALARM='klr-survey-heartbeat';
const STORE='survey-plan',SCHEMA='kubla-khan-plan-v1';
const clean=url=>{const u=new URL(url);return u.origin+u.pathname.replace(/\/$/,'');};
const scopeOf=url=>{if(!isKhan(url)||new URL(url).hostname!=='classroom.khanacademy.org')throw Error('OPEN_CLASSROOM_ASSIGNMENT_LIST');const u=new URL(url),m=u.pathname.match(/^\/learner\/class\/[^/]+\/?$/);if(!m)throw Error('OPEN_CLASSROOM_ASSIGNMENT_LIST');return u.origin+u.pathname.replace(/\/$/,'');};
const idle=()=>({running:false,stage:'IDLE',revision:0,sourceTab:null,previewTab:null,index:0,plan:null,error:'',scan:{pages:0,seen:[],pending:null}});
const kinds=['video','exercise','article','unknown'],classes=['video','article','intro-requires-start','multiple-choice','single-box','multiple-fields','graph','unknown'];
const solvers=['builtin-exact','local-sympy','media','none','inspect-after-start'];
export function validatePlan(plan){
 const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(v,k));
 if(!exact(plan,['schema','scope','createdAt','items'])||plan.schema!==SCHEMA||!Number.isFinite(plan.createdAt)||plan.createdAt<0||scopeOf(plan.scope)!==plan.scope||!Array.isArray(plan.items)||plan.items.length>100)throw Error('INVALID_SURVEY_PLAN');
 const seen=new Set();
 for(const item of plan.items){
  if(!exact(item,['url','kind','title','status','classification','solver','reason','visibleQuestionOnly'])||!kinds.includes(item.kind)||!['ready','review','unknown'].includes(item.status)||!classes.includes(item.classification)||!solvers.includes(item.solver)||typeof item.title!=='string'||item.title.length>160||/[\u0000-\u001f]/.test(item.title)||typeof item.reason!=='string'||!/^[A-Z_0-9]{1,80}$/.test(item.reason)||item.visibleQuestionOnly!==true)throw Error('INVALID_SURVEY_PLAN');
  if(typeof item.url!=='string'||item.url.length>2048||clean(item.url)!==item.url||!inScope(item.url,plan.scope)||!/^\/learner\/class\/[^/]+\/assignment\/[^/]+\/?$/.test(new URL(item.url).pathname)||seen.has(item.url))throw Error('INVALID_SURVEY_PLAN');seen.add(item.url);
  if(item.status==='ready'&&!(item.kind==='video'&&item.classification==='video'&&item.solver==='media'||item.kind==='exercise'&&['single-box','multiple-choice'].includes(item.classification)&&['builtin-exact','local-sympy'].includes(item.solver)))throw Error('INVALID_SURVEY_PLAN');
 }
 return plan;
}
export function executableJobs(plan){validatePlan(plan);const jobs={video:[],exercise:[]};for(const i of plan.items)if((i.status==='ready'||i.kind==='exercise'&&i.status==='unknown'&&i.classification==='intro-requires-start'&&i.solver==='inspect-after-start')&&Object.hasOwn(jobs,i.kind))jobs[i.kind].push(i.url);return jobs;}
export class SurveyRunner{
 constructor(api,now=()=>Date.now()){this.api=api;this.now=now;this.cancelled=false;this.generation=0;}
 cancel(){this.cancelled=true;this.generation++;}
 async get(){return (await this.api.storage.session.get(STORE))[STORE]||idle();}
 async save(s){if(!this.cancelled)await this.api.storage.session.set({[STORE]:s});}
 async invoke(id,func,args=[]){const r=await this.api.scripting.executeScript({target:{tabId:id,frameIds:[0]},func,args});return r[0]?.result;}
 public(s){return {sourceTab:s.sourceTab,previewTab:s.previewTab,running:s.running,stage:s.stage,revision:s.revision,error:s.error||'',captured:s.plan?.items.length||0,previewed:s.index||0,pages:s.scan?.pages||0,counts:{ready:s.plan?.items.filter(i=>i.status==='ready').length||0,review:s.plan?.items.filter(i=>i.status==='review').length||0,unknown:s.plan?.items.filter(i=>i.status==='unknown').length||0},plan:s.plan};}
 async signal(s){for(const id of [s.sourceTab,s.previewTab].filter(Number.isInteger)){if(this.cancelled&&s.running)return;await this.api.tabs.sendMessage(id,{type:'AUTO_CONFIG',running:s.running,revision:s.revision}).catch(()=>{});}}
 async start(tabId){
  const generation=++this.generation;const previous=await this.get();if(previous.running)throw Error('SURVEY_ALREADY_RUNNING');
  const tab=await this.api.tabs.get(tabId);const scope=scopeOf(tab.url);if(this.generation!==generation)return {ok:false,error:'SURVEY_CANCELLED'};this.cancelled=false;
  const s={...idle(),running:true,stage:'DISCOVERING',revision:previous.revision+1,sourceTab:tabId,started:this.now(),plan:{schema:SCHEMA,scope,createdAt:this.now(),items:[]}};
  await this.save(s);if(this.cancelled)return {ok:false,error:'SURVEY_CANCELLED'};
  try{await this.api.alarms.create(SURVEY_ALARM,{periodInMinutes:.5});if(this.cancelled){await this.api.alarms.clear(SURVEY_ALARM);return {ok:false,error:'SURVEY_CANCELLED'};}await this.api.scripting.executeScript({target:{tabId,frameIds:[0]},files:['runner-content.js']});if(this.cancelled)return {ok:false,error:'SURVEY_CANCELLED'};await this.signal(s);await this.tick(tabId);const current=await this.get();return {ok:current.stage!=='ERROR'&&current.stage!=='STOPPED',survey:this.public(current)};}catch(e){await this.fail(s,e);return {ok:false,error:s.error,survey:this.public(s)};}
 }
 async stop(){this.cancel();const s=await this.get();s.running=false;s.stage='STOPPED';s.revision++;await this.api.storage.session.set({[STORE]:s});await this.api.alarms.clear(SURVEY_ALARM);await this.signal(s);return {ok:true,survey:this.public(s)};}
 async closePreview(){const generation=this.generation;const s=await this.get();if(this.cancelled||generation!==this.generation||!Number.isInteger(s.previewTab))return;try{const tab=await this.api.tabs.get(s.previewTab);if(this.cancelled||generation!==this.generation)return;if(inScope(tab.url,s.plan?.scope||'')&&clean(tab.url)===s.previewURL)await this.api.tabs.remove?.(s.previewTab);}catch{}if(this.cancelled||generation!==this.generation)return;s.previewTab=null;await this.api.storage.session.set({[STORE]:s});}
 async fail(s,e){if(this.cancelled)return;s.running=false;s.stage='ERROR';s.error=/^[A-Z_0-9]+$/.test(e.message)?e.message:'SURVEY_BROWSER_ERROR';await this.save(s);await this.api.alarms.clear(SURVEY_ALARM);await this.signal(s);}
 async listInvoke(s,func,args=[]){try{const p=await this.invoke(s.sourceTab,func,args);delete s.scan.navigationSince;return p;}catch(e){if(!/frame.*(?:removed|unloaded)|document.*(?:removed|unloaded)|(?:execution|script) context.*(?:destroyed|invalidated)|cannot find context/i.test(String(e.message)))throw e;s.scan.navigationSince??=this.now();if(this.now()-s.scan.navigationSince>30000)throw Error('SURVEY_LIST_NAVIGATION_TIMEOUT');await this.save(s);return {navigationPending:true};}}
 async discover(s){
  const tab=await this.api.tabs.get(s.sourceTab);if(this.cancelled)return;if(clean(tab.url)!==s.plan.scope)throw Error('SURVEY_SOURCE_LEFT_CLASS_LIST');
  const p=await this.listInvoke(s,surveyListSnapshot);if(this.cancelled||p?.navigationPending)return;if(!p)throw Error('SURVEY_LIST_UNREADABLE');if(p.isTodo!==true)throw Error('SELECT_TO_DO_BEFORE_SURVEY');
  const nav=await this.listInvoke(s,paginationUI,['inspect',{url:p.url,page:p.page}]);if(this.cancelled||nav?.navigationPending)return;if(!nav?.ok){if(nav?.error==='STALE_LIST_PAGE')return;throw Error('SURVEY_PAGINATION_UNREADABLE');}
  const page=nav.page??p.page,pages=nav.pages??p.pages,signature=(page||'?')+'|'+p.items.map(i=>i.url).join('|');
  if(s.scan.pending){if(signature===s.scan.pending){if(this.now()-s.scan.pendingAt>20000)throw Error('SURVEY_PAGINATION_DID_NOT_CHANGE');return;}s.scan.pending=null;}
  if(!s.scan.pages&&page>1){await this.moveList(s,p,nav,'previous',signature);return;}
  if(!p.items.length){s.scan.emptySince??=this.now();await this.save(s);if(this.now()-s.scan.emptySince>20000)throw Error('SURVEY_NO_ASSIGNMENT_ROWS');return;}delete s.scan.emptySince;
  const hasNext=pages?page<pages:nav.next.enabled>0;
  if(hasNext&&nav.next.state!=='ready'){s.scan.waitSince??=this.now();await this.save(s);if(['ambiguous','unsafe'].includes(nav.next.state)||this.now()-s.scan.waitSince>20000)throw Error('SURVEY_NEXT_UNAVAILABLE');return;}delete s.scan.waitSince;
  if(s.scan.seen.includes(signature))throw Error('SURVEY_DUPLICATE_LIST_PAGE');s.scan.seen.push(signature);s.scan.pages++;
  for(const row of p.items){if(!inScope(row.url,s.plan.scope)||s.plan.items.some(i=>i.url===clean(row.url)))continue;s.plan.items.push({url:clean(row.url),kind:kinds.includes(row.kind)?row.kind:'unknown',title:String(row.title||'').replace(/[\u0000-\u001f]/g,'').slice(0,160),status:'unknown',classification:'unknown',solver:'none',reason:'NOT_PREVIEWED',visibleQuestionOnly:true});}
  if(s.plan.items.length>100)throw Error('SURVEY_QUEUE_LIMIT_100');
  if(hasNext){if(s.scan.pages>=10)throw Error('SURVEY_PAGE_LIMIT_10');await this.moveList(s,p,nav,'next',signature);return;}
  if(!s.plan.items.length)throw Error('SURVEY_NO_ASSIGNMENTS');
  validatePlan(s.plan);if(this.cancelled)return;
  const preview=await this.api.tabs.create({url:'about:blank',active:false});if(this.cancelled){await this.api.tabs.remove?.(preview.id).catch(()=>{});return;}
  s.previewTab=preview.id;s.previewURL=s.plan.items[0].url;s.stage='PREVIEWING';s.previewSince=this.now();await this.save(s);if(this.cancelled)return;await this.api.tabs.update(s.previewTab,{url:s.plan.items[0].url});if(!this.cancelled)await this.signal(s);
 }
 async moveList(s,p,nav,direction,signature){
  if(nav[direction]?.state!=='ready')throw Error('SURVEY_PAGINATION_UNAVAILABLE');s.scan.moves=(s.scan.moves||0)+1;if(s.scan.moves>20)throw Error('SURVEY_NAVIGATION_LIMIT');s.scan.pending=signature;s.scan.pendingAt=this.now();await this.save(s);if(this.cancelled)return;const r=await this.listInvoke(s,paginationUI,[direction,{url:p.url,page:nav.page??p.page}]);if(this.cancelled||r?.navigationPending)return;if(!r?.ok)throw Error('SURVEY_PAGINATION_ACTION_UNCERTAIN');
 }
 async preview(s){
  const item=s.plan.items[s.index],tab=await this.api.tabs.get(s.previewTab);if(this.cancelled)return;if(clean(tab.url)!==item.url){if(tab.pendingUrl&&clean(tab.pendingUrl)===item.url&&this.now()-s.previewSince<=30000)return;if(!inScope(tab.url,s.plan.scope))throw Error('SURVEY_PREVIEW_LEFT_CLASS_SCOPE');throw Error('SURVEY_PREVIEW_CHANGED_BY_USER');}
  let p,extra;try{p=await this.invoke(s.previewTab,pageSnapshot);if(this.cancelled)return;extra=await this.invoke(s.previewTab,surveyPreviewSnapshot);}catch(e){if(this.now()-s.previewSince<12000)return;item.status='review';item.reason='PREVIEW_UNREADABLE';await this.next(s);return;}
  if(this.cancelled)return;await this.requirePreview(s,item.url);if(this.cancelled)return;if(!p||!extra){if(this.now()-s.previewSince<12000)return;item.status='review';item.reason='PREVIEW_UNREADABLE';await this.next(s);return;}
  let choices=null;if(item.kind==='exercise'){choices=await this.invoke(s.previewTab,choiceDOM,['inspect']);if(this.cancelled)return;await this.requirePreview(s,item.url);if(this.cancelled)return;}
  item.status='review';item.solver='none';
  if(item.kind==='video'){item.classification='video';if(extra.videoCount===1||extra.videoFrames===1){item.status='ready';item.solver='media';item.reason='VISIBLE_VIDEO_PLAYER';}else if(this.now()-s.previewSince<12000)return;else item.reason='NO_VISIBLE_VIDEO_PLAYER';}
  else if(item.kind==='article'){item.classification='article';item.reason='MANUAL_READING_REQUIRED';}
  else if(item.kind==='unknown'){item.classification='unknown';item.status='unknown';item.reason='UNKNOWN_ASSIGNMENT_TYPE';}
  else if(extra.intro&&!p.fieldCount&&!p.radioCount){item.classification='intro-requires-start';item.status='unknown';item.solver='inspect-after-start';item.reason='PREVIEW_REQUIRES_START';}
  else if(p.unsupportedNotation){item.classification=p.radioCount?'multiple-choice':'single-box';item.reason='UNSUPPORTED_QUESTION_NOTATION';}
  else if(p.radioCount||choices?.ok){item.classification='multiple-choice';item.reason='CHOICE_REQUIRES_VERIFIED_SOLVER';if(choices?.selected?.length)item.reason='EXISTING_CHOICE_PRESERVED';else if(choices?.ok&&p.expression&&p.operation&&!p.unsupportedAnswerFormat&&!p.unsupportedFactorDomain){let answer=solveSupported(p.expression,p.operation);if(answer.status!=='solved'){const local=await localAnswer(this.api,p);if(this.cancelled)return;if(local)answer=local;}if(answer.status==='solved'){const match=await uniqueChoice(p,answer,choices.choices,answer.source==='local-sympy'?expression=>localComparison(this.api,p,answer,expression):undefined);if(this.cancelled)return;if(match.ok){item.status='ready';item.solver=answer.source==='local-sympy'?'local-sympy':'builtin-exact';item.reason='FIRST_VISIBLE_CHOICE_VERIFIED';}else item.reason=match.error;}}}
  else if(p.fieldCount>1){item.classification='multiple-fields';item.reason='MULTIPLE_FIELDS_REQUIRE_REVIEW';}
  else if(extra.graph){item.classification='graph';item.reason='GRAPH_REQUIRES_REVIEW';}
  else if(p.fieldCount===1){item.classification='single-box';if(String(p.fieldValue||'').trim()||extra.editorWork)item.reason='EXISTING_ANSWER_PRESERVED';else if(!p.expression||!p.operation){if(this.now()-s.previewSince<12000)return;item.reason='VISIBLE_MATH_UNREADABLE';}else if(p.unsupportedAnswerFormat||p.unsupportedFactorDomain)item.reason='UNSUPPORTED_ANSWER_CONSTRAINT';else{let answer=solveSupported(p.expression,p.operation);if(answer.status!=='solved'){const local=await localAnswer(this.api,p);if(this.cancelled)return;if(local)answer=local;}if(answer.status==='solved'){item.status='ready';item.solver=answer.source==='local-sympy'?'local-sympy':'builtin-exact';item.reason='FIRST_VISIBLE_QUESTION_SUPPORTED';}else item.reason='VISIBLE_MATH_UNSUPPORTED';}}
  else{if(this.now()-s.previewSince<12000)return;item.classification='unknown';item.status='unknown';item.reason='NO_VISIBLE_QUESTION';}
  await this.next(s);
 }
 async requirePreview(s,expected){const tab=await this.api.tabs.get(s.previewTab);if(this.cancelled)return false;if(!tab||!inScope(tab.url,s.plan.scope))throw Error('SURVEY_PREVIEW_LEFT_CLASS_SCOPE');if(clean(tab.url)!==expected)throw Error('SURVEY_PREVIEW_CHANGED_BY_USER');return true;}
 async next(s){
  if(this.cancelled)return;const expected=s.plan.items[s.index].url;await this.requirePreview(s,expected);if(this.cancelled)return;
  s.index++;if(s.index>=s.plan.items.length){validatePlan(s.plan);s.running=false;s.stage='READY';await this.save(s);if(this.cancelled)return;await this.api.alarms.clear(SURVEY_ALARM);await this.signal(s);if(!this.cancelled)await this.closePreview();return;}
  s.previewSince=this.now();await this.save(s);if(this.cancelled)return;await this.requirePreview(s,expected);if(this.cancelled)return;
  s.previewURL=s.plan.items[s.index].url;await this.save(s);if(this.cancelled)return;await this.requirePreview(s,expected);if(!this.cancelled)await this.api.tabs.update(s.previewTab,{url:s.previewURL});
 }
 async tick(tabId){const s=await this.get();if(!s.running||this.cancelled)return {ok:true,running:false};if(tabId!=null&&tabId!==(s.stage==='DISCOVERING'?s.sourceTab:s.previewTab))return {ok:true,running:true,nextPulseMs:1000};try{if(this.now()-s.started>30*60*1000)throw Error('SURVEY_TIME_LIMIT');if(s.stage==='DISCOVERING')await this.discover(s);else if(s.stage==='PREVIEWING')await this.preview(s);}catch(e){await this.fail(s,e);}return {ok:true,running:s.running,nextPulseMs:1000,survey:this.public(s)};}
 async hello(sender){const s=await this.get();return {ok:true,running:s.running&&!this.cancelled&&(s.stage==='DISCOVERING'?s.sourceTab===sender.tab.id:s.previewTab===sender.tab.id),revision:s.revision};}
 async exportPlan(){const s=await this.get();if(s.running||s.stage!=='READY')throw Error('SURVEY_PLAN_NOT_READY');return structuredClone(validatePlan(s.plan));}
}
