// Runs only following the extension popup's explicit Insert answer action.
// This MAIN-world function is self-contained. It uses public MathQuill API only.
export function insertReviewed(answer,expectedToken){
  const visible=e=>!!(e.getClientRects().length)&&getComputedStyle(e).visibility!=='hidden';
  const token=()=>location.href+'|'+Array.from(document.querySelectorAll('annotation[encoding="application/x-tex"],.katex-mathml math')).filter(e=>!e.closest('.mq-editable-field')).map(e=>e.textContent).join('|').slice(0,2000);
  if(token()!==expectedToken)return {ok:false,error:'PAGE_CHANGED_READ_AGAIN'};
  const editors=[...document.querySelectorAll('.mq-editable-field')].filter(visible);
  const inputs=[...document.querySelectorAll('input:not([type]),input[type=text],input[type=number],textarea')].filter(e=>visible(e)&&!e.disabled&&!e.readOnly&&!e.closest('.mq-editable-field')&&!e.closest('[role=search]')&&!/search/i.test(e.getAttribute('aria-label')||'') );
  if(editors.length+inputs.length!==1)return {ok:false,error:'NEED_EXACTLY_ONE_VISIBLE_ANSWER_FIELD'};
  if(editors.length){
    const MQ=window.MathQuill?.getInterface?.(2);if(typeof MQ!=='function')return {ok:false,error:'MATHQUILL_PUBLIC_API_UNAVAILABLE_COPY_MANUALLY'};
    const field=MQ(editors[0]);if(!field||typeof field.latex!=='function'||typeof field.focus!=='function')return {ok:false,error:'MATHQUILL_EDITOR_UNSUPPORTED'};
    if(field.latex().trim())return {ok:false,error:'ANSWER_FIELD_NOT_EMPTY'};
    field.focus();field.latex(answer.latex);
    const actual=field.latex();if(!actual)return {ok:false,error:'MATHQUILL_ENTRY_NOT_OBSERVED'};
    editors[0].dispatchEvent(new Event('input',{bubbles:true}));editors[0].dispatchEvent(new Event('change',{bubbles:true}));
    return {ok:true,kind:'mathquill',observed:actual,notice:'Inserted only. Review the expression and use Khan Check yourself.'};
  }
  const e=inputs[0];if(e.value.trim())return {ok:false,error:'ANSWER_FIELD_NOT_EMPTY'};
  if(e.type==='number'&&!/^-?\d+(\.\d+)?$/.test(answer.answer))return {ok:false,error:'NUMBER_FIELD_CANNOT_ACCEPT_SYMBOLIC_ANSWER'};
  const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(e,answer.answer);
  e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
  return {ok:e.value===answer.answer,kind:'plain',notice:'Inserted only. Review and use Khan Check yourself.'};
}
