// Self-contained functions injected by the extension. Read visible UI, never private app state.
export function pageSnapshot(){
 const visible=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const text=e=>(e?.innerText||e?.textContent||'').trim();
 const fieldSelector='.mq-editable-field,input:not([type]),input[type=text],input[type=number],textarea';
 const roots=[...document.querySelectorAll('main,[role=main],.perseus-renderer,[data-testid*=question]')].filter(visible);
 const root=roots.filter(e=>[...e.querySelectorAll(fieldSelector)].some(visible)).sort((a,b)=>a.contains(b)?1:b.contains(a)?-1:0)[0]||roots[0]||document;
 const controls=[...root.querySelectorAll('button,a,[role=button]')].filter(e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true').map(e=>(e.getAttribute('aria-label')||text(e)).replace(/\s+/g,' ').trim());
 const raw=[...root.querySelectorAll(fieldSelector)];
 const fields=raw.filter(e=>visible(e)&&!e.disabled&&!e.readOnly&&!(e.matches('input,textarea')&&e.closest('.mq-editable-field'))&&!e.closest('[role=search]')&&!/search|message|chat/i.test(e.getAttribute('aria-label')||''));
 const anns=[...root.querySelectorAll('annotation[encoding="application/x-tex"]')].filter(e=>!e.closest('.mq-editable-field')&&!e.closest('[hidden]')&&visible(e.closest('math')||e.parentElement||e));
 const expressions=[...new Set(anns.map(e=>text(e)).filter(Boolean))];
 const mathToken=Array.from(document.querySelectorAll('annotation[encoding="application/x-tex"],.katex-mathml math')).filter(e=>!e.closest('.mq-editable-field')).map(e=>e.textContent).join('|').slice(0,2000);
 const body=text(document.body);const prompt=root===document?'':text(root);
 const ordinal=body.match(/\b(\d+)\s*(?:of|\/)\s*(\d+)\s*questions?\b/i);
 const operation=/\bfactor(?:ing)?\b/i.test(prompt)?'factor':/\bexpand\b/i.test(prompt)?'expand':/\bsolve\b/i.test(prompt)?'equation':/\bevaluate|calculate\b/i.test(prompt)?'evaluate':/\bsimplify|combine like|reduce (?:the |this )?rational|lowest terms\b/i.test(prompt)?'simplify':expressions.length===1&&/^(?:\\)?(?:sin|cos|tan)\s*(?:\\left)?\(/.test(expressions[0])?'evaluate':null;
 const feedback=[...root.querySelectorAll('[role=status],[role=alert],[data-testid*=feedback],.perseus-correctness')].filter(visible).map(text).join(' ');
 const negative=/\bincorrect\b|not correct|not quite|try again|wrong answer/i.test(feedback);
 const hasCheck=controls.some(s=>/^(check|check answer|check answers|submit answer)$/i.test(s));
 const accepted=!negative&&!hasCheck&&/\bcorrect[!.]?\b|well done|great job|nice work/i.test(feedback);
 const done=/\b(?:exercise|assignment|practice|activity)\s+(?:is\s+)?complete[d]?\b|you(?:'ve| have)? (?:successfully )?(?:finished|completed) (?:this|the) (?:exercise|assignment|practice|activity)/i.test(root===document?'':text(root));
 const items=[];
 for(const row of document.querySelectorAll('tr,[role=row]')){
  const label=text(row),types=[...row.querySelectorAll('td,[role=cell]')].map(e=>text(e).toLowerCase()).filter(s=>s==='video'||s==='exercise');
  const kind=types.length===1?types[0]:/\bexercise\b/i.test(label)&&!/\bvideo\b/i.test(label)?'exercise':/\bvideo\b/i.test(label)&&!/\bexercise\b/i.test(label)?'video':null;if(!kind||/\bcompleted\b/i.test(label))continue;
  const links=[...row.querySelectorAll('a[href]')].filter(a=>a.getAttribute('href')?.includes('/assignment/'));
  if(links.length===1){const u=new URL(links[0].getAttribute('href'),location.href);if(u.origin===location.origin)items.push({url:u.href.split('#')[0],kind});}
 }
 const page=body.match(/current page:\s*(\d+)\s*(?:of|\/)\s*(\d+)/i);
 const statusSelect=[...document.querySelectorAll('select')].find(e=>[...e.options].some(o=>/^to[ -]?do$/i.test(o.textContent.trim())));
 const isTodo=statusSelect?/^to[ -]?do$/i.test(statusSelect.selectedOptions[0]?.textContent.trim()||''):null;
 return {url:location.href,token:location.href+'|'+mathToken,expression:expressions.length===1?expressions[0].replace(/=\s*$/,''):'',operation,fieldCount:fields.length,fieldValue:fields.length===1&&!fields[0].matches('.mq-editable-field')?fields[0].value:null,mathquill:fields[0]?.matches('.mq-editable-field')||false,ordinal:ordinal?Number(ordinal[1]):null,total:ordinal?Number(ordinal[2]):null,accepted,negative,done,controls,items,assignmentCount:document.querySelectorAll('a[href*="/assignment/"]').length,page:page?Number(page[1]):null,pages:page?Number(page[2]):null,isTodo,radioCount:[...document.querySelectorAll('input[type=radio],[role=radio]')].filter(visible).length};
}

export function pageAction(action,expected){
 const visible=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 if(location.href!==expected.url)return {ok:false,error:'STALE_PAGE'};
 const math=Array.from(document.querySelectorAll('annotation[encoding="application/x-tex"],.katex-mathml math')).filter(e=>!e.closest('.mq-editable-field')).map(e=>e.textContent).join('|').slice(0,2000);
 if(expected.token&&expected.token!==location.href+'|'+math)return {ok:false,error:'STALE_PROBLEM'};
 if(action==='FILTER_TODO'){
  const select=[...document.querySelectorAll('select')].find(e=>[...e.options].some(o=>/^to[ -]?do$/i.test(o.textContent.trim())));if(!select)return {ok:false,error:'TODO_FILTER_UNAVAILABLE'};
  const option=[...select.options].find(o=>/^to[ -]?do$/i.test(o.textContent.trim()));select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));return {ok:true};
 }
 const pattern=action==='CHECK'?/^(?:check|check answer|check answers|submit answer)$/i:action==='NEXT_QUESTION'?/^(?:next question|next|continue)$/i:action==='FINISH'?/^(?:done|finish|finish exercise|finish assignment)$/i:action==='START_EXERCISE'?/^(?:start|start exercise|begin practice|let's go)$/i:action==='LIST_NEXT'?/^next$/i:action==='LIST_PREVIOUS'?/^previous$/i:null;
 if(!pattern)return {ok:false,error:'UNKNOWN_ACTION'};
 let root=document;
 if(!action.startsWith('LIST_')){
  const roots=[...document.querySelectorAll('main,[role=main],.perseus-renderer,[data-testid*=question]')].filter(visible);
  root=roots.filter(e=>[...e.querySelectorAll('.mq-editable-field,input:not([type]),input[type=text],input[type=number],textarea')].some(visible)).sort((a,b)=>a.contains(b)?1:b.contains(a)?-1:0)[0]||roots[0]||document;
 }
 const controls=[...root.querySelectorAll('button,a,[role=button]')].filter(e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&pattern.test((e.getAttribute('aria-label')||e.innerText||e.textContent||'').replace(/\s+/g,' ').trim()));
 if(controls.length!==1)return {ok:false,error:'CONTROL_MISSING_OR_AMBIGUOUS'};
 controls[0].click();return {ok:true};
}

export async function mediaStep(rate,muted){
 const allowed=h=>['classroom.khanacademy.org','www.khanacademy.org'].includes(h);
 if(!allowed(location.hostname)&&![...location.ancestorOrigins].some(o=>{try{return allowed(new URL(o).hostname);}catch{return false;}}))return {videos:[]};
 const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const videos=[...document.querySelectorAll('video')].filter(visible);globalThis.__klrOriginalMedia||=new Map();
 const info=[];
 for(const v of videos){
  if(!globalThis.__klrOriginalMedia.has(v))globalThis.__klrOriginalMedia.set(v,{rate:v.playbackRate,muted:v.muted,started:v.paused});
  v.playbackRate=rate;v.muted=muted;let error='';
  if(!v.ended&&v.paused){try{await Promise.race([v.play(),new Promise((_,reject)=>setTimeout(()=>reject(Error('MEDIA_PLAY_TIMEOUT')),2000))]);}catch(e){error=e.name==='NotAllowedError'?'AUTOPLAY_BLOCKED_CLICK_PLAY':e.message==='MEDIA_PLAY_TIMEOUT'?'MEDIA_PLAY_TIMEOUT':'MEDIA_PLAY_FAILED';}}
  info.push({ended:v.ended,time:Number(v.currentTime)||0,duration:Number.isFinite(v.duration)?v.duration:null,rate:v.playbackRate,paused:v.paused,error});
 }
 return {videos:info};
}
export function stopMedia(){for(const [v,old]of globalThis.__klrOriginalMedia||[]){if(old.started)v.pause();v.playbackRate=old.rate;v.muted=old.muted;}globalThis.__klrOriginalMedia?.clear();return {ok:true};}

export function readEditor(){
 const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';const editors=[...document.querySelectorAll('.mq-editable-field')].filter(visible);if(editors.length!==1)return {ok:false};
 const MQ=window.MathQuill?.getInterface?.(2),field=typeof MQ==='function'?MQ(editors[0]):null;
 return field&&typeof field.latex==='function'?{ok:true,latex:field.latex()}:{ok:false};
}
