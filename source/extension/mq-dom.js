// Public DOM keyboard/paste/copy event path, modeled on upstream MathQuill tests.
// No private controller objects, React internals, system clipboard, or debugger access.
export async function mathQuillDOM(action,expected,answer){
 const wait=()=>new Promise(resolve=>setTimeout(resolve,0));
 const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const token=()=>location.href+'|'+Array.from(document.querySelectorAll('annotation[encoding="application/x-tex"],.katex-mathml math,[data-tex],[data-latex],[role=math],script[type="math/tex"],.katex,math')).filter(e=>!e.closest('.mq-editable-field')).map(e=>(e.getAttribute('data-tex')||e.getAttribute('data-latex')||e.getAttribute('aria-label')||e.textContent)+(e.querySelectorAll('sup,msup,mfrac').length?e.innerHTML:'')).join('|').slice(0,2000);
 if(token()!==expected.token)return {ok:false,error:'PAGE_CHANGED_READ_AGAIN'};
 const editors=[...document.querySelectorAll('.mq-editable-field')].filter(visible);
 if(editors.length!==1)return {ok:false,error:'MATHQUILL_EDITOR_AMBIGUOUS'};
 const editor=editors[0],ta=editor.querySelector('textarea'),root=editor.querySelector('.mq-root-block');
 if(!ta||!root)return {ok:false,error:'MATHQUILL_DOM_ADAPTER_UNSUPPORTED'};
 const key=(key,keyCode,ctrlKey=false)=>ta.dispatchEvent(new KeyboardEvent('keydown',{key,code:key==='a'?'KeyA':key,keyCode,which:keyCode,ctrlKey,bubbles:true,cancelable:true}));
 async function read(){
  ta.focus();key('a',65,true);await wait();const event=new Event('copy',{bubbles:true,cancelable:true});
  if(!ta.dispatchEvent(event))return {ok:false,error:'EDITOR_COPY_DISABLED'};
  await wait();const text=ta.value||'',stateless=text.startsWith('$')&&text.endsWith('$');const latex=stateless?text.slice(1,-1):text;
  const rendered=(root.textContent||'').replace(/[\s\u200b-\u200f\ufeff]/g,'');key('ArrowRight',39);
  if(rendered&&!latex)return {ok:false,error:'EDITOR_READBACK_UNAVAILABLE'};
  return {ok:true,latex,stateless};
 }
 const before=await read();if(!before.ok||action==='read')return before;
 if(action!=='insert')return {ok:false,error:'UNKNOWN_EDITOR_ACTION'};
 if(before.latex.trim())return {ok:false,error:'ANSWER_FIELD_NOT_EMPTY'};
 if(token()!==expected.token||!editor.isConnected)return {ok:false,error:'PAGE_CHANGED_READ_AGAIN'};
 ta.focus();const paste=new Event('paste',{bubbles:true,cancelable:true});
 if(!ta.dispatchEvent(paste))return {ok:false,error:'EDITOR_PASTE_DISABLED'};
 // Empty fields have no selection, so real MQ does NOT return '$$' even
 // in statelessClipboard mode. A dollar-delimited paste supports that mode.
 // Plain mode renders the two dollars literally; remove only those verified
 // wrappers from our own insertion through normal public keyboard events.
 const value='$'+answer.latex+'$';
 Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(ta,value);
 ta.dispatchEvent(new Event('input',{bubbles:true}));await wait();await wait();
 if(token()!==expected.token||!editor.isConnected)return {ok:false,error:'PAGE_CHANGED_DURING_ENTRY'};
 let after=await read();if(!after.ok||!after.latex)return {ok:false,error:after.error||'MATHQUILL_ENTRY_NOT_OBSERVED'};
 if(!after.stateless&&after.latex.startsWith('\\$')&&after.latex.endsWith('\\$')){
  const canonical=s=>s.replace(/\\(?:left|right)/g,'').replace(/\\cdot/g,'*').replace(/\s/g,'').replace(/\^\{(\d+)\}/g,'^$1');
  if(canonical(after.latex.slice(2,-2))!==canonical(answer.latex)||token()!==expected.token||!editor.isConnected)return {ok:false,error:'MATHQUILL_ENTRY_CHANGED'};
  key('Home',36,true);key('Delete',46);key('End',35,true);key('Backspace',8);
  await wait();after=await read();
  if(!after.ok||!after.latex)return {ok:false,error:after.error||'MATHQUILL_ENTRY_NOT_OBSERVED'};
 }
 if(token()!==expected.token||!editor.isConnected)return {ok:false,error:'PAGE_CHANGED_DURING_ENTRY'};
 return {ok:true,kind:'mathquill',observed:after.latex,notice:'Answer entered through the editor DOM and read back.'};
}
