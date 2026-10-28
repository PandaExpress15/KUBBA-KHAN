import sys,json,time
from fractions import Fraction as F
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'helper'))
from task_solver import solve_task,verify_task
from solver import Unsupported
start=time.monotonic();counts={"fractionalCompletingSquare":0,"rationalRootDomains":0,"negativeOddPowers":0,"averageRates":0}
def t(kind,**kw):return {"schema":"kubla-task-v1","task":kind,**kw}
for a in [F(1,2),F(2,3),F(3),F(-2)]:
 for b in [F(-5,3),F(1),F(7,2)]:
  for c in [F(-1,4),F(0),F(13,7)]:
   task=t("complete-square",expression=f"({a})*x^2+({b})*x+({c})",givens={"template":"{a}*(x+{s})^2+{k}"},slots=[{"id":"a","role":"coefficient"},{"id":"s","role":"shift"},{"id":"k","role":"constant"}]);answer=solve_task(task)["answer"]
   got={k:F(v.replace(" ","")) for k,v in answer["fields"].items()};expected={"a":a,"s":b/(2*a),"k":c-b*b/(4*a)};assert got==expected,(task,got,expected)
   assert verify_task({"task":task,"answer":answer,"observed":{"fields":answer["fields"]}})["equivalent"]
   counts["fractionalCompletingSquare"]+=1
values=[F(-2),F(0),F(1,2),F(3)]
for r1 in values:
 for r2 in values:
  for excluded in [F(0),r1]:
   expr=f"(x-({r1}))*(x-({r2}))/(x-({excluded}))=0";answer=solve_task(t("equation",expression=expr))["answer"]
   got={F(v.replace(" ","")) for v in answer["values"]};assert got=={r1,r2}-{excluded},(expr,answer)
   counts["rationalRootDomains"]+=1
for n in [-5,-3,-2,-1,1,2,3,5]:
 for exponent in [1,2,-1]:
  result=solve_task(t("evaluate",expression=f"({n**3})^({exponent}/3)"))["answer"]
  assert F(result["value"].replace(" ",""))==F(n)**exponent,(n,exponent,result)
  counts["negativeOddPowers"]+=1
for left,right in [(-2,2),(-1,2),(0,1),(-2,-1)]:
 points=[[str(x),str(x*x)] for x in range(-2,3)]
 result=solve_task(t("average-rate",givens={"points":points,"interval":[str(left),str(right)]}))["answer"]
 assert F(result["value"].replace(" ",""))==F(right*right-left*left,right-left)
 counts["averageRates"]+=1
out={"pass":True,"oracle":"Python Fraction arithmetic; expected values independent of SymPy and helper parser", "counts":counts,"seconds":round(time.monotonic()-start,3),"actualLanguageModelInference":False}
Path(__file__).resolve().parents[1].joinpath('evidence', 'root-independent-math.json').write_text(json.dumps(out,indent=2)+"\n");print(json.dumps(out))
