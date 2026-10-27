import assert from 'node:assert/strict';
import {launch} from './browser-support.mjs';
import {choiceDOM} from '../extension/choice-dom.js';
import {uniqueChoice} from '../extension/choice.js';
const b=await launch(),url='https://classroom.khanacademy.org/learner/class/CHOICE-GUARDS/assignment/1';
let body='';
const options=(extra='',legend='Choose 1 answer <span>Required</span>')=>`<main><p>Evaluate.</p><span data-tex="2+2">2+2</span><fieldset><legend aria-hidden="true">${legend}</legend><ul data-widget="radio" role="list"><li role="listitem"><button id="a" aria-pressed="false" aria-labelledby="a content-a">A</button><div id="content-a">${extra}<span data-tex="4">4</span></div></li><li role="listitem"><button id="b" aria-pressed="false" aria-labelledby="b content-b">B</button><div id="content-b"><span data-tex="5">5</span></div></li></ul></fieldset><button id="check">Check</button></main><script>window.actions=[];for(const id of ['a','b'])document.getElementById(id).onclick=()=>{actions.push('select-'+id);for(const other of ['a','b'])document.getElementById(other).setAttribute('aria-pressed',other===id?'true':'false');};document.getElementById('check').onclick=()=>actions.push('check');</script>`;
try{
 await b.context.route(url,r=>r.fulfill({contentType:'text/html',body}));const p=await b.context.newPage();
 async function open(html=options()){body=html;await p.goto(url);}
 async function run(action,expected={},selection={}){return b.worker.evaluate(`(async()=>{const tab=(await chrome.tabs.query({})).find(t=>t.url===${JSON.stringify(url)});return (await chrome.scripting.executeScript({target:{tabId:tab.id},func:${choiceDOM.toString()},args:${JSON.stringify([action,expected,selection])}}))[0].result;})()`);}
 await open();let s=await run('inspect');assert.equal(s.ok,true);assert.equal(s.kind,'perseus-radio');assert.deepEqual(s.choices.map(c=>c.expression),['4','5']);
 assert.equal((await run('select',{url,token:s.token},{index:0})).ok,true);assert.deepEqual((await run('read')).selected,[0]);
 // Selection changes after readback must fail in the same action that could Check.
 await p.locator('#a').evaluate(e=>e.setAttribute('aria-pressed','false'));await p.locator('#b').evaluate(e=>e.setAttribute('aria-pressed','true'));
 assert.equal((await run('check',{url,token:s.token},{index:0})).error,'CHOICE_READBACK_MISMATCH');assert.deepEqual(await p.evaluate(()=>actions),['select-a']);
 await open();s=await run('inspect');await p.locator('#content-a span').evaluate(e=>{e.setAttribute('data-tex','5');e.textContent='5';});assert.equal((await run('select',{url,token:s.token},{index:0})).error,'CHOICE_STALE_CONTENT');assert.deepEqual(await p.evaluate(()=>actions),[]);
 for(const semantic of ['NOT ','greater than ','approximately ']){await open(options(semantic));assert.equal((await run('inspect')).error,'CHOICE_UNREADABLE_OPTION',semantic);}
 await open();await p.locator('#content-a span').evaluate(e=>{e.setAttribute('data-tex','1/2');e.textContent='1/2';});await p.locator('#content-b span').evaluate(e=>{e.setAttribute('data-tex','0.5');e.textContent='0.5';});s=await run('inspect');assert.equal((await uniqueChoice({expression:'1/2',operation:'evaluate'},{answer:'1/2'},s.choices)).error,'CHOICE_AMBIGUOUS_MATCH');
 await open();s=await run('inspect');await run('select',{url,token:s.token},{index:0});await p.locator('ul').evaluate(e=>e.appendChild(e.firstElementChild));assert.equal((await run('check',{url,token:s.token},{index:0})).error,'CHOICE_STALE_CONTENT');assert.deepEqual(await p.evaluate(()=>actions),['select-a']);
 await open(options('<span style="display:none" data-tex="999">999</span>'));s=await run('inspect');assert.equal(s.ok,true);assert.equal(s.choices[0].expression,'4');
 await open();await p.locator('#a').evaluate(e=>e.setAttribute('aria-pressed','true'));s=await run('inspect');assert.deepEqual(s.selected,[0]);assert.equal((await run('select',{url,token:s.token},{index:1})).error,'ANSWER_FIELD_NOT_EMPTY');assert.deepEqual(await p.evaluate(()=>actions),[]);
 await open();await p.locator('#a').evaluate(e=>e.setAttribute('aria-disabled','true'));assert.equal((await run('inspect')).error,'CHOICE_DISABLED');
 await open();await p.locator('#a').evaluate(e=>e.setAttribute('aria-pressed','mixed'));assert.equal((await run('inspect')).error,'CHOICE_STATE_UNREADABLE');
 for(const legend of ['Choose 2 answers','Choose all answers']){await open(options('',legend));assert.equal((await run('inspect')).error,'CHOICE_SINGLE_ANSWER_REQUIRED');}
 await open(options('<svg></svg>'));assert.equal((await run('inspect')).error,'CHOICE_GRAPH_UNSUPPORTED');
 await open('<main><p>Evaluate</p><span data-tex="2+2">2+2</span><fieldset><label><input type="radio" name="answer">4</label><label><input type="radio" name="answer">5</label></fieldset><button>Check</button></main>');s=await run('inspect');assert.equal(s.ok,true);assert.equal(s.kind,'native-radio');assert.equal((await run('select',{url,token:s.token},{index:0})).ok,true);assert.deepEqual((await run('read')).selected,[0]);
 await open('<main><p>Evaluate</p><span data-tex="2+2">2+2</span><div role="radiogroup"><div role="radio" aria-checked="false" onclick="this.setAttribute(\'aria-checked\',\'true\')">4</div><div role="radio" aria-checked="false">5</div></div><button>Check</button></main>');s=await run('inspect');assert.equal(s.ok,true);assert.equal(s.kind,'aria-radio');assert.equal((await run('select',{url,token:s.token},{index:0})).ok,true);assert.deepEqual((await run('read')).selected,[0]);
 console.log('PASS actual Chrome choice guards: required legend, native/ARIA/Perseus read/select, atomic selection-change Check rejection, stale content, semantic text, duplicate equivalents, reordered options, hidden math, existing work, disabled/mixed state, choose-many and graphs');
}finally{await b.close();}
