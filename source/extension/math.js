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
// Exact integer-factor search (Kronecker interpolation), bounded for UI use.
// Exhausting degree floor(n/2) is an irreducibility certificate over Q;
// reaching a work limit is NOT a certificate and must pause the solver.
function integerPrimitive(poly){
 let den=1n;for(const q of poly)den=den/gcd(den,q.d)*q.d;
 const ints=poly.map(q=>q.n*(den/q.d));let content=0n;for(const n of ints)content=gcdRaw(content,n);
 if(ints.at(-1)<0n)content=-content;
 return {p:ints.map(n=>n/content),content:new Q(content,den)};
}
function integerDivide(a,b){
 const r=[...a],q=Array(Math.max(1,a.length-b.length+1)).fill(0n);
 while(r.length>=b.length&&r.some(Boolean)){
  if(r.at(-1)%b.at(-1))return null;
  const c=r.at(-1)/b.at(-1),k=r.length-b.length;q[k]=c;
  for(let j=0;j<b.length;j++)r[j+k]-=c*b[j];
  while(r.length>1&&!r.at(-1))r.pop();
 }
 return r.some(Boolean)?null:q;
}
function interpolationBasis(points){
 const basis=[];let denominator=1n;
 for(let i=0;i<points.length;i++){
  let p=[O()],d=1n;
  for(let j=0;j<points.length;j++)if(i!==j){p=mul(p,[new Q(-points[j]),O()]);d*=points[i]-points[j];}
  p=p.map(c=>c.div(new Q(d)));basis.push(p);for(const c of p)denominator=denominator/gcd(denominator,c.d)*c.d;
 }
 return {denominator,basis:basis.map(p=>p.map(c=>c.n*(denominator/c.d)))};
}
function certifiedIntegerFactors(p,work,proofs){
 if(p.length<=2)return [p];
 // Eisenstein is a sufficient exact certificate, never a numerical test.
 for(const prime of [2n,3n,5n,7n,11n,13n,17n,19n,23n,29n,31n,37n,41n,43n,47n,53n,59n,61n,67n,71n,73n,79n,83n,89n,97n]){
  if(p.at(-1)%prime&&p[0]%(prime*prime)&&p.slice(0,-1).every(n=>n%prime===0n)){
   proofs.push(`An irreducible rational factor is certified by Eisenstein with prime ${prime}.`);return [p];
  }
 }
 const samples=[];
 for(const x of [0n,1n,-1n,2n,-2n,3n,-3n,4n,-4n]){
  let value=0n;for(let i=p.length-1;i>=0;i--)value=value*x+p[i];
  if(!value||abs(value)>1000000n)continue;
  const positive=divisors(value);samples.push({x,positive,values:positive.flatMap(n=>[n,-n])});
 }
 samples.sort((a,b)=>a.values.length-b.values.length||Number(abs(a.x)-abs(b.x))||Number(a.x-b.x));
 const maxDegree=Math.floor((p.length-1)/2);
 for(let degree=1;degree<=maxDegree;degree++){
  if(samples.length<degree+1)throw Error('Exact factoring needs more bounded interpolation points; unsupported within the local work limit.');
  const selected=samples.slice(0,degree+1),{denominator,basis}=interpolationBasis(selected.map(s=>s.x));
  const sum=Array(degree+1).fill(0n);let found=null;
  function visit(index){
   if(index===selected.length){
    if(++work.candidates>20000)throw Error('Exact factoring search limit (20,000 candidates); no complete factorization claimed.');
    if(sum.some(n=>n%denominator))return;
    let candidate=sum.map(n=>n/denominator);while(candidate.length>1&&!candidate.at(-1))candidate.pop();
    if(candidate.length<=1||candidate.length>=p.length)return;
    let content=0n;for(const n of candidate)content=gcdRaw(content,n);
    if(candidate.at(-1)<0n)content=-content;candidate=candidate.map(n=>n/content);
    if(p.at(-1)%candidate.at(-1))return;
    const q=integerDivide(p,candidate);if(q)found=[candidate,q];return;
   }
   // Multiplying a factor by -1 changes none of its divisibility properties;
   // fix its first sampled value positive to avoid duplicate sign searches.
   for(const value of index?selected[index].values:selected[index].positive){
    for(let j=0;j<sum.length;j++)sum[j]+=value*basis[index][j];
    visit(index+1);
    for(let j=0;j<sum.length;j++)sum[j]-=value*basis[index][j];
    if(found)return;
   }
  }
  visit(0);
  if(found)return found.flatMap(f=>certifiedIntegerFactors(f,work,proofs));
 }
 proofs.push(`An irreducible rational factor is certified by exhaustive integer-factor interpolation through degree ${maxDegree}.`);
 return [p];
}

function factor(poly,v){
  const original=poly;let p=[...poly];if(p.length<2)return {answer:format(p,v),steps:['This expression is constant.']};
  let commonDen=1n;for(const q of p)commonDen=commonDen/gcd(commonDen,q.d)*q.d;
  let g=0n;for(const q of p)g=gcdRaw(g,q.n*(commonDen/q.d));if(p.at(-1).n<0n)g=-g;
  const common=new Q(g,commonDen);p=p.map(q=>q.div(common));let zeros=0;while(p.length>1&&!p[0].n){p.shift();zeros++;}
  const roots=[];let budget=0;
  while(p.length>1){let root=null;const nums=divisors(p[0].n),dens=divisors(p.at(-1).n);outer:for(const n of nums)for(const d of dens)for(const sign of [1n,-1n]){if(++budget>5000)throw Error('Factoring search limit; use guided manual work');const r=new Q(n*sign,d);if(!valueAt(p,r).n){root=r;break outer;}}if(root===null)break;roots.push(root);p=divideRoot(p,root);}
  let higherFactors=null,certificates=[];
  if(p.length>3){
   if(original.length<=4)return {status:'unsupported',reason:'Remaining cubic needs irrational factors; radical factoring is not implemented.'};
   const primitive=integerPrimitive(p),work={candidates:0};
   higherFactors={content:primitive.content,polys:certifiedIntegerFactors(primitive.p,work,certificates),candidates:work.candidates};
  }
  let remainingIrreducible=false;
  if(p.length===3){const disc=p[1].mul(p[1]).sub(new Q(4).mul(p[2]).mul(p[0]));if(disc.n>=0n)return {status:'unsupported',reason:'Remaining quadratic needs irrational factors; radical factoring is not implemented.'};remainingIrreducible=true;}
  let parts=[];let scalar=common;
  for(const r of roots){parts.push(`(${r.d===1n?'':r.d+'*'}${v}${r.n<0n?' + ':' - '}${abs(r.n)})`);scalar=scalar.div(new Q(r.d));}
  if(zeros)parts.unshift(v+(zeros>1?'^'+zeros:''));
  if(higherFactors){scalar=scalar.mul(higherFactors.content);for(const f of higherFactors.polys)parts.push(`(${format(f.map(n=>new Q(n)),v)})`);}
  else if(p.length===1)scalar=scalar.mul(p[0]);else parts.push(`(${format(p,v)})`);
  if(!scalar.eq(O())||!parts.length)parts.unshift(scalar.toString());
  const answer=parts.join('*');const checked=parse(answer,v);if(format(checked,v)!==format(original,v))throw Error('Factor expansion verification failed');
  return {answer,steps:[`Start with ${format(original,v)}.`,`Extract common factor ${common}${zeros?` and ${v}^${zeros}`:''}.`,...roots.map(r=>`${v} = ${r} is a root; divide by (${v} - (${r})).`),higherFactors?`All remaining factors are certified irreducible over the rational numbers (${higherFactors.candidates} bounded interpolation candidates).`:remainingIrreducible?'The remaining quadratic has negative discriminant and no real linear factors.':'All remaining factors are linear or constant.',...certificates,'Expand the result to verify the original polynomial.'],...(higherFactors?{factorDomain:'rational',factorizationCandidates:higherFactors.candidates}:{})};
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
