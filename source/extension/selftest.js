import {solve,parse,format} from './math.js';import {isKhan,safeRate} from './policy.js';
import {solveSupported,equivalent} from './advanced-math.js';
import {collectJobs} from './dual.js';
const checks=[
 ['Manifest V3',()=>chrome.runtime.getManifest().manifest_version===3],
 ['Chrome version floor',()=>Number(/Chrome\/(\d+)/.exec(navigator.userAgent)?.[1])>=120],
 ['Exact fractions',()=>solve('1/2+1/3','evaluate').answer==='5/6'],
 ['Negative precedence',()=>solve('-2^2','evaluate').answer==='-4'],
 ['Screenshot quadratic factors',()=>{const r=solve('10x^2+13x+4','factor');return r.status==='solved'&&format(parse(r.answer))==='10*x^2 + 13*x + 4';}],
 ['Higher polynomial',()=>solve('x^3-4x^2+6x-24','factor').status==='solved'],
 ['Linear equation',()=>solve('3x+2=1','equation').answer==='-1/3'],
 ['Unsafe input rejected',()=>solve('alert(1)','evaluate').status==='unsupported'],
 ['Unsupported radicals stop',()=>solve('x^2-2','factor').status==='unsupported'],
 ['Host boundary',()=>!isKhan('https://www.khanacademy.org.evil.com/')],
 ['Rate boundary',()=>safeRate(999)===2],
 ['Rational expression cancellation',()=>equivalent(solveSupported('(x^2-1)/(x+1)','simplify').answer,'x-1')],
 ['Exact unit-circle value',()=>solveSupported('sin(pi/3)','evaluate').answer==='sqrt(3)/2'],
 ['Two-lane class scope',()=>collectJobs([{kind:'exercise',url:'https://example.com/assignment/1'}],'https://classroom.khanacademy.org/learner/class/FIXTURE').exercise.length===0],
 ['Session storage',async()=>{await chrome.storage.session.set({selftest:true});const r=await chrome.storage.session.get('selftest');await chrome.storage.session.remove('selftest');return r.selftest===true;}],
];
let passed=0;for(const [label,fn]of checks){let ok=false;try{ok=await fn();}catch{}const li=document.createElement('li');li.textContent=(ok?'PASS · ':'FAIL · ')+label;document.getElementById('results').append(li);if(ok)passed++;}
document.getElementById('summary').textContent=`${passed}/${checks.length} local checks passed`;
