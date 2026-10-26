import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
export const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
export const extension=fileURLToPath(new URL('../extension/',import.meta.url));
export const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function until(fn,{timeout=30000,interval=100,label='condition'}={}){
 const end=Date.now()+timeout;let result;
 while(Date.now()<end){result=await fn();if(result)return result;await wait(interval);}
 throw Error('Timed out: '+label+'; last result '+JSON.stringify(result));
}
export async function launch({beforeInstall}={}){
 const profile=await mkdtemp(path.join(tmpdir(),'khan-browser-'));
 let context;
 try{
  context=await chromium.launchPersistentContext(profile,{
   ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{channel:'chromium'}),
   headless:true,chromiumSandbox:true,ignoreDefaultArgs:['--disable-extensions'],
   env:{...process.env,XDG_CONFIG_HOME:path.join(profile,'config'),XDG_CACHE_HOME:path.join(profile,'cache')},
   // CDP's supported unpacked-extension developer API, only in this disposable profile.
   // No web-security, TLS, autoplay, editor or sandbox bypasses.
   args:['--enable-unsafe-extension-debugging']
  });
  await beforeInstall?.(context);
  // Match ordinary Load unpacked installation: enable Developer mode through
  // Chrome's UI in this disposable profile before testing developer reload.
  const manager=await context.newPage();await manager.goto('chrome://extensions/');
  const developerMode=manager.locator('#devMode');
  if(!await developerMode.evaluate(e=>e.checked))await developerMode.click();
  const cdp=await context.browser().newBrowserCDPSession();
  const {id}=await cdp.send('Extensions.loadUnpacked',{path:extension});
  const worker=await until(()=>context.serviceWorkers().find(w=>w.url()===`chrome-extension://${id}/worker.js`),{label:'MV3 worker'});
  await manager.close();
  return {context,cdp,id,worker,profile,close:async()=>{await context.close();await rm(profile,{recursive:true,force:true});}};
 }catch(e){await context?.close();await rm(profile,{recursive:true,force:true});throw e;}
}
// Chrome's real action popup is intentionally not exposed as a Playwright Page.
// Attach CDP to that existing popup; never substitute an extension tab for it.
export async function popup(browser){
 const {context,worker,id}=browser;
 await worker.evaluate(async()=>{
  const [window]=await chrome.windows.getAll({windowTypes:['normal']});
  if(!window)throw Error('No normal browser window for action popup');
  await chrome.windows.update(window.id,{focused:true});
  await chrome.action.openPopup({windowId:window.id});
 });
 const cdp=await context.browser().newBrowserCDPSession();
 const target=await until(async()=> (await cdp.send('Target.getTargets')).targetInfos.find(t=>t.url===`chrome-extension://${id}/popup.html`),{label:'action popup'});
 const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
 let next=0;const pending=new Map();
 cdp.on('Target.receivedMessageFromTarget',event=>{
  if(event.sessionId!==sessionId)return;
  const m=JSON.parse(event.message),p=pending.get(m.id);
  if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const n=++next;pending.set(n,{resolve,reject});
  cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:n,method,params})}).catch(reject);
 });
 const evaluate=async(fn,arg)=>{
  const r=await send('Runtime.evaluate',{expression:`(${fn})(${JSON.stringify(arg)??''})`,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;
 };
 await until(()=>evaluate(()=>!!document.getElementById('start')&&document.readyState==='complete'),{label:'popup DOM'});
 return {evaluate,send,click:async selector=>{
  const point=await evaluate(s=>{const e=document.querySelector(s);if(!e||e.disabled)throw Error('Control unavailable: '+s);const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};},selector);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
 },screenshot:async()=>Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64')};
}
