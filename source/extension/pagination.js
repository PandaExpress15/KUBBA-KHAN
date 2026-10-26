// Self-contained: injected into the ordinary class-list DOM, never app internals.
export function paginationUI(action='inspect',expected={}){
 const currentURL=new URL(location.href);
 if(currentURL.hostname!=='classroom.khanacademy.org'||!/^\/learner\/class\/[^/]+\/?$/.test(currentURL.pathname))return {ok:false,error:'NOT_CLASS_ASSIGNMENT_LIST'};
 if(expected.url&&location.href!==expected.url)return {ok:false,error:'STALE_LIST_PAGE'};
 const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],[inert]');
 const normalize=s=>String(s||'').replace(/^[\s<>←→‹›«»]+|[\s<>←→‹›«»]+$/g,'').replace(/\s+/g,' ').trim().toLowerCase();
 const text=e=>e?.innerText||e?.textContent||'';
 const disabled=e=>e.matches(':disabled')||e.getAttribute('aria-disabled')?.toLowerCase()==='true'||!!e.closest('[aria-disabled="true"],[inert]')||getComputedStyle(e).pointerEvents==='none';
 const counter=(text(document.body).match(/\bcurrent\s+page\s*:?\s*(\d+)\s*(?:of|\/)\s*(\d+)/i)||text(document.body).match(/\bpage\s*:?\s*(\d+)\s*(?:of|\/)\s*(\d+)/i));
 const page=counter?Number(counter[1]):null,pages=counter?Number(counter[2]):null;
 if(expected.page!=null&&page!=null&&expected.page!==page)return {ok:false,error:'STALE_LIST_PAGE'};
 const patterns={next:/^(?:go to (?:the )?)?next(?: (?:page|assignments|results)(?: (?:of )?(?:assignments|results))?)?$/,previous:/^(?:go to (?:the )?)?(?:previous|prev)(?: (?:page|assignments|results)(?: (?:of )?(?:assignments|results))?)?$/};
 const inPagination=e=>{
  for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){
   const label=[p.getAttribute('aria-label'),p.getAttribute('data-testid'),p.getAttribute('title')].filter(Boolean).join(' ');
   if(/pagin|page navigation|assignment navigation/i.test(label))return true;
   if(p.matches('nav,[role=navigation]')&&/\bpage\s*:?\s*\d+\s*(?:of|\/)\s*\d+/i.test(text(p)))return true;
  }
  return false;
 };
 const safeTarget=e=>{
  const href=e.getAttribute('href');if(href==null)return true;
  try{const u=new URL(href,location.href);return u.protocol==='https:'&&u.origin===currentURL.origin&&u.pathname.replace(/\/$/,'')===currentURL.pathname.replace(/\/$/,'');}catch{return false;}
 };
 const candidates={next:[],previous:[]};let conflicts=0;
 for(const e of document.querySelectorAll('button,a,[role=button],[role=link],input[type=button],input[type=submit]')){
  if(!visible(e))continue;
  const labelled=(e.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>text(document.getElementById(id))).join(' ');
  const labels=[['accessible',e.getAttribute('aria-label')],['accessible',labelled],['text',text(e)],['text',e.matches('input')?e.value:''],['title',e.getAttribute('title')]].map(([source,value])=>({source,value:normalize(value)})).filter(x=>x.value);
  const rel=(e.getAttribute('rel')||'').toLowerCase().split(/\s+/);
  const next=labels.some(x=>patterns.next.test(x.value))||rel.includes('next');
  const previous=labels.some(x=>patterns.previous.test(x.value))||rel.includes('prev')||rel.includes('previous');
  if(next&&previous){conflicts++;continue;}
  if(labels.some(x=>/^(?:go to (?:the )?)?(?:next|previous|prev) (?:question|lesson|activity|exercise|video|chapter)\b/.test(x.value)))continue;
  const scoped=inPagination(e);
  if(e.closest('td,[role=cell]')&&!scoped)continue;
  for(const direction of ['next','previous']){
   if(!(direction==='next'?next:previous))continue;
   const sources=[...new Set(labels.filter(x=>patterns[direction].test(x.value)).map(x=>x.source))];
   if(rel.includes(direction==='next'?'next':'prev'))sources.push('relationship');
   candidates[direction].push({element:e,scoped,disabled:disabled(e),safe:safeTarget(e),sources});
  }
 }
 const select=direction=>{
  const all=candidates[direction],scoped=all.filter(x=>x.scoped),pool=scoped.length?scoped:all;
  const enabled=pool.filter(x=>!x.disabled),allowed=enabled.filter(x=>x.safe);
  const state=!pool.length?'missing':!enabled.length?'disabled':allowed.length!==enabled.length?'unsafe':allowed.length===1?'ready':'ambiguous';
  return {element:state==='ready'?allowed[0].element:null,report:{state,found:all.length,scoped:scoped.length,enabled:enabled.length,sources:[...new Set(pool.flatMap(x=>x.sources))]}};
 };
 const next=select('next'),previous=select('previous');
 const report={ok:true,page,pages,next:next.report,previous:previous.report,conflictingLabels:conflicts};
 if(action==='inspect')return report;
 if(!['next','previous'].includes(action))return {ok:false,error:'UNKNOWN_PAGINATION_ACTION'};
 const selection=action==='next'?next:previous;
 if(selection.report.state!=='ready')return {...report,ok:false,error:'PAGINATION_CONTROL_'+selection.report.state.toUpperCase()};
 const e=selection.element;e.scrollIntoView({block:'nearest',inline:'nearest'});
 if(!e.isConnected||!visible(e)||disabled(e)||!safeTarget(e))return {...report,ok:false,error:'PAGINATION_CONTROL_CHANGED'};
 e.click();return {...report,clicked:true};
}
