import test from 'node:test';import assert from 'node:assert/strict';import {mathQuillDOM} from '../extension/mq-dom.js';
let value='',latex='',selected=false,pasting=false,disabledPaste=false,disabledCopy=false,stateless=false;
class TA{focus(){}dispatchEvent(e){if(e.type==='keydown'){if(e.key==='a')selected=true;else selected=false;}if(e.type==='copy'){if(disabledCopy)return false;this.value=stateless?'$'+latex+'$':latex;}if(e.type==='paste'){if(disabledPaste)return false;pasting=true;}if(e.type==='input'&&pasting){latex=this.value.replace(/^\$|\$$/g,'');this.value='';pasting=false;}return true;}}
Object.defineProperty(TA.prototype,'value',{get(){return value;},set(v){value=v;}});globalThis.HTMLTextAreaElement=TA;globalThis.KeyboardEvent=class extends Event{constructor(type,o){super(type,o);this.key=o.key;}};
const ta=new TA(),root={get textContent(){return latex;}};const editor={isConnected:true,getClientRects(){return [1];},querySelector(s){return s==='textarea'?ta:root;}};
globalThis.document={querySelectorAll(s){return s.startsWith('annotation')?[]:[editor];}};globalThis.location={href:'https://classroom.khanacademy.org/learner/class/A/assignment/1'};globalThis.getComputedStyle=()=>({visibility:'visible'});
const expected={token:location.href+'|'};
function reset(){value='';latex='';selected=false;pasting=false;disabledCopy=false;disabledPaste=false;stateless=false;}
test('no-global-API path inserts exact LaTeX and reads it back',async()=>{reset();const r=await mathQuillDOM('insert',expected,{latex:'(2x+1)(5x+4)'});assert.ok(r.ok,JSON.stringify(r));assert.equal(r.observed,'(2x+1)(5x+4)');assert.equal(selected,false);});
test('stateless clipboard convention is detected locally',async()=>{reset();stateless=true;const r=await mathQuillDOM('insert',expected,{latex:'\\frac{-1}{2}'});assert.ok(r.ok);assert.equal(r.observed,'\\frac{-1}{2}');});
test('copy prevention is respected',async()=>{reset();disabledCopy=true;const r=await mathQuillDOM('insert',expected,{latex:'2'});assert.equal(r.error,'EDITOR_COPY_DISABLED');assert.equal(latex,'');});
test('paste prevention is respected',async()=>{reset();disabledPaste=true;const r=await mathQuillDOM('insert',expected,{latex:'2'});assert.equal(r.error,'EDITOR_PASTE_DISABLED');assert.equal(latex,'');});
test('existing answer is preserved',async()=>{reset();latex='x+7';const r=await mathQuillDOM('insert',expected,{latex:'2'});assert.equal(r.error,'ANSWER_FIELD_NOT_EMPTY');assert.equal(latex,'x+7');});
test('readback mode does not mutate the expression',async()=>{reset();latex='x^{2}';const r=await mathQuillDOM('read',expected);assert.ok(r.ok);assert.equal(r.latex,'x^{2}');assert.equal(latex,'x^{2}');});
test('stale page cannot receive a paste',async()=>{reset();const r=await mathQuillDOM('insert',{token:'old'},{latex:'2'});assert.equal(r.error,'PAGE_CHANGED_READ_AGAIN');assert.equal(latex,'');});
