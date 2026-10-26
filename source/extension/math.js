// Bounded, exact, single-variable polynomial algebra. No eval or network.
const abs = a => a < 0n ? -a : a;
const gcd = (a,b) => { a=abs(a);b=abs(b);while(b)[a,b]=[b,a%b];return a||1n; };
export class Q {
  constructor(n,d=1n){n=BigInt(n);d=BigInt(d);if(!d)throw Error('Division by zero');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);this.n=n/g;this.d=d/g;if(abs(this.n)>10n**36n||this.d>10n**36n)throw Error('Number exceeds exact arithmetic limit');}
  add(b){return new Q(this.n*b.d+b.n*this.d,this.d*b.d);}
  neg(){return new Q(-this.n,this.d);}
  sub(b){return this.add(b.neg());}
  mul(b){return new Q(this.n*b.n,this.d*b.d);}
  div(b){return new Q(this.n*b.d,this.d*b.n);}
  eq(b){return this.n===b.n&&this.d===b.d;}
  toString(){return this.d===1n?`${this.n}`:`${this.n}/${this.d}`;}
}
const Z=()=>new Q(0), O=()=>new Q(1);
const trim=p=>{while(p.length>1&&!p.at(-1).n)p.pop();return p;};
export const add=(a,b)=>trim(Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]||Z()).add(b[i]||Z())));
const neg=a=>a.map(q=>q.neg());
export const mul=(a,b)=>{if(a.length+b.length-2>8)throw Error('Maximum polynomial degree is 8');const p=Array.from({length:a.length+b.length-1},Z);a.forEach((x,i)=>b.forEach((y,j)=>p[i+j]=p[i+j].add(x.mul(y))));return trim(p);};
const pow=(a,n)=>{if(!Number.isInteger(n)||n<0||n>8)throw Error('Use whole exponents from 0 to 8');let p=[O()];for(let i=0;i<n;i++)p=mul(p,a);return p;};
export function normalize(s){
  if(typeof s!=='string'||s.length>300)throw Error('Use a math expression of at most 300 characters');
  if(/\d\s+\d/.test(s))throw Error('Mixed numbers need explicit addition, such as 1+1/2');
  s=s.replace(/[−–]/g,'-').replace(/[×·]/g,'*').replace(/²/g,'^2').replace(/³/g,'^3').replace(/\\(?:left|right)/g,'').replace(/\\(?:cdot|times)/g,'*').replace(/\\,/g,'').replace(/\^\{(\d+)\}/g,'^$1');
  for(let i=0;i<6;i++){const next=s.replace(/\\(?:d?frac)\{([^{}]+)\}\{([^{}]+)\}/g,'(($1)/($2))');if(next===s)break;s=next;}
  s=s.replace(/\{/g,'(').replace(/\}/g,')').replace(/\s/g,'');
  if(/\d[eE][+-]?\d/.test(s))throw Error('Scientific notation is not supported; enter the whole number');
  if(!s||/[^0-9a-z.+*/^()=\-]/.test(s))throw Error('Unsupported notation; use one variable, numbers, + - * / ^ and parentheses');
  return s;
}
export function parse(source, variable='x'){
  const s=normalize(source);const ts=s.match(/\d+(?:\.\d+)?|[a-z]|[.+*/^()=\-]/g)||[];
  if(ts.join('')!==s||ts.length>200)throw Error('Invalid or oversized expression');
  let i=0,depth=0;
  const number=t=>{if(!/^\d+(\.\d+)?$/.test(t))throw Error('Invalid number');const [a,b='']=t.split('.');return new Q(BigInt(a+b),10n**BigInt(b.length));};
  function atom(){if(++depth>24)throw Error('Expression nesting limit');let p;const t=ts[i++];if(t==='('){p=sum();if(ts[i++]!==')')throw Error('Missing closing parenthesis');}else if(t===variable)p=[Z(),O()];else if(t&&/^\d/.test(t))p=[number(t)];else throw Error('Expected a number, variable, or parentheses');depth--;return p;}
  function power(){let p=atom();if(ts[i]==='^'){i++;let n;if(ts[i]==='('){i++;n=ts[i++];if(ts[i++]!==')')throw Error('Invalid exponent');}else n=ts[i++];if(!/^\d+$/.test(n||''))throw Error('Unsupported exponent');p=pow(p,Number(n));}return p;}
  function unary(){if(ts[i]==='+'){i++;return unary();}if(ts[i]==='-'){i++;return neg(unary());}return power();}
  function product(){let p=unary();while(i<ts.length){const t=ts[i];if(t==='*'||t==='/'){i++;const b=unary();if(t==='/'){if(b.length!==1)throw Error('Variable denominators need a separately validated module');p=p.map(q=>q.div(b[0]));}else p=mul(p,b);}else if(t==='('||t===variable||/^\d/.test(t||''))p=mul(p,unary());else break;}return p;}
  function sum(){let p=product();while(ts[i]==='+'||ts[i]==='-'){const op=ts[i++],b=product();p=add(p,op==='+'?b:neg(b));}return p;}
  const p=sum();if(i!==ts.length)throw Error('Unexpected token or unsupported notation');return p;
}
export function format(p,v='x'){
  p=trim([...p]);let s='';for(let i=p.length-1;i>=0;i--){const q=p[i];if(!q.n)continue;const minus=q.n<0n, a=new Q(abs(q.n),q.d);s+=(s?(minus?' - ':' + '):(minus?'-':''))+(i?(a.eq(O())?'':a.toString()+'*')+v+(i>1?'^'+i:''):a.toString());}return s||'0';
}
function divisors(n){n=abs(n);if(n>1000000n)throw Error('Factoring coefficient limit is 1,000,000');if(!n)return [0n];const d=[];for(let i=1n;i*i<=n;i++)if(n%i===0n){d.push(i);if(i*i!==n)d.push(n/i);}return d.sort((a,b)=>a<b?-1:1);}
function valueAt(p,r){let q=Z();for(let i=p.length-1;i>=0;i--)q=q.mul(r).add(p[i]);return q;}
function divideRoot(p,r){const q=Array.from({length:p.length-1},Z);q[q.length-1]=p.at(-1);for(let i=q.length-2;i>=0;i--)q[i]=p[i+1].add(r.mul(q[i+1]));if(!p[0].add(r.mul(q[0])).eq(Z()))throw Error('Internal factor verification failed');return trim(q);}
function factor(poly,v){
  const original=poly;let p=[...poly];if(p.length<2)return {answer:format(p,v),steps:['This expression is constant.']};
  let commonDen=1n;for(const q of p)commonDen=commonDen/gcd(commonDen,q.d)*q.d;
  let g=0n;for(const q of p)g=gcdRaw(g,q.n*(commonDen/q.d));if(p.at(-1).n<0n)g=-g;
  const common=new Q(g,commonDen);p=p.map(q=>q.div(common));let zeros=0;while(p.length>1&&!p[0].n){p.shift();zeros++;}
  const roots=[];let budget=0;
  while(p.length>1){let root=null;const nums=divisors(p[0].n),dens=divisors(p.at(-1).n);outer:for(const n of nums)for(const d of dens)for(const sign of [1n,-1n]){if(++budget>5000)throw Error('Factoring search limit; use guided manual work');const r=new Q(n*sign,d);if(!valueAt(p,r).n){root=r;break outer;}}if(root===null)break;roots.push(root);p=divideRoot(p,root);}
  if(p.length>3)return {status:'unsupported',reason:'Remaining polynomial needs factoring beyond rational roots and quadratics.'};
  let remainingIrreducible=false;
  if(p.length===3){const disc=p[1].mul(p[1]).sub(new Q(4).mul(p[2]).mul(p[0]));if(disc.n>=0n)return {status:'unsupported',reason:'Remaining quadratic needs irrational factors; radical factoring is not implemented.'};remainingIrreducible=true;}
  let parts=[];let scalar=common;
  for(const r of roots){parts.push(`(${r.d===1n?'':r.d+'*'}${v}${r.n<0n?' + ':' - '}${abs(r.n)})`);scalar=scalar.div(new Q(r.d));}
  if(zeros)parts.unshift(v+(zeros>1?'^'+zeros:''));
  if(p.length===1)scalar=scalar.mul(p[0]);else parts.push(`(${format(p,v)})`);
  if(!scalar.eq(O())||!parts.length)parts.unshift(scalar.toString());
  const answer=parts.join('*');const checked=parse(answer,v);if(format(checked,v)!==format(original,v))throw Error('Factor expansion verification failed');
  return {answer,steps:[`Start with ${format(original,v)}.`,`Extract common factor ${common}${zeros?` and ${v}^${zeros}`:''}.`,...roots.map(r=>`${v} = ${r} is a root; divide by (${v} - (${r})).`),remainingIrreducible?'The remaining quadratic has negative discriminant and no real linear factors.':'All remaining factors are linear or constant.','Expand the result to verify the original polynomial.']};
}
function gcdRaw(a,b){a=abs(a);b=abs(b);while(b)[a,b]=[b,a%b];return a;}
export function latex(s){return s.replace(/(-?)(\d+)\/(\d+)/g,'$1\\frac{$2}{$3}').replace(/\*/g,'\\cdot ').replace(/\^(\d+)/g,'^{$1}');}
export function solve(expression,mode='factor'){
  try{
    if(!['factor','expand','simplify','equation','evaluate'].includes(mode))throw Error('Unsupported operation');
    const clean=normalize(expression),vars=[...new Set(clean.match(/[a-z]/g)||[])];if(vars.length>1)throw Error('Only one variable is supported');const v=vars[0]||'x';let result;
    if(mode==='equation'){
      const sides=clean.split('=');if(sides.length!==2)throw Error('Enter one equation with =');const p=add(parse(sides[0],v),neg(parse(sides[1],v)));
      if(p.length>2)throw Error('Only linear equations are supported');if(p.length===1)return {status:'ambiguous',reason:p[0].n?'No solution.':'Infinitely many solutions.'};
      const a=p[0].neg().div(p[1]);result={answer:a.toString(),steps:[`Move terms to one side: ${format(p,v)} = 0.`,`Divide by the coefficient ${p[1]}: ${v} = ${a}.`]};
    }else{
      const p=parse(clean,v);if(mode==='evaluate'&&p.length>1)throw Error('Numeric evaluation needs an expression without variables');
      result=mode==='factor'?factor(p,v):{answer:format(p,v),steps:['Apply parentheses and exponents, then combine like terms using exact fractions.',`Result: ${format(p,v)}.`]};
    }
    if(result.status)return result;return {status:'solved',...result,latex:latex(result.answer),verification:'Exact arithmetic; factors re-expanded before display.'};
  }catch(e){return {status:'unsupported',reason:e.message};}
}
