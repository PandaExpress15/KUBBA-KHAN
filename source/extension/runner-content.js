(() => {
 if(globalThis.__klrDualTicker)return;globalThis.__klrDualTicker=true;
 let timer=null,busy=false;
 const send=m=>chrome.runtime.sendMessage(m).catch(()=>({ok:false}));
 if(window!==window.top){void send({type:'AUTO_FRAME'});return;}
 async function pulse(){if(busy)return;busy=true;try{const r=await send({type:'AUTO_PULSE'});if(!r.running){clearInterval(timer);timer=null;}}finally{busy=false;}}
 function configure(running){clearInterval(timer);timer=null;if(running){timer=setInterval(pulse,4000);void pulse();}}
 chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.type==='AUTO_CONFIG'){configure(m.running);reply({ok:true});}});
 void send({type:'AUTO_HELLO'}).then(r=>configure(r.running===true));
})();
