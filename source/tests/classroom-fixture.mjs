// Synthetic site UI only. Chrome APIs, media, the extension and MathQuill are real.
export const ROOT='https://classroom.khanacademy.org/learner/class/FIXTURE';
const record=`const record=(kind,data={})=>window.recordFixture({kind,url:location.href,at:Date.now(),...data});`;
export function listHTML({fullNavigation=false,initialPage=3,single=false}={}){
 return `<!doctype html><html><body><h1>All assignments</h1><select aria-label="Assignment Status"><option selected>To-do</option></select><div id="list"></div><script>
 ${record}
 let page=Number(new URL(location.href).searchParams.get('page'))||${initialPage};
 const rows=${JSON.stringify(single?[[['exercise1','Exercise']]]:[[['article','Article']],[['video1','Video'],['exercise1','Exercise'],['../foreign','Video']],[['video2','Video'],['exercise2','Exercise'],['video1','Video']]])};
 if(${single})page=1;
 function render(){record('list-page',{page});document.getElementById('list').innerHTML='<table>'+rows[page-1].map(([id,type])=>'<tr><td><a href="'+(id==='../foreign'?'https://classroom.khanacademy.org/learner/class/OTHER/assignment/foreign':'${ROOT}/assignment/'+id)+'">'+id+'</a></td><td>'+type+'</td></tr>').join('')+'</table><p>Current page: '+page+' of '+rows.length+'.</p><button id="prev" '+(page===1?'disabled':'')+'>Previous</button><button id="next" '+(page===rows.length?'disabled':'')+'>Next</button>';document.getElementById('prev').onclick=()=>move(-1);document.getElementById('next').onclick=()=>move(1);}
 function move(n){${fullNavigation?`location.href='${ROOT}?page='+(page+n);`:`setTimeout(()=>{page+=n;render();},150);`}}
 render();</script></body></html>`;
}
export function mediaHTML({embedded=false}={}){
 if(embedded)return `<!doctype html><html><body><h1>Embedded fixture video</h1><iframe title="Fixture player" width="400" height="260" src="https://www.youtube-nocookie.com/embed/FIXTURE"></iframe></body></html>`;
 return `<!doctype html><html><body><h1>Fixture video</h1><video width="320" height="180" src="https://classroom.khanacademy.org/fixture-playback.webm" preload="auto"></video><script>${record}
 const v=document.querySelector('video');for(const event of ['playing','timeupdate','ratechange','ended','pause','seeked'])v.addEventListener(event,e=>record('media-'+event,{trusted:e.isTrusted,time:v.currentTime,duration:v.duration,rate:v.playbackRate,paused:v.paused}));
 </script></body></html>`;
}
export function exerciseHTML({editor='native',questions=2,wrong=false,feedbackDelay=250,unknown=false,changeAfterCheck=false,unsupported=false,ordinals=true,copyDisabled=false,pasteDisabled=false,stateless=false,hiddenDistractor=false}={}){
 const mq=editor!=='native';
 return `<!doctype html><html><head>${mq?'<link rel="stylesheet" href="/vendor/mathquill/mathquill.css"><script src="/vendor/jquery.js"></script><script src="/vendor/mathquill/mathquill.js"></script>':''}</head><body><h1>Factoring assignment</h1>${hiddenDistractor?'<aside hidden>Expand this old example <math><annotation encoding="application/x-tex">x+9</annotation></math></aside>':''}<header id="ordinal"></header><main data-testid="question"></main><script>
 ${record}
 let q=1,field=null,value='',checks=0;window.fixtureChecks=()=>checks;
 const expression=${JSON.stringify(unsupported?'\\sin(x)':'10x^2+13x+4')};
 const MQ=window.MathQuill?.getInterface(2);
 function renderedValue(){return ${mq?'field.latex()':'document.querySelector("#answer")?.value||""'};}
 window.fixtureAnswer=renderedValue;
 function render(){
  record('exercise-question',{q});value='';document.getElementById('ordinal').textContent=${ordinals?`q+' of ${questions} questions'`:`''`};
  document.querySelector('main').innerHTML='<p>${unsupported?'Evaluate the expression.':'Factor the quadratic expression completely.'}</p><math><semantics><annotation encoding="application/x-tex">'+expression+'</annotation></semantics></math>${mq?'<span id="answer"></span>':'<input id="answer" aria-label="Answer">'}<button id="check">Check</button><p role="status" id="feedback"></p><button id="next-question" hidden>Next question</button><button id="done" hidden>Done</button>';
  ${mq?`field=MQ.MathField(document.getElementById('answer'),{statelessClipboard:${stateless}});
  ${editor==='fallback'?'delete window.MathQuill;':''}
  ${copyDisabled?`document.querySelector('#answer textarea').addEventListener('copy',e=>e.preventDefault());`:''}
  ${pasteDisabled?`document.querySelector('#answer textarea').addEventListener('paste',e=>e.preventDefault());`:''}`:`document.querySelector('main').oninput=e=>{if(e.target.id!=='answer')return;value=e.target.value;record('native-input',{q,value});queueMicrotask(()=>{const old=document.getElementById('answer');if(old){const fresh=old.cloneNode();fresh.value=value;old.replaceWith(fresh);record('controlled-rerender',{q,value:fresh.value});}});};`}
  document.getElementById('check').onclick=()=>{
   checks++;const answer=renderedValue();record('check',{q,answer,checks});
   if(${changeAfterCheck}){document.querySelector('annotation').textContent='x^2-1';return;}
   if(${unknown})return;
   setTimeout(()=>{const normalized=answer.replace(/\\\\(?:left|right|cdot)/g,'').replace(/[ *]/g,'');const correct=!${wrong}&&['(2x+1)(5x+4)','(5x+4)(2x+1)'].includes(normalized);document.getElementById('feedback').textContent=correct?'Correct!':'Incorrect';record('feedback',{q,correct});if(correct){document.getElementById('check').hidden=true;document.getElementById(q===${questions}?'done':'next-question').hidden=false;}},${feedbackDelay});
  };
  document.getElementById('next-question').onclick=()=>{record('next',{q});setTimeout(()=>{q++;render();},150);};
  document.getElementById('done').onclick=()=>{record('done',{q});document.querySelector('main').innerHTML='<p role="status">Exercise complete</p>';};
 }
 render();</script></body></html>`;
}
