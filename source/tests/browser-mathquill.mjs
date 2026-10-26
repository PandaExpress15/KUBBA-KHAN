import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {launch} from './browser-support.mjs';
import {mathQuillDOM} from '../extension/mq-dom.js';
import {equivalent} from '../extension/advanced-math.js';
const b=await launch();let options={};
const url='https://classroom.khanacademy.org/learner/class/EDITOR/assignment/1';
try{
 await b.context.route('https://classroom.khanacademy.org/**',async r=>{
  const p=new URL(r.request().url()).pathname;
  if(p.startsWith('/vendor/'))return r.fulfill({contentType:p.endsWith('.css')?'text/css':'text/javascript',body:await readFile(new URL('.'+p,import.meta.url))});
  return r.fulfill({contentType:'text/html',body:`<link rel="stylesheet" href="/vendor/mathquill/mathquill.css"><script src="/vendor/jquery.js"></script><script src="/vendor/mathquill/mathquill.js"></script><main><span id="editor"></span></main><script>
   const field=MathQuill.getInterface(2).MathField(document.getElementById('editor'),{statelessClipboard:${!!options.stateless}});
   window.fixtureRead=()=>field.latex();field.latex(${JSON.stringify(options.existing||'')});delete window.MathQuill;
   ${options.copyDisabled?`document.querySelector('textarea').addEventListener('copy',e=>e.preventDefault());`:''}
   ${options.pasteDisabled?`document.querySelector('textarea').addEventListener('paste',e=>e.preventDefault());`:''}
  </script>`});
 });
 const page=await b.context.newPage();let cases=0;
 async function attempt(opts,answer){
  options=opts;await page.goto(url);
  assert.equal(await page.evaluate(()=>typeof window.MathQuill),'undefined');
  const tabId=await b.worker.evaluate(async u=>(await chrome.tabs.query({})).find(t=>t.url===u).id,url);
  const args=['insert',{token:url+'|'},answer];
  const result=await b.worker.evaluate(`(async()=> (await chrome.scripting.executeScript({target:{tabId:${tabId}},world:'MAIN',func:${mathQuillDOM.toString()},args:${JSON.stringify(args)}}))[0].result)()`);
  cases++;const value=await page.evaluate(()=>fixtureRead());console.log('CASE',cases,JSON.stringify({opts,answer,result,value}));return {result,value};
 }
 for(const [latex,answer,stateless]of [['(2x+1)(5x+4)','10x^2+13x+4',false],['-\\frac{1}{2}','-1/2',true],['\\frac{x+1}{x-1}','(x+1)/(x-1)',false],['\\frac{\\sqrt{3}}{2}','sqrt(3)/2',true]]){
  const {result,value}=await attempt({stateless},{latex});assert.ok(result.ok,JSON.stringify(result));assert.ok(equivalent(value,answer),value);assert.ok(equivalent(result.observed,answer));
 }
 for(const [option,error]of [['copyDisabled','EDITOR_COPY_DISABLED'],['pasteDisabled','EDITOR_PASTE_DISABLED']]){
  const {result,value}=await attempt({[option]:true},{latex:'2'});assert.equal(result.error,error);assert.equal(value,'');
 }
 const preserved=await attempt({existing:'x+7'},{latex:'2'});assert.equal(preserved.result.error,'ANSWER_FIELD_NOT_EMPTY');assert.equal(preserved.value,'x+7');
 console.log(`PASS ${cases} actual upstream MathQuill no-global cases: factors, negative fraction, rational fraction, radical, stateless clipboard, copy/paste prevention, existing-work preservation`);
}finally{await b.close();}
