import sys,ast,json,time
from fractions import Fraction as F
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'helper'))
from task_solver import solve_task
from solver import Unsupported
start=time.monotonic();counts={'rationalFeatures':0,'affineInverses':0,'inverseTables':0,'firstInvalidSteps':0}
def task(kind,**kw):return {'schema':'kubla-task-v1','task':kind,**kw}
def run(t):return solve_task(t)['answer']
def affine(source):
 def w(n):
  if isinstance(n,ast.Constant) and type(n.value) is int:return F(n.value),F(0)
  if isinstance(n,ast.Name) and n.id=='x':return F(0),F(1)
  if isinstance(n,ast.UnaryOp) and isinstance(n.op,(ast.USub,ast.UAdd)):
   a=w(n.operand);return tuple(-x for x in a) if isinstance(n.op,ast.USub) else a
  if isinstance(n,ast.BinOp):
   a,b=w(n.left),w(n.right)
   if isinstance(n.op,ast.Add):return a[0]+b[0],a[1]+b[1]
   if isinstance(n.op,ast.Sub):return a[0]-b[0],a[1]-b[1]
   if isinstance(n.op,ast.Mult):
    assert not a[1]*b[1];return a[0]*b[0],a[0]*b[1]+a[1]*b[0]
   if isinstance(n.op,ast.Div):assert b[1]==0 and b[0]!=0;return a[0]/b[0],a[1]/b[0]
  raise AssertionError(('non-affine-output',ast.dump(n)))
 return w(ast.parse(source,mode='eval').body)
for a,b,c in [(F(-2),F(1),F(3)),(F(0),F(2),F(-1)),(F(1,2),F(-1),F(3))]:
 for k,m in [(F(1),F(1)),(F(-3),F(2)),(F(2),F(-5))]:
  givens={'numerator':f'({k})*(x-({a}))*(x-({b}))','denominator':f'({m})*(x-({a}))*(x-({c}))'}
  for feature,want in [('zeros',{b}),('poles',{c})]:
   ans=run(task('rational-analysis',givens={**givens,'feature':feature}));assert {F(v) for v in ans['values']}==want;counts['rationalFeatures']+=1
  ans=run(task('rational-analysis',givens={**givens,'feature':'holes'},output={'form':'points'}));assert len(ans['points'])==1;assert [F(v) for v in ans['points'][0]]==[a,k/m*(a-b)/(a-c)];counts['rationalFeatures']+=1
  for feature in ['horizontal-asymptote','end-positive','end-negative']:
   ans=run(task('rational-analysis',givens={**givens,'feature':feature}));assert F(ans['value'])==k/m;counts['rationalFeatures']+=1
for a in [F(-3),F(1,2),F(2)]:
 for b in [F(-4,3),F(0),F(5)]:
  ans=run(task('inverse-affine',expression=f'({a})*x+({b})'));assert affine(ans['value'])==(-b/a,1/a);counts['affineInverses']+=1
points=[[str(x),str(x**3+2)] for x in range(-3,4)]
for x,y in points:
 ans=run(task('inverse-table',givens={'points':points,'target':y}));assert F(ans['value'])==F(x);counts['inverseTables']+=1
for a in [-2,0,3]:
 for b in [-1,1,4]:
  steps=[f'(x-({a}))*(x-({b}))',f'x^2-({a+b})*x+({a*b})',f'x^2-({a+b})*x+({a*b+1})']
  ans=run(task('error-analysis',givens={'steps':steps}));assert ans['value']=='3';counts['firstInvalidSteps']+=1
result={'pass':True,'oracle':'independent Python Fraction identities and restricted Python AST affine parser; no eval or SymPy oracle','counts':counts,'seconds':round(time.monotonic()-start,3),'actualLanguageModelInference':False}
Path(__file__).resolve().parents[1].joinpath('evidence', 'root-extended-math-oracle.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
