from pathlib import Path
import sympy as sp,random,json,subprocess,time
from sympy.parsing.sympy_parser import parse_expr
root=Path(__file__).resolve().parents[1];x=sp.Symbol('x');rng=random.Random(42819)
examples=[x**5-x**4+3*x-3,x**6-x**4+3*x**2-3,x**5+2*x**4+5*x+10,x**4+4,x**4+5*x**2+4,x**8+1,x**8+5*x**4+4,x**8+4*x**6+6*x**4+4*x**2+1]
blocks=[x,x-1,x+2,2*x-1,3*x+2,x**2+1,x**2+3,x**2+2*x+2,x**2-2,x**3+2,x**3+x+1,x**4+3,x**4+1]
for _ in range(120):
 f=sp.Integer(1);degree=0
 for _ in range(rng.randint(2,5)):
  choices=[b for b in blocks if degree+sp.degree(b,x)<=8]
  if not choices:break
  b=rng.choice(choices);f*=b;degree+=sp.degree(b,x)
 if degree<4:f*=x**4+3
 if sp.degree(f,x)>8:continue
 examples.append(sp.expand(f*rng.choice([1,-1,2,-3,sp.Rational(1,2),sp.Rational(-2,3)])))
expressions=list(dict.fromkeys(str(sp.expand(p)).replace('**','^') for p in examples))
js="import {solve} from './extension/math.js';let input='';for await(const chunk of process.stdin)input+=chunk;console.log(JSON.stringify(JSON.parse(input).map(e=>{const start=performance.now();return {expression:e,result:solve(e,'factor'),milliseconds:performance.now()-start};})));"
run=subprocess.run(['node','--input-type=module','-e',js],cwd=root/'source',input=json.dumps(expressions),text=True,capture_output=True,check=True)
results=json.loads(run.stdout);solved=0;unsupported=0
for case in results:
 source=sp.sympify(case['expression'].replace('^','**'));r=case['result']
 if r['status']!='solved':unsupported+=1;continue
 answer=parse_expr(r['answer'].replace('^','**'),evaluate=False)
 assert sp.expand(answer-source)==0,(case,'identity')
 for part in sp.Mul.make_args(answer):
  base=part.base if isinstance(part,sp.Pow) else part
  if not base.has(x):continue
  _,factors=sp.factor_list(base,x)
  assert len(factors)==1 and factors[0][1]==1,(case,'composite returned factor',str(part),factors)
 solved+=1
report={'oracle':'SymPy '+sp.__version__,'seed':42819,'independentChecks':['exact expanded identity','each returned nonconstant factor irreducible over QQ, using SymPy factor_list'],'cases':len(results),'solvedAndVerified':solved,'unsupportedWithinBounds':unsupported,'incorrectSolutions':0,'maximumSolveMilliseconds':max(c['milliseconds'] for c in results),'results':results}
(root/'evidence/sympy-oracle.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2))
