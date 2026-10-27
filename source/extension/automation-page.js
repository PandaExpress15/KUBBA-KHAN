// Self-contained functions injected by the extension. Read visible UI, never private app state.
export function pageSnapshot(){
 const visible=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const text=e=>(e?.innerText||e?.textContent||'').trim();
 const buttonName=e=>{const ids=e.getAttribute('aria-labelledby');const labelled=ids?ids.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim():'';return (labelled||e.getAttribute('aria-label')||[...(e.labels||[])].map(x=>x.textContent).join(' ')||e.getAttribute('title')||e.innerText||e.textContent||'').replace(/\s+/g,' ').trim();};
 const fieldSelector='.mq-editable-field,input:not([type]),input[type=text],input[type=number],textarea';
 const roots=[...document.querySelectorAll('main,[role=main],.perseus-renderer,[data-testid*=question]')].filter(visible);
 // A response renderer can contain only the box. Keep the stem and sibling
 // feedback/footer in their enclosing main rather than selecting that renderer.
 const byDepth=(a,b)=>a.contains(b)?1:b.contains(a)?-1:0;
 const withFields=roots.filter(e=>[...e.querySelectorAll(fieldSelector)].some(visible));
 const mains=withFields.filter(e=>e.matches('main,[role=main]'));
 const root=mains.sort(byDepth)[0]||withFields.filter(e=>!e.matches('.perseus-renderer')).sort(byDepth)[0]||withFields.sort((a,b)=>-byDepth(a,b))[0]||roots[0]||document;
 const irrelevant=e=>!!e.closest('aside,nav,[role=complementary],[role=navigation],[hidden],[inert]');
 const detached=[...document.querySelectorAll('footer,[role=toolbar],[data-testid*=footer]')].filter(e=>!root.contains(e)&&visible(e)&&!irrelevant(e)&&[...e.querySelectorAll('button,[role=button]')].some(b=>visible(b)&&/^(check|check answer|check answers|submit answer|(?:go to (?:the )?)?next(?: question)?|continue|done|finish|finish exercise|finish assignment)$/i.test(buttonName(b))));
 const footer=detached.filter(e=>!detached.some(other=>other!==e&&e.contains(other)));
 let controls=[...root.querySelectorAll('button,a,[role=button]')].filter(e=>visible(e)&&!irrelevant(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true').map(e=>buttonName(e));
 if(!controls.some(s=>/^(check|check answer|check answers|submit answer)$/i.test(s))){const outsideRoot=footer.length===1?footer[0]:document;const outside=[...outsideRoot.querySelectorAll('button,[role=button]')].filter(e=>visible(e)&&!irrelevant(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true').map(buttonName).filter(s=>/^(check|check answer|check answers|submit answer|(?:go to (?:the )?)?next question|done|finish|finish exercise|finish assignment)$/i.test(s.trim())||(outsideRoot!==document&&/^(next|continue)$/i.test(s.trim())));if(outside.length===1)controls.push(outside[0]);}
 const nextPattern=/^(?:(?:go to (?:the )?)?next(?: question)?|continue)$/i;
 const finishPattern=/^(?:done|finish|finish exercise|finish assignment)$/i;
 const externalProgress=[...document.querySelectorAll('button,[role=button]')].filter(e=>!root.contains(e)&&visible(e)&&!irrelevant(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&(nextPattern.test(buttonName(e))||finishPattern.test(buttonName(e))));
 if(!controls.some(n=>nextPattern.test(n)||finishPattern.test(n))&&externalProgress.length===1)controls.push(buttonName(externalProgress[0]));
 const raw=[...root.querySelectorAll(fieldSelector)];
 const fields=raw.filter(e=>visible(e)&&!irrelevant(e)&&!e.disabled&&!e.readOnly&&!(e.matches('input,textarea')&&e.closest('.mq-editable-field'))&&!e.closest('[role=search]')&&!/search|message|chat/i.test(e.getAttribute('aria-label')||''));
 const anns=[...root.querySelectorAll('annotation[encoding="application/x-tex"]')].filter(e=>!e.closest('.mq-editable-field')&&!irrelevant(e)&&visible(e.closest('.katex,.MathJax,[role=math]')||e.closest('math')||e.parentElement||e));
 // A printed '=' or 'x =' next to an answer box is a label, not a second
 // problem. Every other distinct expression remains an ambiguity.
 const labels=s=>/^(?:[a-z](?:\([a-z]\))?)?\s*=\s*$/i.test(s.replace(/\\(?:left|right)/g,''));
 const readMath=e=>{
  const tag=e.tagName?.toLowerCase(),children=[...(e.children||[])];
  if(tag==='annotation')return '';
  if(tag==='msup'&&children.length===2)return '('+readMath(children[0])+')^('+readMath(children[1])+')';
  if(tag==='mfrac'&&children.length===2)return '('+readMath(children[0])+')/('+readMath(children[1])+')';
  if(tag==='msqrt')return '\\sqrt{'+children.map(readMath).join('')+'}';
  if(tag==='sup')return '^('+text(e)+')';
  return children.length?[...e.childNodes].map(n=>n.nodeType===3?n.textContent:readMath(n)).join(''):text(e);
 };
 const extra=[...root.querySelectorAll('[data-tex],[data-latex],[role=math],script[type="math/tex"],.katex,math')].filter(e=>!e.closest('.mq-editable-field')&&!irrelevant(e)&&!e.querySelectorAll('annotation[encoding="application/x-tex"]').length&&(visible(e)||e.matches('script[type="math/tex"]')&&visible(e.previousElementSibling)));
 const fallback=extra.map(e=>e.getAttribute('data-tex')||e.getAttribute('data-latex')||(e.matches('[role=math]')?e.getAttribute('aria-label'):null)||readMath(e)).map(s=>s.trim()).filter(s=>s&&!labels(s));
 const normalizeMath=s=>s.replace(/\s/g,'').replace(/−/g,'-').replace(/²/g,'^2').replace(/³/g,'^3').replace(/\^\((\d+)\)/g,'^$1').replace(/\(([a-z])\)/g,'$1');
 const expressions=[...new Set([...anns.map(e=>text(e)),...fallback].filter(s=>s&&!labels(s)).map(normalizeMath))];
 const mathToken=Array.from(document.querySelectorAll('annotation[encoding="application/x-tex"],.katex-mathml math,[data-tex],[data-latex],[role=math],script[type="math/tex"],.katex,math')).filter(e=>!e.closest('.mq-editable-field')).map(e=>(e.getAttribute('data-tex')||e.getAttribute('data-latex')||e.getAttribute('aria-label')||e.textContent)+(e.querySelectorAll('sup,msup,mfrac').length?e.innerHTML:'')).join('|').slice(0,2000);
 const body=text(document.body);const prompt=root===document?'':text(root);
 const ordinal=body.match(/\b(\d+)\s*(?:of|\/)\s*(\d+)\s*questions?\b/i)||body.match(/\bquestion\s+(\d+)\s*(?:of|\/)\s*(\d+)\b/i);
 const mode=s=>/^\s*(?:please\s+)?factor(?:ize|ise|ing)?\b/i.test(s)?'factor':/^\s*(?:please\s+)?expand\b/i.test(s)?'expand':/^\s*(?:please\s+)?solve\b/i.test(s)?'equation':/^\s*(?:please\s+)?(?:evaluate|calculate|find (?:the )?(?:exact )?value|what is (?:the )?(?:exact )?value)\b/i.test(s)?'evaluate':/^\s*(?:please\s+)?(?:simplify|combine like|reduce (?:the |this )?rational)\b/i.test(s)?'simplify':null;
 const instructions=[...root.querySelectorAll('p,.paragraph,[data-testid*=prompt]')].filter(e=>visible(e)&&!irrelevant(e)&&!e.closest('.mq-editable-field')).map(e=>mode(text(e))).filter(Boolean);
 const modes=[...new Set(instructions)];
 // Paragraph directives take priority over an assignment title. If a simple
 // fixture/accessible renderer has no paragraphs, accept its opening directive.
 const operation=modes.length===1?modes[0]:modes.length>1?null:(!root.querySelectorAll('h1,h2,h3').length?mode(prompt):null)||(expressions.length===1&&/^(?:\\)?(?:sin|cos|tan)\s*(?:\\left)?\(/.test(expressions[0])?'evaluate':null);
 const semanticFeedback=[...root.querySelectorAll('[role=status],[role=alert],[data-testid*=feedback],.perseus-correctness'),...(footer.length===1?[...footer[0].querySelectorAll('[role=status],[role=alert],[data-testid*=feedback],.perseus-correctness')]:[])].filter(e=>visible(e)&&!irrelevant(e));
 // Visual correctness banners need not expose an ARIA role or test identifier.
 // Read only exact messages inside the active problem, never arbitrary body text.
 const positiveText=/^(?:correct[!.]?|well done[!.]?|great job[!.]?|nice work[!.]?)$/i;
 const negativeText=/^(?:incorrect[!.]?|not correct[!.]?|not quite[!.]?|try again[!.]?|wrong answer[!.]?)$/i;
 const visualFeedback=[...root.querySelectorAll('div,span,p')].filter(e=>visible(e)&&!irrelevant(e)&&!e.closest('header,h1,h2,h3,.mq-editable-field,[role=search]')&&(positiveText.test(text(e).replace(/\s+/g,' '))||negativeText.test(text(e).replace(/\s+/g,' '))));
 const feedbackNodes=root===document?[]:[...new Set([...semanticFeedback,...visualFeedback])];
 const feedback=feedbackNodes.map(text).join(' ');
 const negative=/\bincorrect\b|not correct|not quite|try again|wrong answer/i.test(feedback);
 const hasCheck=controls.some(s=>/^(check|check answer|check answers|submit answer)$/i.test(s));
 const accepted=!negative&&!hasCheck&&/\bcorrect[!.]?\b|well done|great job|nice work/i.test(feedback);
 const completion=/^(?:(?:exercise|assignment|practice|activity)\s+(?:is\s+)?complete[d]?|you(?:'ve| have)? (?:successfully )?(?:finished|completed) (?:this|the) (?:exercise|assignment|practice|activity))(?:[.!]|$)/i;
 const done=!hasCheck&&!fields.length&&[...root.querySelectorAll('p,h1,h2,h3,[role=status],[role=alert],[data-testid*=completion]')].filter(e=>visible(e)&&!irrelevant(e)).some(e=>completion.test(text(e)));
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
 return {probe:{feedbackCandidates:feedbackNodes.length,semanticFeedbackCandidates:semanticFeedback.length,visualFeedbackCandidates:visualFeedback.length,positiveFeedback:accepted,negativeFeedback:negative,nextCandidates:externalProgress.filter(e=>nextPattern.test(buttonName(e))).length,progressionNameSources:[...new Set(externalProgress.map(e=>e.getAttribute('aria-labelledby')?'labelledby':e.getAttribute('aria-label')?'aria-label':e.getAttribute('title')?'title':e.labels?.length?'label':'text'))],fields:fields.length,mathAnnotations:anns.length,publicMathCandidates:extra.length,expressions:expressions.length,answerLabels:anns.filter(e=>labels(text(e))).length,operation:operation||'unknown',checkControls:controls.filter(s=>/^(check|check answer|check answers|submit answer)$/i.test(s)).length,scope:root===document?'document':root.matches('main,[role=main]')?'main':'question',readState:!expressions.length?'NO_QUESTION_MATH':expressions.length>1?'MULTIPLE_QUESTION_EXPRESSIONS':!operation?'QUESTION_OPERATION_UNCLEAR':'READY'},url:location.href,token:location.href+'|'+mathToken,expression:expressions.length===1?expressions[0].replace(/=\s*$/,''):'',operation,fieldCount:fields.length,fieldValue:fields.length===1&&!fields[0].matches('.mq-editable-field')?fields[0].value:null,mathquill:fields[0]?.matches('.mq-editable-field')||false,ordinal:ordinal?Number(ordinal[1]):null,total:ordinal?Number(ordinal[2]):null,accepted,negative,done,controls,items,assignmentCount:document.querySelectorAll('a[href*="/assignment/"]').length,page:page?Number(page[1]):null,pages:page?Number(page[2]):null,isTodo,radioCount:[...document.querySelectorAll('input[type=radio],[role=radio]')].filter(visible).length};
}

export function pageAction(action,expected){
 const buttonName=e=>{const ids=e.getAttribute('aria-labelledby');const labelled=ids?ids.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim():'';return (labelled||e.getAttribute('aria-label')||[...(e.labels||[])].map(x=>x.textContent).join(' ')||e.getAttribute('title')||e.innerText||e.textContent||'').replace(/\s+/g,' ').trim();};
 const visible=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 if(location.href!==expected.url)return {ok:false,error:'STALE_PAGE'};
 const math=Array.from(document.querySelectorAll('annotation[encoding="application/x-tex"],.katex-mathml math,[data-tex],[data-latex],[role=math],script[type="math/tex"],.katex,math')).filter(e=>!e.closest('.mq-editable-field')).map(e=>(e.getAttribute('data-tex')||e.getAttribute('data-latex')||e.getAttribute('aria-label')||e.textContent)+(e.querySelectorAll('sup,msup,mfrac').length?e.innerHTML:'')).join('|').slice(0,2000);
 if(expected.token&&expected.token!==location.href+'|'+math)return {ok:false,error:'STALE_PROBLEM'};
 if(action==='FILTER_TODO'){
  const select=[...document.querySelectorAll('select')].find(e=>[...e.options].some(o=>/^to[ -]?do$/i.test(o.textContent.trim())));if(!select)return {ok:false,error:'TODO_FILTER_UNAVAILABLE'};
  const option=[...select.options].find(o=>/^to[ -]?do$/i.test(o.textContent.trim()));select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));return {ok:true};
 }
 const pattern=action==='CHECK'?/^(?:check|check answer|check answers|submit answer)$/i:action==='NEXT_QUESTION'?/^(?:(?:go to (?:the )?)?next(?: question)?|continue)$/i:action==='FINISH'?/^(?:done|finish|finish exercise|finish assignment)$/i:action==='START_EXERCISE'?/^(?:start|start exercise|begin practice|let's go)$/i:action==='LIST_NEXT'?/^next$/i:action==='LIST_PREVIOUS'?/^previous$/i:null;
 if(!pattern)return {ok:false,error:'UNKNOWN_ACTION'};
 let root=document;
 if(!action.startsWith('LIST_')){
  const roots=[...document.querySelectorAll('main,[role=main],.perseus-renderer,[data-testid*=question]')].filter(visible);
  const withFields=roots.filter(e=>[...e.querySelectorAll('.mq-editable-field,input:not([type]),input[type=text],input[type=number],textarea')].some(visible));
  const depth=(a,b)=>a.contains(b)?1:b.contains(a)?-1:0;
  root=withFields.filter(e=>e.matches('main,[role=main]')).sort(depth)[0]||withFields.filter(e=>!e.matches('.perseus-renderer')).sort(depth)[0]||withFields.sort((a,b)=>-depth(a,b))[0]||roots[0]||document;
 }
 let controls=[...root.querySelectorAll('button,a,[role=button]')].filter(e=>visible(e)&&!e.closest('aside,nav,[role=complementary],[role=navigation],[hidden],[inert]')&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&pattern.test(buttonName(e)));
 const regions=[...(root!==document&&!controls.length?document.querySelectorAll('footer,[role=toolbar],[data-testid*=footer]'):[])].filter(e=>!root.contains(e)&&visible(e)&&!e.closest('aside,nav,[role=complementary],[role=navigation],[hidden],[inert]')&&[...e.querySelectorAll('button,[role=button]')].some(b=>visible(b)&&pattern.test(buttonName(b))));
 const scoped=regions.filter(e=>!regions.some(other=>other!==e&&e.contains(other)));
 const fallbackRoot=scoped.length===1?scoped[0]:action==='CHECK'?document:null;
 if(!controls.length&&root!==document&&fallbackRoot)controls=[...fallbackRoot.querySelectorAll('button,[role=button]')].filter(e=>visible(e)&&!e.closest('aside,nav,[role=complementary],[role=navigation],[hidden],[inert]')&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&pattern.test(buttonName(e)));
 if(!controls.length&&root!==document&&['NEXT_QUESTION','FINISH'].includes(action)&&expected.accepted===true)controls=[...document.querySelectorAll('button,[role=button]')].filter(e=>visible(e)&&!e.closest('aside,nav,[role=complementary],[role=navigation],[hidden],[inert]')&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&pattern.test(buttonName(e)));
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
