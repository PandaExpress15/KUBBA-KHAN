import test from 'node:test';import assert from 'node:assert/strict';
import {solve,parse,format,mul,Q} from '../extension/math.js';
const cases=[
 ['factor','10x^2+13x+4','(2*x + 1)*(5*x + 4)'],
 ['expand','(2x+1)(5x+4)','10*x^2 + 13*x + 4'],
 ['expand','(x-2)^2','x^2 - 4*x + 4'],
 ['simplify','2x + 3x - 5 + 9','5*x + 4'],
 ['evaluate','1/2+1/3','5/6'],['evaluate','0.1+0.2','3/10'],
 ['evaluate','-2^2','-4'],['evaluate','(-2)^2','4'],
 ['evaluate','2*(3+4)','14'],['evaluate','0','0'],
 ['equation','2x+3=7','2'],['equation','-3x=6','-2'],
 ['equation','x/3=1/2','3/2'],['equation','2y+1=0','-1/2'],
 ['expand','\\frac{1}{2}x+\\frac{1}{3}x','5/6*x'],
 ['expand','x^{2}+2x+1','x^2 + 2*x + 1'],
 ['simplify','3x² − 2x³ + x²','-2*x^3 + 4*x^2'],
 ['evaluate','2^0','1'],['evaluate','2(3+1)','8'],
];
for(const [mode,expr,answer] of cases)test(`${mode}: ${expr}`,()=>{const r=solve(expr,mode);assert.equal(r.status,'solved',JSON.stringify(r));if(mode==='factor')assert.equal(format(parse(r.answer)),format(parse(expr)));else assert.equal(r.answer,answer);});
for(const expr of ['x^2-4','x^3-4x^2+6x-24','6x^3+9x^2','-2x^2+8','x^4-16','x^2+1','0*x','x','x^8','0','(x+1)^4','x^2/2-1/2'])test(`factor verified expansion ${expr}`,()=>{const r=solve(expr,'factor');assert.equal(r.status,'solved',JSON.stringify(r));assert.equal(format(parse(r.answer)),format(parse(expr)));});
for(const expr of ['process.exit()','alert(1)','x.constructor','sin(x)','x+y','1/0','2^999','x^9','x^-2','1/x','x^2.5','1e9','NaN','Infinity','x;fetch(1)','\\sqrt{4}','(x+1','x)','2**3','x=2','('.repeat(26)+'x'+')'.repeat(26),'9'.repeat(301)])test(`reject ${expr.slice(0,30)}`,()=>assert.equal(solve(expr,'simplify').status,'unsupported'));
test('irrational factoring stops instead of an incomplete answer',()=>assert.equal(solve('x^2-2','factor').status,'unsupported'));
test('cubic irrational roots stops',()=>assert.equal(solve('x^3-2','factor').status,'unsupported'));
test('no solution',()=>assert.equal(solve('x+1=x+2','equation').reason,'No solution.'));
test('infinite solutions',()=>assert.equal(solve('2(x+1)=2x+2','equation').reason,'Infinitely many solutions.'));
test('nonlinear equation unsupported',()=>assert.equal(solve('x^2=4','equation').status,'unsupported'));
test('exact rational normalizes negative denominator',()=>assert.equal(new Q(2,-4).toString(),'-1/2'));
test('zero polynomial multiplication',()=>assert.equal(format(mul(parse('0'),parse('x+1'))),'0'));
test('numeric mode rejects variable',()=>assert.equal(solve('2x','evaluate').status,'unsupported'));
test('unknown operation',()=>assert.equal(solve('1','anything').status,'unsupported'));
test('mixed numbers stop instead of concatenating digits',()=>assert.equal(solve('1 1/2','evaluate').status,'unsupported'));
test('fraction LaTeX has structural numerator and denominator',()=>assert.equal(solve('1/2','evaluate').latex,'\\frac{1}{2}'));
// Generated identities independently construct (a*x+b)(c*x+d), checking factorization.
for(let a=1;a<=4;a++)for(let b=-3;b<=3;b++)test(`factor identity ${a},${b}`,()=>{const c=5-a,d=b+2;const src=`${a*c}x^2+(${a*d+b*c})x+(${b*d})`;const r=solve(src,'factor');assert.equal(r.status,'solved',JSON.stringify(r));const expanded=parse(r.answer);assert.equal(format(expanded),format(parse(src)));for(const x of [-2,0,3]){const value=expanded.reduce((s,q,i)=>s+Number(q.n)/Number(q.d)*x**i,0);assert.ok(value===(a*x+b)*(c*x+d));}});
