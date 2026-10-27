// Ordinary visible DOM only. These injected readers never click, enter answers,
// invoke application internals, or start media.
export function surveyListSnapshot(){
 const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],[inert]');
 const text=e=>String(e?.innerText||e?.textContent||'').replace(/\s+/g,' ').trim();
 const status=[...document.querySelectorAll('select')].filter(visible).find(e=>/assignment status|status/i.test(e.getAttribute('aria-label')||'')||[...e.options].some(o=>/^to[ -]?do$/i.test(text(o))));
 const selected=status?text(status.selectedOptions[0]):text([...document.querySelectorAll('[role=combobox]')].filter(visible).find(e=>/assignment status|status/i.test(e.getAttribute('aria-label')||'')));
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
 return {url:location.href,isTodo:selected?/^to[ -]?do$/i.test(selected):null,items,page:counter?Number(counter[1]):null,pages:counter?Number(counter[2]):null};
}
export function surveyPreviewSnapshot(){
 const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden],[inert]');
 const nodes=s=>[...document.querySelectorAll(s)].filter(visible);
 const root=nodes('[data-testid=question],main,[role=main]')[0]||document.body;
 const name=e=>String(e.getAttribute('aria-label')||e.getAttribute('title')||e.innerText||e.textContent||'').replace(/\s+/g,' ').trim();
 return {url:location.href,editorWork:nodes('.mq-editable-field .mq-root-block').some(e=>String(e.textContent||'').replace(/[\s\u200b\u2060]/g,'').length>0),videoCount:nodes('video').length,videoFrames:nodes('iframe[src*="youtube"],iframe[src*="vimeo"]').length,article:root.matches('article')||!!root.querySelector('article')||/\barticle\b/i.test(root.getAttribute('data-testid')||''),intro:nodes('button,[role=button]').some(e=>/^(start|start exercise|begin practice|let.s go)$/i.test(name(e))),graph:nodes('canvas,[role=application],[data-testid*=graph]').some(e=>root.contains(e)),hasContent:String(root.innerText||root.textContent||'').trim().length>0};
}
