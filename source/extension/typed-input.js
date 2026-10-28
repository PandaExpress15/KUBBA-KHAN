// Self-contained MAIN-world adapter. Paths/guards come only from the public DOM reader.
export async function typedInputDOM(action='fill',expected={},answer={}){
 const touched=[];
 const epoch=expected.actionEpoch??expected.epoch??(globalThis.__kublaTypedStopEpoch||0);
 const fail=code=>{throw Error(code);};
 const at=path=>{if(!Array.isArray(path)||path.length>40||path.some(n=>!Number.isInteger(n)||n<0))return null;let e=document.body;for(const n of path)e=e?.children[n];return e;};
 const visible=e=>!!e?.isConnected&&!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],[inert]');
 const text=e=>String(e?.innerText||e?.textContent||'').replace(/\u200b/g,'').trim();
 const slots=expected.slots,root=at(expected.boundaryPath);
function publicBoundary(root,bindOrdinal=true){
 const visible=e=>!!e?.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],[inert]');
 const text=e=>String(e?.innerText||e?.textContent||'').replace(/\u200b/g,'').trim();
 const choice=e=>!!e.closest('[role=radiogroup],[role=radio],ul[data-widget=radio],[data-widget=radio],label:has(input[type=radio])');
 const ignored=e=>e.matches('script,style,template,noscript,button,[role=button],h1,h2,h3,aside,nav,[role=status],[role=alert],[hidden],[inert],[data-testid*=feedback],.perseus-correctness')||!!e.closest('[role=complementary],[role=navigation],[role=search],[data-testid*=calculator i],[aria-label*=calculator i],[data-testid*=drawing i],[aria-label="Tools" i],[aria-label="Draw" i]');
 const feedback=e=>!choice(e)&&/^(?:correct[!.]?|incorrect[!.]?|not correct[!.]?|well done[!.]?|great job[!.]?|nice work[!.]?|not quite[!.]?|try again[!.]?|wrong answer[!.]?)$/i.test(text(e).replace(/\s+/g,' '));
 const out=[];
 const walk=n=>{if(n.nodeType===3){const s=n.textContent.replace(/\s+/g,' ').trim();if(s)out.push(s);return;}if(n.nodeType!==1||!visible(n)||ignored(n)||feedback(n))return;
  if(n.matches('.mq-editable-field,input,textarea,math-field,[contenteditable=true],[role=textbox]')){out.push('<response>');return;}
  const math=n.matches('.katex,[data-tex],[data-latex],[role=math],math');
  if(math){const ann=n.querySelector('annotation[encoding="application/x-tex"]');out.push('<math>',String(n.getAttribute('data-tex')||n.getAttribute('data-latex')||(ann?text(ann):null)||(n.matches('[role=math]')?n.getAttribute('aria-label'):null)||text(n)),'</math>');return;}
  if(n.matches('canvas,svg')){out.push('<diagram>',n.getAttribute('aria-label')||n.getAttribute('title')||'','</diagram>');return;}
  for(const c of n.childNodes)walk(c);
 };
 walk(root);
 for(const e of [root,...root.querySelectorAll('[aria-labelledby],[aria-describedby]')]){if(!visible(e)||ignored(e))continue;for(const id of ((e.getAttribute('aria-labelledby')||'')+' '+(e.getAttribute('aria-describedby')||'')).split(/\s+/).filter(Boolean)){const ref=document.getElementById(id);if(ref&&!root.contains(ref)&&visible(ref)&&!ignored(ref))out.push('<reference>',id,text(ref).slice(0,1000),'</reference>');}}
 if(bindOrdinal){const ordinal=/\b(?:question\s+)?\d+\s*(?:of|\/)\s*\d+\s*questions?\b|\bquestion\s+\d+\s*(?:of|\/)\s*\d+\b/i;
 const counters=[...document.querySelectorAll('header,[role=heading],h1,h2,h3,[data-testid*=progress],p,span')].filter(visible).map(e=>{const s=text(e),m=s.match(ordinal);return m&&(e.matches('header,[role=heading],h1,h2,h3,[data-testid*=progress]')||s===m[0])?m[0].replace(/\s+/g,' ').toLowerCase():null;}).filter(Boolean);
 out.push('<ordinal>',...new Set(counters),'</ordinal>');}return JSON.stringify(out);
}
 const guard=()=>publicBoundary(root);
 const disabled=e=>!!e?.disabled||!!e?.readOnly||!!e?.closest('[disabled],[aria-disabled=true],[aria-readonly=true]');
 const elements=()=>slots.map(s=>{const e=at(s.path);if(s.disabled||!visible(e)||!root.contains(e)||disabled(e)||s.kind==='mathquill'&&disabled(e.querySelector('textarea')))fail('RESPONSE_DISABLED_OR_CHANGED');if(s.kind==='mathquill'?!e.matches('.mq-editable-field'):!e.matches('input:not([type]),input[type=text],input[type=number],textarea'))fail('RESPONSE_SLOT_CHANGED');return e;});
 const ensure=()=>{if((globalThis.__kublaTypedStopEpoch||0)!==epoch)fail('STOPPED_DURING_TYPED_ACTION');if(location.href!==expected.url||!visible(root)||guard()!==expected.guard)fail('STALE_PROBLEM_DOCUMENT');return elements();};
 const wait=async()=>{await new Promise(r=>setTimeout(r,0));ensure();};
 const signature=e=>{if(!e.matches('.mq-editable-field'))return JSON.stringify([e.tagName,e.type||'',e.value]);const r=e.querySelector('.mq-root-block');if(!r)fail('MATHQUILL_DOM_ADAPTER_UNSUPPORTED');const c=r.cloneNode(true);c.classList.remove('mq-empty');for(const n of c.querySelectorAll('.mq-cursor'))n.remove();for(const n of c.querySelectorAll('.mq-selection'))n.replaceWith(...n.childNodes);for(const n of [c,...c.querySelectorAll('*')]){for(const v of ['mq-hasCursor','mq-focused','mq-blur','mq-selected'])n.classList.remove(v);if(!n.getAttribute('class'))n.removeAttribute('class');}return c.outerHTML;};
 const key=(ta,k,code,ctrl=false)=>{ensure();ta.dispatchEvent(new KeyboardEvent('keydown',{key:k,code:k==='a'?'KeyA':k,keyCode:code,which:code,ctrlKey:ctrl,bubbles:true,cancelable:true}));ensure();};
 async function readMQ(e){
  const ta=e.querySelector('textarea'),r=e.querySelector('.mq-root-block');if(!ta||!r)fail('MATHQUILL_DOM_ADAPTER_UNSUPPORTED');const before=signature(e);ensure();ta.focus();key(ta,'a',65,true);await wait();
  const copy=new Event('copy',{bubbles:true,cancelable:true});ensure();if(!ta.dispatchEvent(copy))fail('EDITOR_COPY_DISABLED');await wait();const copied=ta.value||'',stateless=copied.startsWith('$')&&copied.endsWith('$'),latex=stateless?copied.slice(1,-1):copied;
  key(ta,'ArrowRight',39);ensure();if(signature(e)!==before)fail('EDITOR_CHANGED_DURING_READBACK');if((r.textContent||'').replace(/[\s\u200b-\u200f\ufeff]/g,'')&&!latex)fail('EDITOR_READBACK_UNAVAILABLE');return {value:latex,signature:before,stateless};
 }
 const readAll=async()=>{const fields={},signatures={};for(const s of slots){ensure();const e=at(s.path);if(s.kind==='mathquill'){const r=await readMQ(e);ensure();fields[s.id]=r.value;signatures[s.id]=JSON.stringify({dom:r.signature,value:r.value});}else{fields[s.id]=e.value;signatures[s.id]=JSON.stringify({dom:signature(e),value:e.value});}}ensure();for(const s of slots)if(signature(at(s.path))!==JSON.parse(signatures[s.id]).dom)fail('RESPONSE_CHANGED_DURING_READBACK');return {fields,signatures};};
 const validMap=m=>m&&typeof m==='object'&&!Array.isArray(m)&&Object.keys(m).length===slots.length&&slots.every(s=>typeof m[s.id]==='string'&&m[s.id].length<=8000);
 try{
  if(!['fill','readback','check'].includes(action))fail('UNKNOWN_TYPED_ACTION');
  if(!Array.isArray(slots)||slots.length<1||slots.length>8||new Set(slots.map(s=>s.id)).size!==slots.length||!root||typeof expected.guard!=='string'||!expected.fingerprint)fail('INVALID_TYPED_TARGET');ensure();
  if(action==='check'){
   if(!validMap(answer.fields)||!validMap(answer.signatures))fail('ANSWER_SLOT_MAP_MISMATCH');
   const controls=[...document.querySelectorAll('button,[role=button]')].filter(e=>visible(e)&&!disabled(e)&&!e.closest('aside,nav,[role=complementary],[role=navigation],[role=search]')&&/^(check|check answer|check answers|submit answer)$/i.test(e.getAttribute('aria-label')||text(e)));
   if(controls.length!==1)fail('CHECK_CONTROL_MISSING_OR_AMBIGUOUS');
   // No await from final guard/slot/signature validation through the one click.
   ensure();for(const s of slots){const e=at(s.path);const saved=JSON.parse(answer.signatures[s.id]);if(saved.value!==answer.fields[s.id]||signature(e)!==saved.dom||s.kind!=='mathquill'&&e.value!==answer.fields[s.id])fail('RESPONSE_CHANGED_BEFORE_CHECK');}
   controls[0].click();return {ok:true,clicked:true,epoch,actionEpoch:epoch,fingerprint:expected.fingerprint};
  }
  if(action==='readback'){const r=await readAll();ensure();return {ok:true,...r,observed:r.fields,epoch,actionEpoch:epoch,fingerprint:expected.fingerprint};}
  if(!validMap(answer.fields)||answer.latexFields&&!validMap(answer.latexFields))fail('ANSWER_SLOT_MAP_MISMATCH');
  // Inspect the entire slate before any insertion, including all MQ clipboard reads.
  const before=await readAll();ensure();if(slots.some(s=>before.fields[s.id].trim()))fail('ANSWER_FIELD_NOT_EMPTY');
  for(const s of slots){const e=at(s.path);if(s.kind==='native'&&e.type==='number'&&!/^-?\d+(?:\.\d+)?$/.test(answer.fields[s.id]))fail('NUMBER_FIELD_CANNOT_ACCEPT_SYMBOLIC_ANSWER');}
  for(const s of slots){ensure();const e=at(s.path);if(signature(e)!==JSON.parse(before.signatures[s.id]).dom)fail('RESPONSE_CHANGED_DURING_FILL');
   if(s.kind==='native'){const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,answer.fields[s.id]);touched.push(s.id);e.dispatchEvent(new Event('input',{bubbles:true}));ensure();e.dispatchEvent(new Event('change',{bubbles:true}));await wait();}
   else{
    const ta=e.querySelector('textarea'),latex=(answer.latexFields||answer.fields)[s.id];ensure();ta.focus();const paste=new Event('paste',{bubbles:true,cancelable:true});if(!ta.dispatchEvent(paste))fail('EDITOR_PASTE_DISABLED');ensure();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(ta,'$'+latex+'$');touched.push(s.id);ta.dispatchEvent(new Event('input',{bubbles:true}));await wait();await wait();let after=await readMQ(e);ensure();
    if(!after.stateless&&after.value.startsWith('\\$')&&after.value.endsWith('\\$')){
     const canon=s=>s.replace(/\\(?:left|right)/g,'').replace(/\\cdot/g,'*').replace(/\s/g,'').replace(/\^\{(\d+)\}/g,'^$1');if(canon(after.value.slice(2,-2))!==canon(latex))fail('MATHQUILL_ENTRY_CHANGED');key(ta,'Home',36,true);key(ta,'Delete',46);key(ta,'End',35,true);key(ta,'Backspace',8);await wait();after=await readMQ(e);ensure();
    }
    if(!after.value)fail('MATHQUILL_ENTRY_NOT_OBSERVED');
   }
   // Record only our own new slate value; later slots must still match preflight.
   before.signatures[s.id]=JSON.stringify({dom:signature(at(s.path)),value:''});
  }
  const observed=await readAll();ensure();return {ok:true,...observed,observed:observed.fields,epoch,actionEpoch:epoch,fingerprint:expected.fingerprint};
 }catch(e){return {ok:false,error:/^[A-Z_0-9]+$/.test(e.message)?e.message:'TYPED_DOM_ADAPTER_ERROR',epoch,actionEpoch:epoch,partial:touched.length>0,touched};}
}
