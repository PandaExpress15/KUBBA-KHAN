import test from 'node:test';import assert from 'node:assert/strict';import {insertReviewed} from '../extension/input.js';
const events=[];
class Input {constructor(){this.value='';this.type='text';this.tagName='INPUT';}getClientRects(){return [1];}getAttribute(){return null;}closest(){return null;}dispatchEvent(e){events.push(e.type);}}
Object.defineProperty(Input.prototype,'value',{get(){return this.v||'';},set(v){this.v=v;},configurable:true});
class Area extends Input{}
Object.defineProperty(Area.prototype,'value',Object.getOwnPropertyDescriptor(Input.prototype,'value'));
let editors=[],inputs=[];const token='https://classroom.khanacademy.org/learner/class/A/assignment/1|';
globalThis.location={href:token.slice(0,-1)};globalThis.getComputedStyle=()=>({visibility:'visible'});globalThis.window={};globalThis.HTMLInputElement=Input;globalThis.HTMLTextAreaElement=Area;
globalThis.document={querySelectorAll(s){return s.startsWith('annotation')?[]:s==='.mq-editable-field'?editors:inputs;}};
test('plain insertion uses input and change, never submits',()=>{editors=[];inputs=[new Input()];events.length=0;const r=insertReviewed({answer:'-3/2',latex:'-3/2'},token);assert.ok(r.ok);assert.equal(inputs[0].value,'-3/2');assert.deepEqual(events,['input','change']);});
test('never overwrites existing work',()=>{inputs=[new Input()];inputs[0].value='student answer';assert.equal(insertReviewed({answer:'2'},token).error,'ANSWER_FIELD_NOT_EMPTY');});
test('stale page rejected',()=>assert.equal(insertReviewed({answer:'2'},'old').error,'PAGE_CHANGED_READ_AGAIN'));
test('multiple fields rejected',()=>{editors=[];inputs=[new Input(),new Input()];assert.equal(insertReviewed({answer:'2'},token).error,'NEED_EXACTLY_ONE_VISIBLE_ANSWER_FIELD');});
test('numeric field rejects symbolic answer',()=>{inputs=[new Input()];inputs[0].type='number';assert.equal(insertReviewed({answer:'x+1'},token).error,'NUMBER_FIELD_CANNOT_ACCEPT_SYMBOLIC_ANSWER');});
test('MathQuill uses existing public instance',()=>{let latex='';let focused=false;inputs=[];editors=[new Input()];window.MathQuill={getInterface(){return ()=>({latex(v){if(v!==undefined)latex=v;return latex;},focus(){focused=true;}});}};assert.ok(insertReviewed({answer:'x^2',latex:'x^{2}'},token).ok);assert.equal(latex,'x^{2}');assert.ok(focused);});
test('missing MathQuill API returns manual fallback',()=>{window.MathQuill=null;assert.equal(insertReviewed({answer:'2',latex:'2'},token).error,'MATHQUILL_PUBLIC_API_UNAVAILABLE_COPY_MANUALLY');});
