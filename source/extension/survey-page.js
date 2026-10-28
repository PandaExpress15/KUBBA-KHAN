// Ordinary visible DOM only. These injected readers never click, enter answers,
// invoke application internals, or start media.
export function surveyListSnapshot(){
 const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],[inert]');
 const text=e=>String(e?.innerText||e?.textContent||'').replace(/\s+/g,' ').trim();
 const labelled=e=>{
  const ids=(e.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean),labels=ids.map(id=>document.getElementById(id)).filter(Boolean);
  if(labels.length)return {name:labels.map(text).join(' '),source:'aria-labelledby',labels};
  if(e.getAttribute('aria-label')?.trim())return {name:e.getAttribute('aria-label'),source:'aria-label',labels:[]};
  const associated=[...(e.labels||[]),...document.querySelectorAll('label[for]')].filter(l=>l.htmlFor===e.id&&e.id||l.contains(e));
  const wrapped=e.closest('label');if(wrapped)associated.push(wrapped);
  if(associated.length)return {name:[...new Set(associated)].map(text).join(' '),source:'label',labels:[]};
  return {name:e.getAttribute('title')||'',source:e.getAttribute('title')?'title':'none',labels:[]};
 };
 const value=s=>/^to[ -]?do$/i.test(s)?'todo':/^(?:completed|complete|done|in progress|all(?: assignments| statuses)?|not started|past due)$/i.test(s)?'other':null;
 const controls=[...document.querySelectorAll('select,[role=combobox]')].filter(visible).filter(e=>![...e.querySelectorAll('select,[role=combobox]')].some(visible));
 const candidates=controls.map(e=>{const label=labelled(e),named=/\b(?:assignment\s+)?status\b/i.test(label.name),options=e.matches('select')?[...e.options].map(text):[],fallback=!named&&options.some(o=>value(o)==='todo')&&options.every(o=>value(o));return {e,label,named,fallback};}).filter(c=>c.named||c.fallback);
 const statusProbe={controls:controls.length,candidates:candidates.length,namedCandidates:candidates.filter(c=>c.named).length,optionCandidates:candidates.filter(c=>c.fallback).length,source:candidates.length===1?(candidates[0].fallback?'native-options':candidates[0].label.source):candidates.length?'ambiguous':'none',state:candidates.length>1?'ambiguous':'unknown',valueSources:[]};
 if(candidates.length===1){
  const {e,label}=candidates[0],values=[];let unknownExplicit=false;
  const add=(s,source)=>{const found=value(String(s||'').trim());if(found){values.push(found);if(!statusProbe.valueSources.includes(source))statusProbe.valueSources.push(source);}};
  if(e.matches('select')){if(e.selectedOptions.length===1)add(text(e.selectedOptions[0]),'selected-option');}
  else{
   const explicit=e.getAttribute('aria-valuetext');if(explicit?.trim()){add(explicit,'aria-valuetext');unknownExplicit=!value(explicit.trim());}
   for(const node of label.labels)add(text(node),'labelledby-value');
   add(text(e).replace(/^(?:assignment\s+)?status\s*[:\-]?\s*/i,''),'control-text');
   for(const span of e.querySelectorAll('span'))if(visible(span)&&!span.closest('[role=listbox],[role=option]'))add(text(span),'control-text');
   const listIds=(e.getAttribute('aria-controls')||'').split(/\s+/).filter(Boolean),options=[...e.querySelectorAll('[role=option][aria-selected=true]'),...listIds.flatMap(id=>[...(document.getElementById(id)?.querySelectorAll('[role=option][aria-selected=true]')||[])])];
   for(const option of new Set(options))add(text(option),'aria-selected-option');
  }
  const unique=[...new Set(values)];statusProbe.state=unique.length>1?'ambiguous':unknownExplicit?'unknown':unique[0]||'unknown';
 }
 const isTodo=statusProbe.state==='todo'?true:statusProbe.state==='other'?false:null;
 const items=[],seen=new Set();
 for(const a of document.querySelectorAll('a[href*="/assignment/"]')){
  if(!visible(a))continue;const row=a.closest('tr,[role=row],li')||a.parentElement;
  const links=[...row.querySelectorAll('a[href*="/assignment/"]')].filter(visible);if(links.length!==1)continue;
  let u;try{u=new URL(a.getAttribute('href'),location.href);}catch{continue;}
  if(u.origin!==location.origin||!/\/learner\/class\/[^/]+\/assignment\/[^/]+\/?$/.test(u.pathname))continue;
  const url=u.origin+u.pathname;if(seen.has(url))continue;seen.add(url);
  const cells=[...row.querySelectorAll('td,[role=cell]')].filter(e=>visible(e)&&!e.querySelector('a[href*="/assignment/"]'));
  const dedicated=cells.map(c=>text(c).toLowerCase()).filter(t=>['video','exercise','article'].includes(t));
  const labels=text(row)+' '+[...row.querySelectorAll('[aria-label],[title]')].map(e=>e.getAttribute('aria-label')||e.getAttribute('title')).join(' ');
  const types=[...new Set(dedicated.length?dedicated:[...labels.matchAll(/\b(video|exercise|article)\b/gi)].map(m=>m[1].toLowerCase()))];
  items.push({url,kind:types.length===1?types[0]:'unknown',title:text(a).replace(/[\u0000-\u001f]/g,'').slice(0,160)});
 }
 const counter=text(document.body).match(/\b(?:current\s+)?page\s*:?\s*(\d+)\s*(?:of|\/)\s*(\d+)/i);
 return {url:location.href,isTodo,statusProbe,items,page:counter?Number(counter[1]):null,pages:counter?Number(counter[2]):null};
}
export function surveyPreviewSnapshot(){
 const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],[inert]');
 const nodes=s=>[...document.querySelectorAll(s)].filter(visible);
 const root=nodes('[data-testid=question],main,[role=main]')[0]||document.body;
 const name=e=>String(e.getAttribute('aria-label')||e.getAttribute('title')||e.innerText||e.textContent||'').replace(/\s+/g,' ').trim();
 return {url:location.href,editorWork:nodes('.mq-editable-field .mq-root-block').some(e=>String(e.textContent||'').replace(/[\s\u200b\u2060]/g,'').length>0),videoCount:nodes('video').length,videoFrames:nodes('iframe[src*="youtube"],iframe[src*="vimeo"]').length,article:root.matches('article')||!!root.querySelector('article')||/\barticle\b/i.test(root.getAttribute('data-testid')||''),intro:nodes('button,[role=button]').some(e=>/^(start|start exercise|begin practice|let.s go)$/i.test(name(e))),graph:nodes('[data-testid*=graph],[aria-label*=graph i]').some(e=>root.contains(e)&&!e.closest('.mq-editable-field,aside,nav,[role=complementary],[data-testid*=drawing i],[data-testid*=calculator i]')&&/graph (?:answer|response)|interactive graph|graphie/i.test(name(e)+' '+e.getAttribute('data-testid'))&&(e.matches('[tabindex],[role=application]')||!!e.querySelector('[tabindex],button,input'))),hasContent:String(root.innerText||root.textContent||'').trim().length>0};
}
