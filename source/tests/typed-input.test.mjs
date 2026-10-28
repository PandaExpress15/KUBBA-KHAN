import test from 'node:test';import assert from 'node:assert/strict';
import {typedInputDOM} from '../extension/typed-input.js';import {publicBoundary} from '../extension/problem-dom.js';
test('typed adapter embeds exactly the public reader guard',()=>{assert.ok(typedInputDOM.toString().includes(publicBoundary.toString()),'reader and writer must use identical visible-boundary semantics');});
test('invalid typed actions fail without accessing a response',async()=>{
 const previous=globalThis.document;globalThis.document={body:{children:[]}};
 try{const r=await typedInputDOM('unknown',{},{});assert.equal(r.ok,false);assert.equal(r.error,'UNKNOWN_TYPED_ACTION');}finally{globalThis.document=previous;}
});
test('atomic Check branch contains no await between final ensure and click',()=>{const source=typedInputDOM.toString(),start=source.indexOf('// No await from final guard/slot/signature'),end=source.indexOf('controls[0].click()',start);assert.ok(start>0&&end>start);assert.ok(!/\bawait\b/.test(source.slice(source.indexOf('\n',start)+1,end)));});
