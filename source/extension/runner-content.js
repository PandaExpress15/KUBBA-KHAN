(() => {
 if(globalThis.__klrDualTicker)return;globalThis.__klrDualTicker=true;
 let timer=null,busy=false,running=false,generation=0;
 const send=m=>chrome.runtime.sendMessage(m).catch(()=>({ok:false}));
 if(window!==window.top){void send({type:'AUTO_FRAME'});return;}
 async function pulse(){
  if(!running)return;
  if(busy){timer=setTimeout(pulse,50);return;}
  busy=true;const current=generation;
  try{
   const r=await send({type:'AUTO_PULSE'});
   if(current!==generation||!running)return;
   if(!r.running){running=false;return;}
   const delay=Number.isFinite(r.nextPulseMs)?Math.min(4000,Math.max(50,r.nextPulseMs)):4000;
   timer=setTimeout(pulse,delay);
  }finally{busy=false;}
 }
 function configure(active){generation++;running=active;clearTimeout(timer);timer=null;if(running)void pulse();}
 chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.type==='AUTO_CONFIG'){configure(m.running===true);reply({ok:true});}});
 void send({type:'AUTO_HELLO'}).then(r=>configure(r.running===true));
})();
