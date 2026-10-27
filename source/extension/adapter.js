(() => {
  if(globalThis.__khanLocalRunner)return;globalThis.__khanLocalRunner=true;
  const topFrame=window===window.top;
  const khan=h=>['classroom.khanacademy.org','www.khanacademy.org'].includes(h);
  if(!khan(location.hostname)&&![...location.ancestorOrigins].some(x=>{try{return khan(new URL(x).hostname);}catch{return false;}}))return;
  let cfg={running:false,revision:0,rate:2,autoNext:false},observer,timer,deadline,route=location.href,ended=false,lastReport='',lastScan=0;
  const bound=new Map();
  const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
  const send=m=>chrome.runtime.sendMessage(m).catch(()=>({ok:false,error:'EXTENSION_RELOADED'}));
  function report(state,code=''){
    const video=[...bound.keys()].find(v=>visible(v));const data={type:'REPORT',state,code,revision:cfg.revision,videos:bound.size,rate:video?.playbackRate||0};const signature=JSON.stringify(data);if(signature!==lastReport){lastReport=signature;void send(data);}
  }
  function cleanup(){observer?.disconnect();clearTimeout(timer);clearTimeout(deadline);for(const [v,b]of bound){for(const [name,fn]of Object.entries(b.events))v.removeEventListener(name,fn);if(v.playbackRate===cfg.rate)v.playbackRate=b.rate;}bound.clear();ended=false;}
  function complete(){return [...document.querySelectorAll('[role=status],[role=alert],[data-testid*=completion]')].filter(visible).some(e=>/^(video|lesson|activity|assignment)\s+(is\s+)?complete[d]?[.!]?$/i.test(e.textContent.trim()));}
  function navigate(){
    if(!cfg.running||!topFrame||!ended||!cfg.autoNext||!complete()||answerFields().length)return;
    const candidates=[...document.querySelectorAll('button,a,[role=button]')].filter(e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&/^(next|next lesson|next activity)$/i.test((e.getAttribute('aria-label')||e.textContent).trim()));
    if(candidates.length!==1){report('UNSUPPORTED','NEXT_CONTROL_AMBIGUOUS');return;}
    ended=false;report('NAVIGATED','SITE_COMPLETION_OBSERVED');candidates[0].click();
  }
  function bind(v){
    if(bound.has(v))return;
    const events={playing:()=>{if(cfg.running){v.playbackRate=cfg.rate;report('VIDEO_PLAYING');}},ratechange:()=>{if(cfg.running)report('VIDEO_READY',v.playbackRate===cfg.rate?'RATE_CONFIRMED':'RATE_CHANGED_BY_USER');},ended:()=>{if(cfg.running){ended=true;report('VIDEO_ENDED','MEDIA_ENDED_CREDIT_UNVERIFIED');navigate();}},error:()=>report('ERROR','MEDIA_ERROR')};
    bound.set(v,{rate:v.playbackRate,events});for(const[n,f]of Object.entries(events))v.addEventListener(n,f);v.playbackRate=cfg.rate;
  }
  function scan(){
    if(!cfg.running)return;lastScan=Date.now();
    if(route!==location.href){route=location.href;ended=false;lastReport='';report('IDENTIFY_PAGE','ROUTE_CHANGED');}
    for(const v of [...bound.keys()])if(!v.isConnected||!visible(v)){const old=bound.get(v);for(const[n,f]of Object.entries(old.events))v.removeEventListener(n,f);if(v.playbackRate===cfg.rate)v.playbackRate=old.rate;bound.delete(v);}
    [...document.querySelectorAll('video')].filter(visible).forEach(bind);
    if(bound.size){const videos=[...bound.keys()];report(ended?'VIDEO_ENDED':videos.some(v=>!v.paused)?'VIDEO_PLAYING':'VIDEO_READY',ended?'MEDIA_ENDED_CREDIT_UNVERIFIED':videos.every(v=>v.playbackRate===cfg.rate)?'RATE_CONFIRMED':'RATE_CHANGED_BY_USER');}
    else if(topFrame){
      const fields=answerFields();
      if(fields.length)report('WAIT_FOR_USER_REVIEW',fields.length===1?'EXERCISE_DETECTED':'MULTIPLE_FIELDS');
      else if(document.querySelector('iframe[src*="youtube"]'))report('IDENTIFY_PAGE','WAITING_FOR_EMBEDDED_MEDIA');
      else report('UNSUPPORTED','NO_SUPPORTED_MEDIA_OR_INPUT');
    }
    navigate();
  }
  function schedule(){if(!timer&&cfg.running)timer=setTimeout(()=>{timer=null;scan();},Math.max(0,300-(Date.now()-lastScan)));}
  function answerFields(){
    const q=[...document.querySelectorAll('.mq-editable-field,input:not([type]),input[type=text],input[type=number],textarea')];
    return q.filter(e=>visible(e)&&!e.disabled&&!e.readOnly&&!(e.matches('textarea,input')&&e.closest('.mq-editable-field'))&&!e.closest('[role=search]')&&!/search/i.test(e.getAttribute('aria-label')||''));
  }
  function read(){
    const fields=answerFields();
    const anns=[...document.querySelectorAll('annotation[encoding="application/x-tex"]')].filter(e=>!e.closest('.mq-editable-field'));
    const expressions=[...new Set(anns.map(e=>e.textContent.trim()).filter(Boolean))];
    const mathText=Array.from(document.querySelectorAll('annotation[encoding="application/x-tex"],.katex-mathml math,[data-tex],[data-latex],[role=math],script[type="math/tex"],.katex,math')).filter(e=>!e.closest('.mq-editable-field')).map(e=>(e.getAttribute('data-tex')||e.getAttribute('data-latex')||e.getAttribute('aria-label')||e.textContent)+(e.querySelectorAll('sup,msup,mfrac').length?e.innerHTML:'')).join('|').slice(0,2000);
    const prompt=[...document.querySelectorAll('main,[role=main],[data-testid*=question],.perseus-renderer')].find(e=>visible(e)&&/factor|expand|simplify|solve|evaluate/i.test(e.innerText))?.innerText||'';
    const mode=/factor/i.test(prompt)?'factor':/expand/i.test(prompt)?'expand':/solve/i.test(prompt)?'equation':/evaluate/i.test(prompt)?'evaluate':'simplify';
    return {ok:true,fieldCount:fields.length,kind:fields[0]?.matches('.mq-editable-field')?'mathquill':'plain',expression:expressions.length===1?expressions[0].replace(/=\s*$/,''):'',mode,token:location.href+'|'+mathText,code:expressions.length===1?'EXPRESSION_READ':'TYPE_EXPRESSION_MANUALLY'};
  }
  function configure(next){cleanup();cfg=next;lastReport='';route=location.href;if(!cfg.running)return;observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});deadline=setTimeout(()=>{report('ERROR','SESSION_TIME_LIMIT');cleanup();cfg.running=false;},30*60*1000);scan();}
  chrome.runtime.onMessage.addListener((m,s,reply)=>{
    if(m.type==='CONFIG'){configure(m.config);reply({ok:true});}
    else if(m.type==='MEDIA_ENDED'&&topFrame&&cfg.running&&m.revision===cfg.revision){if(route!==location.href){route=location.href;ended=false;reply({ok:false,error:'ROUTE_CHANGED'});}else{ended=true;navigate();reply({ok:true});}}
    else if(m.type==='READ'&&topFrame)reply(read());
    else if(m.type==='PLAY'){
      if(!cfg.running){reply({ok:false,error:'START_VIDEO_ASSIST_FIRST'});return;}
      const videos=[...document.querySelectorAll('video')].filter(visible);
      if(videos.length!==1){reply({ok:false,error:'USE_PLAYER_PLAY_BUTTON_FOR_EMBEDDED_VIDEO'});return;}
      videos[0].play().then(()=>reply({ok:true}),()=>reply({ok:false,error:'CLICK_PLAY_ON_THE_VIDEO'}));return true;
    }
  });
  window.addEventListener('popstate',schedule);
  void send({type:'HELLO'}).then(r=>{if(r.ok)configure(r.config);});
})();
