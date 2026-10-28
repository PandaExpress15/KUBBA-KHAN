// Explicit owner export only: no URL, DOM path, current answer or selected option.
export function questionSample(document,probe={}){
 const clean=s=>String(s||'').replace(/https?:\/\/\S+|\/learner\/class\/\S+/g,'[link]').slice(0,7000);
 const graph=document.evidence.graph.interactiveResponse?{interactiveResponse:true,relevant:document.evidence.graph.relevant,labelsOmitted:true}:document.evidence.graph;
 return {schema:'kubla-question-sample-v1',original:{instruction:clean(document.original.instruction),text:clean(document.original.text),expressions:document.original.expressions.map(e=>({source:e.source,text:clean(e.text)})),ordinal:document.original.ordinal,total:document.original.total},task:document.evidence.graph.interactiveResponse?null:document.task,response:{kind:document.response.kind,slots:document.response.slots.map(s=>({id:s.id,role:s.role,kind:s.kind,label:clean(s.label),disabled:s.disabled,hasExistingWork:!!s.value.trim()})),choices:document.response.choices.map(({index,expression,text})=>({index,expression:clean(expression),text:clean(text)})),hasExistingSelection:document.response.choices.some(c=>c.selected)},evidence:{...document.evidence,graph},notation:document.notation,probe};
}
export function publicWidgetInventory(){
 const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],[inert],aside,nav,[role=complementary],[role=navigation]');
 const root=[...document.querySelectorAll('[data-testid=question],main,[role=main]')].find(visible);if(!root)return {root:false,counts:{},controls:[]};
 const selectors={mathField:'math-field',textbox:'[role=textbox]',contenteditable:'[contenteditable=true]',iframe:'iframe',mathquill:'.mq-editable-field',native:'input:not([type]),input[type=text],input[type=number],textarea'};
 const counts=Object.fromEntries(Object.entries(selectors).map(([key,selector])=>[key,[...root.querySelectorAll(selector)].filter(visible).length]));
 const controls=[...root.querySelectorAll('math-field,[role=textbox],[contenteditable=true],.mq-editable-field,input:not([type]),input[type=text],input[type=number],textarea')].filter(visible).slice(0,30).map(e=>({tag:e.tagName.toLowerCase(),role:e.getAttribute('role')==='textbox'?'textbox':e.matches('.mq-editable-field')?'mathquill':null,disabled:!!e.disabled||e.getAttribute('aria-disabled')==='true',readonly:!!e.readOnly,labelSource:e.getAttribute('aria-labelledby')?'aria-labelledby':e.getAttribute('aria-label')?'aria-label':e.labels?.length?'label':e.getAttribute('title')?'title':'none'}));return {root:true,counts,controls};
}
