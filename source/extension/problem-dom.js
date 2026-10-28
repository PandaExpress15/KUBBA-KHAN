// Shared guard algorithm; copied verbatim inside injected reader below.
export function publicBoundary(root,bindOrdinal=true){
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

// Self-contained public-DOM reader and guarded response actions. Read is inert.
export async function readProblemDOM(action='read',expected={},answer={}){
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
 function inspectChoiceDOM(){const action='inspect',expected={};

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
 return {ok:true,kind,token,choices,selected};
 }
 const cancelled=()=>action!=='read'&&expected.actionEpoch!==undefined&&globalThis.__kublaTypedStopEpoch!==expected.actionEpoch;
 const visible=e=>!!e?.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],[inert]');
 const text=e=>String(e?.innerText||e?.textContent||'').replace(/\u200b/g,'').trim();
 const name=e=>{const ids=e.getAttribute('aria-labelledby');return (ids?ids.split(/\s+/).map(id=>text(document.getElementById(id))).join(' '):'')||e.getAttribute('aria-label')||[...(e.labels||[])].map(text).join(' ')||e.getAttribute('title')||text(e);};
 const irrelevant=e=>!!e.closest('aside,nav,[role=complementary],[role=navigation],[role=search],[data-testid*=calculator i],[aria-label*=calculator i],[data-testid*=drawing i],[aria-label="Draw" i],[aria-label="Tools" i],[aria-label="Lessons" i]');
 const fieldSelector='.mq-editable-field,input:not([type]),input[type=text],input[type=number],textarea';
 const fieldOK=e=>visible(e)&&!irrelevant(e)&&!(e.matches('input,textarea')&&e.closest('.mq-editable-field'))&&!/\b(search|calculator|chat|message)\b/i.test(name(e));
 const candidates=[...document.querySelectorAll('[data-testid=question],main,[role=main],.perseus-renderer')].filter(e=>visible(e)&&!irrelevant(e));
 const mains=candidates.filter(e=>e.matches('main,[role=main]')&&[...e.querySelectorAll(fieldSelector+',input[type=radio],[role=radio],ul[data-widget=radio]')].some(e=>visible(e)&&!irrelevant(e)));
 const root=mains.find(e=>!mains.some(m=>m!==e&&e.contains(m)))||candidates.find(e=>e.matches('[data-testid=question]'))||candidates.find(e=>e.matches('main,[role=main]'))||candidates[0];
 if(!root)return {ok:false,error:'QUESTION_BOUNDARY_NOT_FOUND',probe:{stage:'extraction',root:0}};
 const choiceArea=e=>!!e.closest('[role=radiogroup],[role=radio],ul[data-widget=radio],[data-widget=radio]')||!!e.closest('label')?.querySelector('input[type=radio]')||!!(e.closest('label')?.htmlFor&&document.getElementById(e.closest('label').htmlFor)?.matches('input[type=radio]'));
 const fields=[...root.querySelectorAll(fieldSelector)].filter(fieldOK).slice(0,9);
 if(fields.length>8)return {ok:false,error:'RESPONSE_SLOT_LIMIT',probe:{stage:'response',slots:fields.length}};
 const path=e=>{const out=[];for(let n=e;n&&n!==document.body;n=n.parentElement){if(!n.parentElement)return [];out.unshift([...n.parentElement.children].indexOf(n));if(out.length>40)return [];}return out;};
 const at=p=>{let e=document.body;for(const n of p)e=e?.children[n];return e;};
 const readMath=e=>{
  const tag=e.tagName?.toLowerCase(),c=[...e.children];if(e.matches('input,textarea,.mq-editable-field'))return '□';
  if(tag==='annotation')return text(e);if(tag==='msup'&&c.length===2)return '('+readMath(c[0])+')^('+readMath(c[1])+')';
  if(tag==='msub'&&c.length===2)return readMath(c[0])+'_{'+readMath(c[1])+'}';
  if(tag==='mfrac'&&c.length===2)return '('+readMath(c[0])+')/('+readMath(c[1])+')';
  if(tag==='msqrt')return '\\sqrt{'+c.map(readMath).join('')+'}';if(tag==='sup')return '^('+text(e)+')';
  return c.length?[...e.childNodes].map(n=>n.nodeType===3?n.textContent:readMath(n)).join(''):text(e);
 };
 const mathNodes=[...root.querySelectorAll('.katex,[data-tex],[data-latex],[role=math],math,script[type="math/tex"],annotation[encoding="application/x-tex"]')].filter(e=>!irrelevant(e)&&!choiceArea(e)&&!e.closest('.mq-editable-field')&&(visible(e)||e.matches('annotation,script')&&visible(e.parentElement)));
 const topMath=mathNodes.filter(e=>!mathNodes.some(p=>p!==e&&p.contains(e)));
 const expressions=topMath.map(e=>{const ann=e.matches('annotation')?e:e.querySelector('annotation[encoding="application/x-tex"]');const source=e.hasAttribute('data-tex')?'data-tex':e.hasAttribute('data-latex')?'data-latex':ann?'tex':e.matches('[role=math]')&&e.getAttribute('aria-label')?'aria-math':'rendered-math';return {source,text:String(e.getAttribute('data-tex')||e.getAttribute('data-latex')||(ann?text(ann):null)||(e.matches('[role=math]')?e.getAttribute('aria-label'):null)||readMath(e)).trim()};}).filter(e=>e.text&&e.text.length<=600).slice(0,24);
 const paragraphs=[...root.querySelectorAll('p,.paragraph,[data-testid*=prompt],legend')].filter(e=>visible(e)&&!irrelevant(e)&&!choiceArea(e)&&!e.closest('.mq-editable-field')&&!e.matches('[role=status],[role=alert],[data-testid*=feedback]')&&!/^(correct|incorrect|well done|try again)[!.]?$/i.test(text(e)));
 const directive=/\b(factor|simplify|expand|evaluate|calculate|solve|complete (?:the )?square|completing (?:the )?square|divide|quotient|remainder|point.slope|slope|rate of change|inverse|logarithm|rational exponent|equation)\b/i;
 const instructions=paragraphs.filter(e=>directive.test(text(e))||/\b(degrees|radians|nearest|round|decimal|base\s*\d|common logarithm|natural logarithm)\b/i.test(text(e)));
 const cleanText=e=>JSON.parse(publicBoundary(e,false)).join(' ');
 const instruction=paragraphs.filter(e=>!paragraphs.some(p=>p!==e&&e.contains(p))).map(cleanText).filter(Boolean).join('\n').slice(0,3000);
 const stripFeedback=c=>{for(const e of [...c.querySelectorAll('div,span,p')].reverse())if(!choiceArea(e)&&/^(?:correct[!.]?|incorrect[!.]?|not correct[!.]?|well done[!.]?|great job[!.]?|nice work[!.]?|not quite[!.]?|try again[!.]?|wrong answer[!.]?)$/i.test(text(e).replace(/\s+/g,' ')))e.remove();return c;};
 const originalText=JSON.parse(publicBoundary(root,false)).join(' ').slice(0,7000);
 const ordinal=[...document.querySelectorAll('header,[role=heading],h1,h2,h3,[data-testid*=progress],p,span')].filter(visible).map(e=>{const s=text(e),m=s.match(/\b(\d+)\s*(?:of|\/)\s*(\d+)\s*questions?\b|\bquestion\s+(\d+)\s*(?:of|\/)\s*(\d+)/i);return m&&(e.matches('header,[role=heading],h1,h2,h3,[data-testid*=progress]')||s===m[0])?m:null;}).find(Boolean);
 const choiceNodes=[...root.querySelectorAll('input[type=radio],[role=radio],ul[data-widget=radio] button[aria-pressed]')].filter(e=>visible(e)&&!irrelevant(e));
 const choiceInspection=choiceNodes.length?inspectChoiceDOM():{ok:false,error:'CHOICE_GROUP_MISSING'};
 const visibleChoiceText=e=>JSON.parse(publicBoundary(e,false)).join(' ').slice(0,1500);
 const choices=choiceInspection.ok?choiceInspection.choices.map(c=>({...c,text:c.expression,selected:choiceInspection.selected.includes(c.index)})):choiceNodes.slice(0,12).map((e,index)=>{let scope=e;if(e.matches('input[type=radio]'))scope=[...(e.labels||[])].find(visible)||e.parentElement;else if(e.closest('ul[data-widget=radio]')){const group=e.closest('ul[data-widget=radio]');const refs=(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)).filter(n=>n&&n!==e&&!e.contains(n)&&visible(n)&&group.contains(n));scope=refs.length===1?refs[0]:e.closest('li')||e;}return {index,text:visibleChoiceText(scope),expression:'',selected:e.checked===true||e.getAttribute('aria-checked')==='true'||e.getAttribute('aria-pressed')==='true'};});
 let tables=[...root.querySelectorAll('table')].filter(e=>visible(e)&&!irrelevant(e)&&!e.querySelector('input,textarea')).slice(0,5).map(e=>({headers:[...e.querySelectorAll('tr:first-child th,tr:first-child td')].map(text).slice(0,8),rows:[...e.querySelectorAll('tr')].slice(1,22).map(r=>[...r.querySelectorAll('th,td')].map(text).slice(0,8))}));
 tables=tables.map(t=>({...t,...(t.headers.length===2&&/^x$/i.test(t.headers[0])&&/^(?:y|[a-z]\s*\(\s*x\s*\))$/i.test(t.headers[1])&&t.rows.length>=2&&t.rows.every(r=>r.length===2&&r.every(v=>/^-?\d+(?:\.\d+)?$/.test(v)))?{points:t.rows.map(r=>r.slice()),exact:true}:{})}));
 const graphNodes=[...root.querySelectorAll('canvas,svg,[data-testid*=graph],[aria-label*=graph i]')].filter(e=>visible(e)&&!irrelevant(e)&&!e.closest('.mq-editable-field,.katex,math'));
 const interactiveGraphs=graphNodes.filter(e=>/graph (?:answer|response)|plot (?:points|the)|interactive graph|graphie/i.test(name(e)+' '+e.getAttribute('data-testid'))&&(e.matches('[tabindex],[role=application]')||e.querySelector('[tabindex],button,input')));
 let graph={relevant:graphNodes.some(e=>/\b(graph|coordinate|axis|axes|plot|diagram)\b/i.test(name(e)))&&/\b(graph|coordinate|plot|diagram|shown|figure)\b/i.test(instruction),interactiveResponse:interactiveGraphs.length>0,labels:graphNodes.map(name).filter(Boolean).slice(0,8).map(s=>s.slice(0,400)),incidentalCount:graphNodes.length-interactiveGraphs.length};
 const labelledPointSources=graphNodes.map(e=>({label:name(e),source:e.hasAttribute('aria-label')||e.hasAttribute('aria-labelledby')?'accessible':'dom-labels'})).filter(v=>/\bpoints?\b/i.test(v.label));
 const anchored=labelledPointSources.map(v=>({...v,points:[...v.label.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)].map(m=>[m[1],m[2]])})).filter(v=>v.points.length>=2&&v.points.length<=20);
 if(anchored.length===1)graph={...graph,relevant:true,points:anchored[0].points,exact:true,source:anchored[0].source};
 const complete=/\bcomplete (?:the )?square|\bcompleting (?:the )?square|\brewrite[^.]*\bcompleted.square\b/i.test(instruction);
 const division=/\bdivide|\bquotient|\bremainder/i.test(instruction);
 const slots=fields.map((e,index)=>{const label=String((e.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>text(document.getElementById(id))).join(' ')||e.getAttribute('aria-label')||[...(e.labels||[])].map(text).join(' ')||e.getAttribute('title')||'').slice(0,300);let role=fields.length===1?'answer':'unknown';if(complete){if(/\bshift\b|\binside\b|\badditive shift\b/i.test(label))role='shift';if(/\bconstant\b|\boutside\b|\bconstant term\b/i.test(label))role='constant';if(/\bcoefficient\b|\bleading multiplier\b/i.test(label))role='coefficient';}if(division){if(/\bquotient\b/i.test(label))role='quotient';if(/\bremainder\b/i.test(label))role='remainder';}let value=e.matches('.mq-editable-field')?text(e.querySelector('.mq-root-block')||e):String(e.value||'');try{const MQ=window.MathQuill?.getInterface?.(2),field=typeof MQ==='function'?MQ(e):null;if(e.matches('.mq-editable-field')&&field?.latex)value=field.latex();}catch{}return {id:'s'+index,role,kind:e.matches('.mq-editable-field')?'mathquill':'native',label,path:path(e),value:value.slice(0,4000),disabled:!!e.disabled||!!e.readOnly||e.getAttribute('aria-disabled')==='true'};});
 // The public formula, not the labels alone, establishes each blank's sign.
 let completeTemplate=null;
 const form=s=>s.replace(/\\(?:left|right)/g,'').replace(/[{}]/g,'').replace(/\s/g,'');
 const responseForms=expressions.filter(e=>/\([a-z][+−-](?:h|k|shift|vertex)\)\^\(?2\)?/.test(form(e.text)));
 if(complete&&slots.length===2){
  const templates=[...root.querySelectorAll('p,span,div,math')].filter(e=>fields.filter(f=>e.contains(f)).length===2&&!irrelevant(e));
  const matching=templates.filter(e=>/\(\s*[a-z]\s*[+−-]\s*□\s*\)\s*(?:\^\s*\(?2\)?|²)\s*\+\s*□/.test(readMath(e))).sort((a,b)=>a.contains(b)?1:b.contains(a)?-1:0);const template=matching[0];
  const rendered=template?readMath(template):responseForms[0]?.text;
  if(rendered){const minus=/\(\s*[a-z]\s*[−-]/.test(form(rendered));slots[0].role=minus?'vertex':'shift';slots[1].role='constant';const normalized=form(rendered),variable=(normalized.match(/\(([a-z])[+−-]/)||[])[1]||'x',coefficient=normalized.match(/(?:^|=)(-?\d+(?:\/\d+)?)(?:\*|\\cdot)?\([a-z][+−-]□/);completeTemplate=(coefficient?coefficient[1]+'*':'')+'('+variable+(minus?'-':'+')+'{s0})^2+{s1}';slots[0].template=slots[1].template=completeTemplate;}
 }
 const mixedNumber=expressions.some(e=>/\d\s+\d|\d\s*(?:\\[,!;: ]\s*)*\\(?:d?frac)\s*\{\s*\d+\s*\}\s*\{\s*\d+\s*\}/.test(e.text));
 const angleUnit=/\bdegrees\b|°/i.test(instruction+' '+expressions.map(e=>e.text).join(' '))?'degrees':/\bradians\b/i.test(instruction)?'radians':null;
 const explicitBase=instruction.match(/\bbase\s*(\d+)\b/i)||expressions.map(e=>e.text).join(' ').match(/\\?log_\{?(\d+)\}?/);
 const bareLog=expressions.some(e=>/\\?log\b(?!\s*_)/.test(e.text));
 const logConvention=location.protocol==='https:'&&['classroom.khanacademy.org','www.khanacademy.org'].includes(location.hostname)&&bareLog?'khan-kas-common':null;
 const logBase=logConvention==='khan-kas-common'?10:explicitBase?Number(explicitBase[1]):/\bnatural (?:log|logarithm)\b|\\ln\b|\bln\s*\(/i.test(instruction+' '+expressions.map(e=>e.text).join(' '))?'e':/\bcommon (?:log|logarithm)\b/i.test(instruction)?10:null;
 const pureExpressions=expressions.filter(e=>!responseForms.includes(e)&&!/[□]/.test(e.text)&&!/^\s*(?:[a-z](?:\([a-z]\))?)?\s*=\s*$/i.test(e.text));
 const inverseTrig=/\binverse\s+(?:trigonometric|sine|cosine|tangent|secant|cosecant|cotangent)/i.test(instruction)||expressions.some(e=>/(?:\\)?(?:asin|acos|atan|arcsin|arccos|arctan)\b|\b(?:sin|cos|tan)\s*\^\s*\{?\s*-1\s*\}?/i.test(e.text));
 let type=null;if(/\binverse\b/i.test(instruction)&&!inverseTrig||expressions.some(e=>/\b[a-z]\s*\^\s*\{?\s*-1\s*\}?\s*\(/i.test(e.text)))type=tables.some(t=>t.exact)?'inverse-table':'inverse-affine';else if(/\bfirst\b[^.]{0,80}\b(?:incorrect|invalid|mistake|error)\b[^.]{0,80}\bstep\b|\bfirst\b[^.]{0,40}\bstep\b[^.]{0,60}\b(?:incorrect|invalid|mistake|error)\b/i.test(instruction))type='error-analysis';else if(/\b(?:zeros?|poles?|holes?|vertical asymptotes?|horizontal asymptotes?|slant asymptotes?|oblique asymptotes?|end behavior)\b/i.test(instruction))type='rational-analysis';else if(complete)type='complete-square';else if(division)type='divide';else if(/\bpoint.slope\b/i.test(instruction))type='point-slope';else if(/\baverage rate of change\b/i.test(instruction))type='average-rate';else if(/\brate of change\b/i.test(instruction))type='rate';else if(/\bslope\b/i.test(instruction))type='slope';else if(/^\s*(?:please\s+)?factor\b/i.test(instruction))type='factor';else if(/^\s*(?:please\s+)?expand\b/i.test(instruction))type='expand';else if(/^\s*(?:please\s+)?solve\b/i.test(instruction))type='equation';else if(/^\s*(?:please\s+)?(?:simplify|reduce|combine)\b/i.test(instruction))type='simplify';else if(/^\s*(?:please\s+)?(?:evaluate|calculate|find (?:the )?(?:exact )?value|what is (?:the )?(?:exact )?value)\b/i.test(instruction))type='evaluate';
 const output={kind:type==='equation'?'solution-set':type==='divide'||type==='complete-square'?'fields':type==='point-slope'?'equation':'expression',...(inverseTrig&&/\b(?:in|as)\s+degrees\b|\b(?:answer|result|angle)\b[^.]{0,80}\bdegrees\b/i.test(instruction)?{angleUnit:'degrees'}:inverseTrig&&/\bin radians\b/i.test(instruction)?{angleUnit:'radians'}:{}),...(logBase!==null?{logBase}:{})};
 const rounding=instruction.match(/(?:nearest|round(?:ed)? to (?:the )?)\s*(tenth|hundredth|thousandth|integer)|(\d+)\s*decimal places/i);if(rounding)output.decimalPlaces=rounding[2]?Number(rounding[2]):({tenth:1,hundredth:2,thousandth:3,integer:0}[rounding[1].toLowerCase()]);
 const outerFraction=raw=>{
  const source=raw.trim();const group=(str,start)=>{if(str[start]!=='{')return null;let depth=0;for(let i=start;i<str.length;i++){if(str[i]==='{')depth++;if(str[i]==='}'&&!--depth)return {value:str.slice(start+1,i),end:i+1};}return null;};
  const fraction=source.match(/^\\(?:d?frac)\s*/);if(fraction){const n=group(source,fraction[0].length),rest=n?source.slice(n.end).search(/\S/):-1,d=n&&rest>=0?group(source,n.end+rest):null;return n&&d&&!source.slice(d.end).trim()?{numerator:n.value,denominator:d.value}:null;}
  let depth=0,slash=-1;for(let i=0;i<source.length;i++){if('({['.includes(source[i]))depth++;if(')}]'.includes(source[i]))depth--;if(source[i]==='/'&&depth===0){if(slash!==-1)return null;slash=i;}}return slash>0?{numerator:source.slice(0,slash),denominator:source.slice(slash+1)}:null;
 };
 let task=null,givens={};let expression=pureExpressions.length===1?pureExpressions[0].text:'';
 if(type==='complete-square'){const definition=expression.match(/^(?:[a-z]\s*\(\s*([a-z])\s*\)|y)\s*=\s*(.+)$/i);if(definition)expression=definition[2].trim();}
 if(type==='complete-square')givens={variable:(expression.replace(/\\[a-z]+/gi,'').match(/[a-z]/)||['x'])[0],...(completeTemplate?{template:completeTemplate}:{})};
 if(type==='divide'&&pureExpressions.length===1){const fraction=outerFraction(pureExpressions[0].text);if(fraction)givens={dividend:fraction.numerator,divisor:fraction.denominator};}
 if(type==='divide'&&pureExpressions.length===2){givens={dividend:pureExpressions[0].text,divisor:pureExpressions[1].text};expression=givens.dividend;}
 if(['slope','rate','average-rate','point-slope'].includes(type)){
  const t=tables.find(t=>t.exact===true&&Array.isArray(t.points));
  if(t)givens={points:t.points.map(r=>r.slice())};else if(graph.exact===true)givens={points:graph.points.map(r=>r.slice())};
  else{const pairs=[...(instruction+'\n'+originalText).matchAll(/\(\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)\s*\)/g)].map(m=>[m[1],m[2]]);const unique=[...new Map(pairs.map(p=>[JSON.stringify(p),p])).values()];if(unique.length>=1&&unique.length<=20)givens={points:unique};}
  if(type==='average-rate'){const interval=(instruction+'\n'+originalText).match(/\bfrom\s+x\s*=\s*(-?\d+(?:\.\d+)?)\s+to\s+x\s*=\s*(-?\d+(?:\.\d+)?)|\binterval\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/i);if(interval)givens.interval=[interval[1]||interval[3],interval[2]||interval[4]];}
  if(type==='point-slope'&&givens.points?.length===1){const slope=(instruction+'\n'+originalText).match(/\bslope\s*(?:is|=|of)\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)/i);if(slope)givens.slope=slope[1];}
 }
 const evidenceSteps=[];
 if(type==='error-analysis'){
  for(const [index,node]of topMath.entries()){let anchor=node.parentElement;while(anchor&&anchor!==root){const label=text(anchor).match(/^Step\s*(\d+)\s*[:.)-]?/i);if(label&&topMath.filter(n=>anchor.contains(n)).length===1){evidenceSteps.push({number:Number(label[1]),expression:expressions[index]?.text||''});break;}anchor=anchor.parentElement;}}
  if(evidenceSteps.length>=2&&evidenceSteps.length===pureExpressions.length&&evidenceSteps.every((e,i)=>e.number===i+1&&e.expression===pureExpressions[i].text)){givens={steps:evidenceSteps.map(e=>e.expression)};expression=pureExpressions[0].text;}
 }
 if(type==='inverse-table'){
  const table=tables.find(t=>t.exact===true);const target=(instruction+' '+expressions.map(e=>e.text).join(' ')).match(/[a-z]\s*\^\s*\{?\s*-1\s*\}?\s*\(\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)\s*\)/i);
  if(table&&target){givens={points:table.points.map(p=>p.slice()),target:target[1]};expression='';}
 }
 if(type==='inverse-affine'){
  const definition=pureExpressions.length===1?pureExpressions[0].text.match(/^[a-z]\s*\(\s*x\s*\)\s*=\s*(.+)$/i):null;
  if(definition){expression=definition[1].trim();output.form='inverse';}
 }
 if(type==='rational-analysis'){
  const features=[['zeros',/\bzeros?\b/i],['poles',/\bpoles?\b|\bvertical asymptotes?\b/i],['holes',/\bholes?\b/i],['horizontal-asymptote',/\bhorizontal asymptotes?\b/i],['slant-asymptote',/\b(?:slant|oblique) asymptotes?\b/i],['end-negative',/\bend behavior\b[^.]{0,100}(?:negative infinity|[-−]\s*(?:infinity|\\infty))/i],['end-positive',/\bend behavior\b[^.]{0,100}(?:positive infinity|\+\s*(?:infinity|\\infty))/i]].filter(([,pattern])=>pattern.test(instruction));
  const source=expression.replace(/^[a-z]\s*\(\s*[a-z]\s*\)\s*=\s*/i,'').trim();
  const group=(str,start)=>{if(str[start]!=='{')return null;let depth=0;for(let i=start;i<str.length;i++){if(str[i]==='{')depth++;if(str[i]==='}'&&!--depth)return {value:str.slice(start+1,i),end:i+1};}return null;};
  let numerator,denominator;
  const fraction=source.match(/^\\(?:d?frac)\s*/);if(fraction){const n=group(source,fraction[0].length);const rest=n?source.slice(n.end).search(/\S/):-1;const d=n&&rest>=0?group(source,n.end+rest):null;if(n&&d&&!source.slice(d.end).trim()){numerator=n.value;denominator=d.value;}}
  else{let depth=0,slash=-1;for(let i=0;i<source.length;i++){if('({['.includes(source[i]))depth++;if(')}]'.includes(source[i]))depth--;if(source[i]==='/'&&depth===0){if(slash!==-1){slash=-1;break;}slash=i;}}if(slash>0){numerator=source.slice(0,slash);denominator=source.slice(slash+1);}}
  if(features.length===1&&numerator&&denominator){givens={numerator,denominator,feature:features[0][0]};if(features[0][0]==='holes')output.form=/\bx[- ]values?\b/i.test(instruction)?'x-values':'points';}
 }
 if(type&&!mixedNumber&&(expression||givens.points)&&!(type==='divide'&&!givens.divisor)&&!(type==='complete-square'&&!completeTemplate)&&!(type==='average-rate'&&!givens.interval)&&!(type==='inverse-table'&&!givens.target)&&!(type==='inverse-affine'&&output.form!=='inverse')&&!(type==='rational-analysis'&&!givens.feature)&&!(type==='error-analysis'&&!givens.steps)&&!(slots.length>1&&slots.some(s=>s.role==='unknown'))){task={schema:'kubla-task-v1',task:type,expression,givens,slots:slots.map(({id,role})=>({id,role})),output,domain:type==='factor'&&/\bcomplex\b|ℂ|\\mathbb\s*\{\s*C\s*\}/i.test(instruction)?'complex':type==='factor'&&!/\breal\b|ℝ|\\mathbb\s*\{\s*R\s*\}/i.test(instruction)?'rational':'real'};}
 if(choices.length&&!choiceInspection.ok)task=null;
 const response={...(choices.length&&!choiceInspection.ok?{readerError:choiceInspection.error}:{}),kind:choices.length?'choice':slots.length>1?'fields':slots.length===1?slots[0].kind:graph.interactiveResponse?'graph':'unknown',slots,choices};
 const original={instruction,text:originalText,expressions,ordinal:ordinal?Number(ordinal[1]||ordinal[3]):null,total:ordinal?Number(ordinal[2]||ordinal[4]):null};
 const syncBoundary=()=>publicBoundary(root);
 const guard=syncBoundary();
 const stable={url:location.href,original,slots:slots.map(({id,role,kind,label,path,disabled})=>({id,role,kind,label,path,disabled})),choices:choices.map(({index,expression,text})=>({index,expression,text})),tables,graph,task};
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable)));const fingerprint=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
 const doc={schema:'kubla-problem-v1',url:location.href,original,task,response,evidence:{tables,graph,...(evidenceSteps.length?{steps:evidenceSteps}:{})},notation:{mixedNumber,angleUnit,logBase,...(logConvention?{logConvention}:{})},fingerprint};
 const probe={stage:choices.length&&!choiceInspection.ok?'response':!slots.length&&!choices.length?'response':!task?'interpretation':'verification',choiceReadState:choiceInspection.ok?'READY':choiceInspection.error,slots:slots.length,choices:choices.length,expressions:expressions.length,tables:tables.length,relevantGraph:graph.relevant,interactiveGraph:graph.interactiveResponse,incidentalGraphs:graph.incidentalCount,task:type||'unknown'};
 if(action==='read')return {ok:true,document:doc,probe,guard,boundaryPath:path(root)};
 if(cancelled())return {ok:false,error:'ACTION_CANCELLED'};
 if(!expected.fingerprint||expected.fingerprint!==fingerprint||expected.url&&expected.url!==location.href)return {ok:false,error:'STALE_PROBLEM_DOCUMENT',probe};
 if(!['fill','readback','check'].includes(action))return {ok:false,error:'UNKNOWN_PROBLEM_ACTION'};
 const values=answer.fields;if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length!==slots.length||slots.some(s=>typeof values[s.id]!=='string'||values[s.id].length>4000)||slots.length<1||slots.length>8)return {ok:false,error:'ANSWER_SLOT_MAP_MISMATCH'};
 if(slots.some(s=>s.disabled))return {ok:false,error:'RESPONSE_DISABLED'};
 if(action==='fill'){
  if(slots.some(s=>s.value.trim()))return {ok:false,error:'ANSWER_FIELD_NOT_EMPTY'};
  if(slots.some(s=>s.kind==='mathquill'))return {ok:false,error:'TARGET_MQ_DOM_FALLBACK',slots:slots.map(({id,path})=>({id,path})),fingerprint};
  for(const s of slots){const e=at(s.path);if(e?.type==='number'&&!/^-?\d+(?:\.\d+)?$/.test(values[s.id]))return {ok:false,error:'NUMBER_FIELD_CANNOT_ACCEPT_SYMBOLIC_ANSWER'};}
  for(const s of slots){const fresh=await readProblemDOM('read');if(cancelled()||!fresh.ok||fresh.document.fingerprint!==fingerprint)return {ok:false,error:'STALE_PROBLEM_DURING_FILL'};const current=fresh.document.response.slots.find(x=>x.id===s.id),e=at(current.path);if(!e||current.value.trim()||current.disabled||e.disabled||e.readOnly||e.getAttribute('aria-disabled')==='true')return {ok:false,error:'RESPONSE_CHANGED_DURING_FILL'};const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,values[s.id]);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}
  const fresh=await readProblemDOM('read');return !cancelled()&&fresh.ok&&fresh.document.fingerprint===fingerprint&&fresh.document.response.slots.every(s=>s.value===values[s.id])?{ok:true,fields:Object.fromEntries(fresh.document.response.slots.map(s=>[s.id,s.value])),fingerprint}:{ok:false,error:'INPUT_READBACK_MISMATCH'};
 }
 if(slots.some(s=>s.kind==='mathquill'&&typeof window.MathQuill?.getInterface!=='function'))return {ok:false,error:'PUBLIC_MQ_READBACK_REQUIRED'};
 if(slots.some(s=>s.value!==values[s.id]))return {ok:false,error:'ANSWER_READBACK_MISMATCH'};
 if(action==='readback')return {ok:true,fields:Object.fromEntries(slots.map(s=>[s.id,s.value])),fingerprint};
 const controls=[...document.querySelectorAll('button,[role=button]')].filter(e=>visible(e)&&!irrelevant(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&/^(check|check answer|check answers|submit answer)$/i.test(name(e)));
 if(controls.length!==1)return {ok:false,error:'CHECK_CONTROL_MISSING_OR_AMBIGUOUS'};
 // Re-read in the same injected action after all awaited work. This final read
 // still precedes a microtask; compare DOM values synchronously again at click.
 const final=await readProblemDOM('read');if(cancelled()||!final.ok||final.document.fingerprint!==fingerprint||final.document.response.slots.some(s=>s.value!==values[s.id]))return {ok:false,error:'STALE_RESPONSE_BEFORE_CHECK'};
 if(cancelled()||syncBoundary()!==final.guard||!controls[0].isConnected||controls[0].disabled||!visible(controls[0])||!/^(check|check answer|check answers|submit answer)$/i.test(name(controls[0]))||slots.some(s=>{const e=at(s.path);if(!e||!visible(e)||e.disabled||e.readOnly||e.getAttribute('aria-disabled')==='true')return true;if(s.kind==='native')return e.value!==values[s.id];try{return window.MathQuill.getInterface(2)(e).latex()!==values[s.id];}catch{return true;}}))return {ok:false,error:'RESPONSE_CHANGED_BEFORE_CHECK'};
 controls[0].click();return {ok:true,clicked:true,fingerprint};
}
