// Optional exact CAS: fixed loopback only, never a remote question endpoint.
const SETTING='local-cas';
export function helperPort(value){const port=Number(value??9000);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('INVALID_HELPER_PORT');return port;}
export const LOCAL_ORIGIN='http://127.0.0.1/*';
export async function localSettings(api){return (await api.storage.local?.get(SETTING))?.[SETTING]||{enabled:false};}
let reasonAbort,reasonGeneration=0,reviewCommitter=fn=>fn();
export const setReviewCommitter=fn=>{reviewCommitter=fn;};
export const commitReview=fn=>reviewCommitter(fn);
export const reasonEpoch=()=>reasonGeneration;
export function cancelLocalReason(){reasonGeneration++;reasonAbort?.abort();}
const mathRequests=new Set(),healthCache=new Map();
export function invalidateLocalHealth(){healthCache.clear();}
export function cancelLocalMath(){for(const controller of mathRequests)controller.abort();}
async function request(api,path,body,signal){
 const controller=path==='/v1/reason'?null:new AbortController();if(controller)mathRequests.add(controller);
 try{
  const settings=await localSettings(api);if(!settings.enabled||!settings.token||controller?.signal.aborted)return null;
  if(!await api.permissions.contains({origins:[LOCAL_ORIGIN]})||controller?.signal.aborted)return null;
  const deadline=signal||AbortSignal.timeout(8000),activeSignal=controller?AbortSignal.any([deadline,controller.signal]):deadline;
  const cacheKey=String(helperPort(settings.port))+'|'+settings.token;
  if(path!=='/v1/health'){
   let health=healthCache.get(cacheKey);if(!health||health.expires<Date.now()){let value;try{value=await request(api,'/v1/health',{},activeSignal);}catch(e){if(activeSignal.aborted)throw e;throw Error('LOCAL_HELPER_UNAVAILABLE');}health={value,expires:Date.now()+5000};healthCache.set(cacheKey,health);}
   if(health.value?.ok!==true)throw Error('LOCAL_HELPER_UNAVAILABLE');if(health.value.engine!=='sympy')throw Error('LOCAL_HELPER_MISMATCH');
   if(path.startsWith('/v2/')&&(!Array.isArray(health.value.capabilities)||!health.value.capabilities.includes('typed-task-v1')))throw Error('LOCAL_HELPER_UPDATE_REQUIRED');
   if(path==='/v2/transcribe'&&health.value.ocrAvailable!==true)throw Error('LOCAL_OCR_UNAVAILABLE');
   if(activeSignal.aborted)throw Error('LOCAL_REQUEST_CANCELLED');
  }
  const response=await fetch('http://127.0.0.1:'+helperPort(settings.port)+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+settings.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:activeSignal,redirect:'error',credentials:'omit',cache:'no-store'});
  if(!response.ok)throw Error(response.status===404&&path.startsWith('/v2/')?'LOCAL_HELPER_UPDATE_REQUIRED':'LOCAL_CAS_UNAVAILABLE');const text=await response.text();if(text.length>(path.startsWith('/v2/')?65536:24000))throw Error('LOCAL_CAS_RESPONSE_LIMIT');const data=JSON.parse(text);if(path==='/v1/health')healthCache.set(cacheKey,{value:data,expires:Date.now()+5000});return data;
 }finally{if(controller)mathRequests.delete(controller);}
}
export {request as localRequest};
export async function localAnswer(api,p){
 try{
  const r=await request(api,'/v1/solve',{expression:p.expression,operation:p.operation});
  if(!r||r.status!=='solved'||typeof r.answer!=='string'||typeof r.latex!=='string'||r.answer.length>2000||r.latex.length>4000||r.request?.expression!==p.expression||r.request?.operation!==p.operation||r.verification?.exact!==true||r.verification?.method!=='sympy-exact'||!['rational','quadratic-surd','rational-polynomial','exact-symbolic'].includes(r.certificate?.kind))return null;
  const answer={status:'solved',answer:r.answer,latex:r.latex,source:'local-sympy'};
  return await localReadback(api,p,answer,answer.answer)?answer:null;
 }catch{return null;}
}
export async function localComparison(api,p,answer,observed){
 if(typeof observed!=='string'||observed.length>4000)return null;
 try{const r=await request(api,'/v1/verify',{expression:p.expression,operation:p.operation,answer:answer.answer,observed});return r?.ok===true&&typeof r.equivalent==='boolean'&&r.verification?.exact===true?r.equivalent:null;}catch{return null;}
}
export async function localReadback(api,p,answer,observed){return await localComparison(api,p,answer,observed)===true;}
export async function localReason(api,p){try{reasonGeneration++;reasonAbort?.abort();reasonAbort=new AbortController();const r=await request(api,'/v1/reason',{expression:p.expression,operation:p.operation,instruction:String(p.instruction||'').slice(0,600)},AbortSignal.any([reasonAbort.signal,AbortSignal.timeout(45000)]));if(!r||r.request?.expression!==p.expression||r.request?.operation!==p.operation)return null;if(r.status==='solved'&&r.verification?.exact===true&&typeof r.answer==='string'&&typeof r.latex==='string'){const a={status:'solved',answer:r.answer,latex:r.latex,source:'local-sympy',explanation:String(r.reasoning?.explanation||'').slice(0,4000)};return await localReadback(api,p,a,a.answer)?a:null;}if(r.status==='review'&&typeof r.proposal?.answer==='string')return {status:'review',answer:r.proposal.answer.slice(0,2000),explanation:String(r.proposal.explanation||'').slice(0,4000),source:'local-model',verified:false};return null;}catch{return null;}}
export async function localHealthInfo(api){try{const r=await request(api,'/v1/health',{});return r?.ok===true&&r.engine==='sympy'?{connected:true,version:String(r.version||'unknown').slice(0,30),typedTask:Array.isArray(r.capabilities)&&r.capabilities.includes('typed-task-v1'),ocrAvailable:r.ocrAvailable===true,reasoningConfigured:r.reasoningConfigured===true,reasoningAvailable:r.reasoningAvailable===true,reasoningModel:String(r.reasoningModel||'').slice(0,120)}:{connected:false,mismatch:r?.ok===true};}catch{return {connected:false};}}
export async function localHealth(api){return (await localHealthInfo(api)).connected;}
// At most one background review job; it can never call an editor or Check.
export async function queueLocalReview(api,p,key,isCancelled=()=>false){
 const settings=await localSettings(api);if(!settings.enabled||isCancelled())return null;
 const current=(await api.storage.session.get('reason-review'))['reason-review'];
 if(isCancelled()||current?.state==='RUNNING'||key&&current?.key===key)return current;
 const job={id:crypto.randomUUID(),state:'RUNNING',...(key?{key,automatic:true}:{})};await api.storage.session.set({'reason-review':job});
 if(isCancelled()){await api.storage.session.set({'reason-review':{id:job.id,state:'CANCELLED'}});return null;}
 const work=localReason(api,p),generation=reasonEpoch();
 void work.then(result=>commitReview(async()=>{const active=(await api.storage.session.get('reason-review'))['reason-review'];if(generation===reasonEpoch()&&active?.id===job.id&&active.state==='RUNNING')await api.storage.session.set({'reason-review':{...job,state:result?'READY':'UNAVAILABLE',result}});})).catch(()=>{});
 return job;
}
export async function localInterpret(api,document){try{reasonGeneration++;reasonAbort?.abort();reasonAbort=new AbortController();return await request(api,'/v2/interpret',{document},AbortSignal.any([reasonAbort.signal,AbortSignal.timeout(45000)]));}catch{return null;}}
