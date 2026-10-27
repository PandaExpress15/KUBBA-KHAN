// Injected normal-DOM adapter. No hidden correctness, framework state or APIs.
export function choiceDOM(action='inspect',expected={},selection={}){
 const visible=e=>!!e?.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],[inert]');
 const text=e=>(e?.innerText||e?.textContent||'').trim();
 const irrelevant=e=>!!e.closest('aside,nav,[role=complementary],[role=navigation],[role=search]');
 const roots=[...document.querySelectorAll('main,[role=main],[data-testid*=question],.perseus-renderer')].filter(e=>visible(e)&&!irrelevant(e));
 const root=roots.filter(e=>e.matches('main,[role=main]')).sort((a,b)=>a.contains(b)?1:b.contains(a)?-1:0)[0]||roots[0];
 if(!root)return {ok:false,error:'CHOICE_QUESTION_SCOPE_MISSING'};
 if(expected.url&&location.href!==expected.url)return {ok:false,error:'STALE_PAGE'};
 const groups=[];
 for(const group of root.querySelectorAll('ul[data-widget=radio]')){
  if(!visible(group)||irrelevant(group))continue;
  const legend=group.closest('fieldset')?.querySelector('legend');
  if(!visible(legend)||!/^choose\s+(?:1|one)\s+answer[.:]?(?:\s*Required)?$/i.test(text(legend).replace(/\s+/g,' ')))return {ok:false,error:'CHOICE_SINGLE_ANSWER_REQUIRED'};
  const buttons=[...group.querySelectorAll('li[role=listitem] button[aria-pressed]')].filter(visible);
  groups.push({kind:'perseus-radio',controls:buttons,group});
 }
 const native=[...root.querySelectorAll('input[type=radio]')].filter(e=>visible(e)&&!irrelevant(e)&&!e.closest('ul[data-widget=radio]'));
 const nativeGroups=new Map();
 for(const e of native){const key=e.name?String(e.form?.id||'')+'|'+e.name:e.closest('fieldset,[role=radiogroup]');if(!key)return {ok:false,error:'CHOICE_GROUP_AMBIGUOUS'};if(!nativeGroups.has(key))nativeGroups.set(key,[]);nativeGroups.get(key).push(e);}
 for(const controls of nativeGroups.values())groups.push({kind:'native-radio',controls,group:controls[0].closest('fieldset,[role=radiogroup]')||root});
 for(const group of root.querySelectorAll('[role=radiogroup]')){
  if(!visible(group)||irrelevant(group)||group.querySelector('input[type=radio],ul[data-widget=radio]'))continue;
  groups.push({kind:'aria-radio',controls:[...group.querySelectorAll('[role=radio]')].filter(visible),group});
 }
 if(groups.length!==1)return {ok:false,error:groups.length?'CHOICE_MULTIPLE_GROUPS':'CHOICE_GROUP_MISSING'};
 const {kind,controls,group}=groups[0];
 if(controls.length<2||controls.length>10)return {ok:false,error:'CHOICE_COUNT_UNSUPPORTED'};
 if([...root.querySelectorAll('input[type=checkbox],[role=checkbox]')].some(visible))return {ok:false,error:'CHOICE_MULTIPLE_SELECTION_UNSUPPORTED'};
 if(controls.some(e=>e.disabled||e.matches(':disabled')||e.closest('[aria-disabled=true]')||e.readOnly))return {ok:false,error:'CHOICE_DISABLED'};
 const math=e=>{
  const tag=e.tagName?.toLowerCase(),kids=[...(e.children||[])];
  if(tag==='annotation'||!visible(e))return '';
  if(tag==='input'||tag==='button')return '';
  if(tag==='sup')return '^('+text(e)+')';
  if(tag==='msup'&&kids.length===2)return '('+math(kids[0])+')^('+math(kids[1])+')';
  if(tag==='mfrac'&&kids.length===2)return '('+math(kids[0])+')/('+math(kids[1])+')';
  if(tag==='msqrt')return '\\sqrt{'+kids.map(math).join('')+'}';
  return kids.length?[...e.childNodes].map(n=>n.nodeType===3?n.textContent:math(n)).join(''):text(e);
 };
 const read=e=>{
  const sources=[...(e.matches('annotation[encoding="application/x-tex"],[data-tex],[data-latex],[role=math],.katex,math')?[e]:[]),...e.querySelectorAll('annotation[encoding="application/x-tex"],[data-tex],[data-latex],[role=math],.katex,math')];
  const visibleSources=sources.filter(n=>visible(n.matches('annotation')?n.closest('.katex,.MathJax,[role=math],math')||n.parentElement:n));
  const residue=node=>{
   if(node.nodeType===3)return node.textContent;
   if(!visible(node)||visibleSources.includes(node)||node.matches('input,button'))return '';
   return [...node.childNodes].map(residue).join('');
  };
  if(visibleSources.length&&/[^\s:;,.]/.test(residue(e)))return '';
  const values=visibleSources.map(n=>n.getAttribute('data-tex')||n.getAttribute('data-latex')||(n.matches('[role=math]')?n.getAttribute('aria-label'):null)||n.querySelector('annotation[encoding="application/x-tex"]')?.textContent||(n.matches('annotation')?n.textContent:math(n))).map(s=>s?.trim()).filter(Boolean);

  if(values.some(value=>/\d\s+\d/.test(value)))return '';
  const unique=[...new Set(values.map(s=>s.replace(/\s/g,'').replace(/−/g,'-').replace(/²/g,'^2').replace(/³/g,'^3')))];
  return unique.length===1?unique[0]:unique.length?'':math(e).trim();
 };
 const choices=[];
 for(const [index,e]of controls.entries()){
  let scope;
  if(kind==='perseus-radio'){
   const refs=(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)).filter(n=>n&&n!==e&&!e.contains(n)&&visible(n)&&group.contains(n));
   if(refs.length!==1)return {ok:false,error:'CHOICE_CONTENT_AMBIGUOUS'};scope=refs[0];
  }else if(kind==='native-radio'){
   const labels=[...(e.labels||[])].filter(visible);if(labels.length!==1)return {ok:false,error:'CHOICE_CONTENT_AMBIGUOUS'};scope=labels[0];
  }else scope=e;
  if(scope.querySelector('img,svg,canvas,iframe'))return {ok:false,error:'CHOICE_GRAPH_UNSUPPORTED'};
  const expression=read(scope);if(!expression||expression.length>300)return {ok:false,error:'CHOICE_UNREADABLE_OPTION'};
  choices.push({index,expression});
 }
 if(kind!=='native-radio'&&controls.some(e=>!['true','false'].includes(e.getAttribute(kind==='perseus-radio'?'aria-pressed':'aria-checked'))))return {ok:false,error:'CHOICE_STATE_UNREADABLE'};
 const selected=controls.map((e,i)=>(kind==='native-radio'?e.checked:e.getAttribute(kind==='perseus-radio'?'aria-pressed':'aria-checked')==='true')?i:-1).filter(i=>i>=0);
 const ordinal=text(document.body).match(/\b(?:question\s+)?(\d+)\s*(?:of|\/)\s*(\d+)(?:\s*questions?)?\b/i)?.[0]||'';
 const rootMath=[...root.querySelectorAll('annotation[encoding="application/x-tex"],[data-tex],[data-latex],[role=math],.katex,math')].map(e=>e.getAttribute('data-tex')||e.getAttribute('data-latex')||e.getAttribute('aria-label')||e.textContent);
 const instruction=[...root.querySelectorAll('p,.paragraph,[data-testid*=prompt]')].filter(e=>!group.contains(e)).map(text).join('|');
 const token=location.href+'|'+JSON.stringify({kind,choices,ordinal,rootMath,instruction});
 if(token.length>12000)return {ok:false,error:'CHOICE_SNAPSHOT_LIMIT'};
 if(expected.token&&expected.token!==token)return {ok:false,error:'CHOICE_STALE_CONTENT'};
 if(action==='inspect'||action==='read')return {ok:true,kind,token,choices,selected};
 if(action==='check'){
  if(selected.length!==1||selected[0]!==selection.index)return {ok:false,error:'CHOICE_READBACK_MISMATCH'};
  const name=e=>{const ids=e.getAttribute('aria-labelledby');return (ids?ids.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' '):e.getAttribute('aria-label')||e.getAttribute('title')||text(e)).replace(/\s+/g,' ').trim();};
  const allowed=e=>visible(e)&&!irrelevant(e)&&!e.disabled&&!e.matches(':disabled')&&!e.closest('[aria-disabled=true]')&&/^(check|check answer|check answers|submit answer)$/i.test(name(e));
  let checks=[...root.querySelectorAll('button,[role=button]')].filter(allowed);
  if(!checks.length)checks=[...document.querySelectorAll('button,[role=button]')].filter(allowed);
  if(checks.length!==1)return {ok:false,error:'CONTROL_MISSING_OR_AMBIGUOUS'};
  checks[0].click();return {ok:true};
 }
 if(action!=='select')return {ok:false,error:'CHOICE_UNKNOWN_ACTION'};
 if(selected.length)return {ok:false,error:'ANSWER_FIELD_NOT_EMPTY'};
 if(!Number.isInteger(selection.index)||!controls[selection.index])return {ok:false,error:'CHOICE_INDEX_INVALID'};
 controls[selection.index].click();
 return {ok:true,kind:'choice',index:selection.index,observed:choices[selection.index].expression};
}
