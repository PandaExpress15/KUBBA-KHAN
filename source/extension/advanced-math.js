import {Q,parse,normalize,format,mul,add,solve,latex} from './math.js';
const zero=()=>new Q(0),one=()=>new Q(1),trim=p=>{while(p.length>1&&!p.at(-1).n)p.pop();return p;};
const isZero=p=>p.length===1&&!p[0].n;
function divide(a,b){if(isZero(b))throw Error('Division by zero');let r=[...a],q=Array.from({length:Math.max(1,a.length-b.length+1)},zero),steps=0;while(!isZero(r)&&r.length>=b.length){if(++steps>20)throw Error('Polynomial division limit');const degree=r.length-b.length,c=r.at(-1).div(b.at(-1));q[degree]=q[degree].add(c);const term=Array.from({length:degree},zero).concat(b.map(v=>v.mul(c).neg()));r=trim(add(r,term));}return {q:trim(q),r};}
function polynomialGCD(a,b){let i=0;while(!isZero(b)){if(++i>20)throw Error('Polynomial GCD limit');[a,b]=[b,divide(a,b).r];}const lead=a.at(-1);return a.map(x=>x.div(lead));}
function strip(s){while(s[0]==='('&&s.at(-1)===')'){let depth=0,whole=true;for(let i=0;i<s.length-1;i++){if(s[i]==='(')depth++;if(s[i]===')')depth--;if(!depth){whole=false;break;}}if(!whole)break;s=s.slice(1,-1);}return s;}
export function rational(source){
 const normalized=normalize(source),vars=[...new Set(normalized.match(/[a-z]/g)||[])];if(vars.length>1)throw Error('One variable only');const v=vars[0]||'x',s=strip(normalized);let depth=0,slash=-1;
 for(let i=0;i<s.length;i++){if(s[i]==='(')depth++;if(s[i]===')')depth--;if(s[i]==='/'&&depth===0){if(slash!==-1)throw Error('Use one explicit polynomial fraction');slash=i;}}
 let n,d;if(slash<0){n=parse(s,v);d=[one()];}else{n=parse(strip(s.slice(0,slash)),v);d=parse(strip(s.slice(slash+1)),v);}
 if(isZero(d))throw Error('Division by zero');const originalDenominator=format(d,v),g=polynomialGCD(n,d);n=divide(n,g).q;d=divide(d,g).q;const lead=d.at(-1);n=n.map(x=>x.div(lead));d=d.map(x=>x.div(lead));return {n,d,v,originalDenominator};
}
function rationalSolve(source){const r=rational(source),numerator=format(r.n,r.v),denominator=format(r.d,r.v),answer=denominator==='1'?numerator:`(${numerator})/(${denominator})`;return {status:'solved',answer,latex:denominator==='1'?latex(numerator):`\\frac{${latex(numerator)}}{${latex(denominator)}}`,steps:['Use exact polynomial division to remove common numerator and denominator factors.',`Original denominator ${r.originalDenominator} must remain nonzero.`,`Reduced expression: ${answer}.`],verification:'Exact polynomial GCD and division.'};}
const sine=new Map([[0,'0'],[2,'1/2'],[3,'sqrt(2)/2'],[4,'sqrt(3)/2'],[6,'1'],[8,'sqrt(3)/2'],[9,'sqrt(2)/2'],[10,'1/2'],[12,'0'],[14,'-1/2'],[15,'-sqrt(2)/2'],[16,'-sqrt(3)/2'],[18,'-1'],[20,'-sqrt(3)/2'],[21,'-sqrt(2)/2'],[22,'-1/2']]);
const tangent=new Map([[0,'0'],[2,'sqrt(3)/3'],[3,'1'],[4,'sqrt(3)'],[8,'-sqrt(3)'],[9,'-1'],[10,'-sqrt(3)/3'],[12,'0'],[14,'sqrt(3)/3'],[15,'1'],[16,'sqrt(3)'],[20,'-sqrt(3)'],[21,'-1'],[22,'-sqrt(3)/3']]);
export function trigSolve(source){
 let s=source.replace(/\\(?:left|right)/g,'').replace(/\\,/g,'').replace(/\s/g,'');const m=s.match(/^(?:\\)?(sin|cos|tan)\((.+)\)$/);if(!m)throw Error('Use sin, cos or tan of one exact common angle');const fn=m[1],hasPi=/\\pi|π|\bpi\b/.test(m[2]);let a=m[2].replace(/\\pi|π|pi/g,'p');
 let angle;if(/(?:\^\{?\\circ\}?|°)$/.test(a)){a=a.replace(/(?:\^\{?\\circ\}?|°)$/,'');const p=parse(a);if(p.length!==1)throw Error('Numeric degrees only');angle=p[0].div(new Q(180));}else{if(!hasPi&&/[a-z]/.test(a))throw Error('Write the angle using pi, not a variable');const p=parse(a,'p');if(p.length>2||(p[0].n&&p.length>1))throw Error('Use an exact multiple of pi');if(p.length===1&&p[0].n)throw Error('Nonzero radians must be written as a multiple of pi');angle=p[1]||zero();}
 const t=angle.mul(new Q(12));if(t.d!==1n)throw Error('Only standard unit-circle angles are supported');const index=Number((t.n%24n+24n)%24n),answer=fn==='sin'?sine.get(index):fn==='cos'?sine.get((index+6)%24):tangent.get(index);if(answer===undefined)throw Error('Undefined or unsupported trigonometric value');
 const radicalLatex=answer.replace(/sqrt\((\d+)\)/g,'\\sqrt{$1}');let tex=radicalLatex;const f=radicalLatex.match(/^(-?)(.+)\/(\d+)$/);if(f)tex=`${f[1]}\\frac{${f[2]}}{${f[3]}}`;
 return {status:'solved',answer,latex:tex,steps:[`Reduce the angle modulo 2*pi: ${new Q(BigInt(index),12)}*pi.`,`Use the exact unit-circle ${fn} value and its quadrant sign.`,`Result: ${answer}.`],verification:'Exact rational angle reduction and standard unit-circle identities.'};
}
function radical(source){
 let s=source.replace(/\s/g,'').replace(/\\(?:left|right)/g,'').replace(/\\cdot/g,'*').replace(/\\sqrt\{(2|3)\}/g,'sqrt($1)');
 s=s.replace(/^(-?)\\frac\{(-?sqrt\([23]\))\}\{([1-9]\d*)\}$/,'$1$2/$3');
 const m=s.match(/^(-?)sqrt\(([23])\)(?:\/([1-9]\d*))?$/);return m?`${m[1]}sqrt(${m[2]})/${m[3]||'1'}`:null;
}
export function equivalent(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;const x=solve(a,'simplify'),y=solve(b,'simplify');if(x.status==='solved'&&y.status==='solved')return x.answer===y.answer;
 const ra=radical(a),rb=radical(b);if(ra&&rb)return ra===rb;
 try{const p=rational(a),q=rational(b);if(p.v!==q.v&&(p.n.length>1||p.d.length>1)&&(q.n.length>1||q.d.length>1))return false;return format(p.n)===format(q.n)&&format(p.d)===format(q.d);}catch{return false;}
}
export function solveSupported(expression,operation){
 if(/^(?:\\)?(?:sin|cos|tan)\s*(?:\\left)?\(/.test(expression?.trim()||'')){try{return trigSolve(expression);}catch(e){return {status:'unsupported',reason:e.message};}}
 const base=solve(expression,operation);if(base.status==='solved'||operation!=='simplify')return base;
 try{return rationalSolve(expression);}catch(e){return {status:'unsupported',reason:e.message};}
}
