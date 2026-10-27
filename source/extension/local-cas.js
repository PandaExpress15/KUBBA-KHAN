// Optional exact CAS: fixed loopback only, never a remote question endpoint.
const ORIGIN='http://127.0.0.1:8765',SETTING='local-cas';
export const LOCAL_ORIGIN='http://127.0.0.1/*';
export async function localSettings(api){return (await api.storage.local?.get(SETTING))?.[SETTING]||{enabled:false};}
async function request(api,path,body){
 const settings=await localSettings(api);if(!settings.enabled||!settings.token)return null;
 if(!await api.permissions.contains({origins:[LOCAL_ORIGIN]}))return null;
 const response=await fetch(ORIGIN+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+settings.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000),redirect:'error',credentials:'omit',cache:'no-store'});
 if(!response.ok)throw Error('LOCAL_CAS_UNAVAILABLE');const text=await response.text();if(text.length>24000)throw Error('LOCAL_CAS_RESPONSE_LIMIT');return JSON.parse(text);
}
export async function localAnswer(api,p){
 try{
  const r=await request(api,'/v1/solve',{expression:p.expression,operation:p.operation});
  if(!r||r.status!=='solved'||typeof r.answer!=='string'||typeof r.latex!=='string'||r.answer.length>2000||r.latex.length>4000||r.request?.expression!==p.expression||r.request?.operation!==p.operation||r.verification?.exact!==true||r.verification?.method!=='sympy-exact'||!['rational','quadratic-surd','rational-polynomial','exact-symbolic'].includes(r.certificate?.kind))return null;
  const answer={status:'solved',answer:r.answer,latex:r.latex,source:'local-sympy'};
  return await localReadback(api,p,answer,answer.answer)?answer:null;
 }catch{return null;}
}
export async function localReadback(api,p,answer,observed){
 if(typeof observed!=='string'||observed.length>4000)return false;
 try{const r=await request(api,'/v1/verify',{expression:p.expression,operation:p.operation,answer:answer.answer,observed});return r?.ok===true&&r.equivalent===true&&r.verification?.exact===true;}catch{return false;}
}
export async function localHealth(api){try{return (await request(api,'/v1/health',{}))?.ok===true;}catch{return false;}}
