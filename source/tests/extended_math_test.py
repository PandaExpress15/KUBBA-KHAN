import copy,sys,unittest
from collections import Counter
from fractions import Fraction
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'helper'))
from solver import Unsupported,parse_expression
from task_solver import solve_task,verify_task,validate_document_binding
from task_extensions import compare_task_option

def task(kind,**values):return {'schema':'kubla-task-v1','task':kind,'slots':[{'id':'s0','role':'answer'}],**values}
def answer(t):return solve_task(t)['answer']
def verify(t,a,value):return verify_task({'task':t,'answer':a,'observed':{'fields':{'s0':value}}})['equivalent']
def option(t,value,expression=None):return compare_task_option(t,{'index':0,'text':value,**({'expression':expression} if expression is not None else {})})
def poly(roots):return '*'.join('(x-('+str(v)+'))' for v in roots) or '1'
def feature(n,d,f,**values):return task('rational-analysis',givens={'numerator':n,'denominator':d,'feature':f},**values)
class ExtendedMathTests(unittest.TestCase):
 def test_affine_inverse_independent_fraction_matrix(self):
  # Python Fraction is an independent arithmetic oracle for inverse coefficients.
  import sympy as s
  x=s.Symbol('x',real=True)
  for a in range(-4,5):
   if not a:continue
   for b in range(-3,4):
    t=task('inverse-affine',expression=f'({a})*x+({b})');result=answer(t)
    value=parse_expression(result['value'])
    self.assertEqual(value.coeff(x),s.Rational(Fraction(1,a).numerator,Fraction(1,a).denominator))
    self.assertEqual(value.subs(x,0),s.Rational(Fraction(-b,a).numerator,Fraction(-b,a).denominator))
    self.assertTrue(verify(t,result,result['fields']['s0']))
  with self.assertRaises(Unsupported):answer(task('inverse-affine',expression='x^2'))
 def test_inverse_table_bijection_and_target(self):
  t=task('inverse-table',givens={'points':[['-1','4'],['0','3'],['2','1']],'target':'1'})
  self.assertEqual(answer(t)['value'],'2')
  for rows,target in [([['0','1'],['0','2']],'1'),([['0','1'],['2','1']],'1'),([['0','1'],['2','3']],'4')]:
   with self.assertRaises(Unsupported):answer(task('inverse-table',givens={'points':rows,'target':target}))
 def test_rational_zeros_poles_holes_independent_multiplicities(self):
  for left in range(-2,3):
   for right in range(-2,3):
    nroots=[left,1];droots=[right,1,1]
    nc,dc=Counter(nroots),Counter(droots)
    zeros=sorted(v for v in nc if v not in dc)
    poles=sorted(v for v in dc if dc[v]>nc[v])
    holes=sorted(v for v in dc if dc[v]<=nc[v])
    for f,expected in [('zeros',zeros),('poles',poles),('holes',holes)]:
     t=feature(poly(nroots),poly(droots),f,output={'form':'x-values'} if f=='holes' else {})
     a=answer(t);self.assertEqual(set(a['values']),set(map(str,expected)),(nroots,droots,f));self.assertTrue(verify(t,a,a['fields']['s0']))
 def test_rational_hole_coordinates(self):
  t=feature('x^2-1','x-1','holes',output={'form':'points'});a=answer(t)
  self.assertTrue(verify(t,a,a['latexFields']['s0']));self.assertEqual(a['points'],[['1','2']]);self.assertTrue(verify(t,a,'{(1,2)}'));self.assertFalse(verify(t,a,'{(1,0)}'))
  self.assertEqual(answer(feature('x-1','(x-1)^2','poles'))['values'],['1'])
  self.assertEqual(answer(feature('x-1','(x-1)^2','holes',output={'form':'points'}))['points'],[])
 def test_asymptotes_and_end_behavior(self):
  for n,d,f,expected in [('2*x+1','x-3','horizontal-asymptote','2'),('x+1','x^2+1','horizontal-asymptote','0'),('x^2+x+1','x-1','slant-asymptote','x + 2')]:
   t=feature(n,d,f);a=answer(t);self.assertEqual(a['value'],expected);self.assertTrue(verify(t,a,a['fields']['s0']))
  t=feature('x^2+1','x-1','horizontal-asymptote');a=answer(t);self.assertEqual(a['kind'],'claim');self.assertTrue(verify(t,a,'No horizontal asymptote'))
  for n,d,f,expected in [('x^3','x+1','end-positive','positive-infinity'),('x^3','x+1','end-negative','positive-infinity'),('-x^2','x+1','end-positive','negative-infinity'),('-x^2','x+1','end-negative','positive-infinity')]:
   t=feature(n,d,f);a=answer(t);self.assertEqual(a['value'],expected);self.assertTrue(verify(t,a,a['fields']['s0']));self.assertTrue(verify(t,a,a['latexFields']['s0']))
 def test_first_incorrect_step_and_carried_domain(self):
  cases=[(['x^2-1','(x-1)*(x+1)','x^2+1'],'3'),(['x^2','x^3/x'],'2'),(['x^2=x','x=1'],'2'),(['x^2/x=0','x=0'],'No error'),(['x^3/x','x^2'],'No error'),(['x+1=x','1=0'],'No error')]
  for steps,expected in cases:
   t=task('error-analysis',givens={'steps':steps});a=answer(t);self.assertEqual(a['fields']['s0'],expected,steps);self.assertTrue(verify(t,a,expected))
  with self.assertRaises(Unsupported):answer(task('error-analysis',givens={'steps':['sin(x)^2+cos(x)^2','1']}))
 def test_tri_state_semantic_step_options(self):
  t=task('error-analysis',givens={'steps':['x^2-1','(x-1)^2']})
  self.assertTrue(verify(t,answer(t),'Step 2'))
  self.assertEqual((option(t,'Step 2')['interpreted'],option(t,'Step 2')['equivalent']),(True,True))
  self.assertEqual((option(t,'Line 1')['interpreted'],option(t,'Line 1')['equivalent']),(True,False))
  for unknown in ['banana','Step 2 because I think so','Step 100']:
   r=option(t,unknown);self.assertFalse(r['interpreted']);self.assertIsNone(r['equivalent'])
 def test_tri_state_finite_no_all_and_assignment_options(self):
  t=task('equation',expression='x^2=4')
  for value,equivalent in [('{2,-2}',True),('{-2,2,2}',True),('No solution',False),('All real numbers',False),('x=2',False)]:
   r=option(t,value);self.assertTrue(r['interpreted'],r);self.assertEqual(r['equivalent'],equivalent)
  t=feature('x+1','x-2','poles')
  self.assertTrue(option(t,'x=2')['equivalent']);self.assertFalse(option(t,'x=1')['equivalent'])
  t=feature('2*x+1','x-3','horizontal-asymptote')
  self.assertTrue(option(t,'y=2')['equivalent']);self.assertFalse(option(t,'y=3')['equivalent']);self.assertFalse(option(t,'x=2')['interpreted'])
 def test_unknown_and_contradictory_option_text(self):
  t=task('evaluate',expression='2+2')
  for text_,expression in [('NOT 4','4'),('greater than 4','4'),('5','3')]:
   r=option(t,text_,expression);self.assertFalse(r['interpreted']);self.assertIsNone(r['equivalent'])
  self.assertTrue(option(t,'2+2','4')['equivalent'])
 def test_factor_option_form_is_not_source_interpretability(self):
  t=task('factor',expression='x^2-1',domain='rational')
  for expression,expected in [('(x-1)(x+1)',True),('x^2-1',False),('(x-1)^2',False)]:
   result=option(t,expression,expression)
   self.assertTrue(result['interpreted'],result);self.assertEqual(result['equivalent'],expected)
  self.assertFalse(option(t,'NOT factored','x^2-1')['interpreted'])
 def test_original_document_bindings(self):
  base={'schema':'kubla-problem-v1','response':{'kind':'native','slots':[{'id':'s0','role':'answer','label':'Answer'}]},'evidence':{}}
  documents=[
   {**base,'original':{'instruction':'Find the inverse using the table.','expressions':[{'text':'f^{-1}(3)'}]},'task':task('inverse-table',givens={'points':[['1','3'],['2','5']],'target':'3'}),'evidence':{'tables':[{'points':[['1','3'],['2','5']],'exact':True}]}},
   {**base,'original':{'instruction':'Find the inverse function.','expressions':[{'text':'f(x)=2*x+3'}]},'task':task('inverse-affine',expression='2*x+3')},
   {**base,'original':{'instruction':'Find the vertical asymptote.','expressions':[{'text':'f(x)=(x+1)/(x-2)'}]},'task':feature('x+1','x-2','poles')},
   {**base,'original':{'instruction':'Find the first incorrect step.','expressions':[{'text':'x^2-1'},{'text':'(x-1)^2'}]},'task':task('error-analysis',givens={'steps':['x^2-1','(x-1)^2']}),'evidence':{'steps':[{'number':1,'expression':'x^2-1'},{'number':2,'expression':'(x-1)^2'}]}}
  ]
  for doc in documents:validate_document_binding(doc)
  bad=copy.deepcopy(documents[0]);bad['task']['givens']['target']='5'
  with self.assertRaises(Unsupported):validate_document_binding(bad)
  bad=copy.deepcopy(documents[2]);bad['task']['givens']['denominator']='x+2'
  with self.assertRaises(Unsupported):validate_document_binding(bad)
  bad=copy.deepcopy(documents[3]);bad['evidence']['steps'].reverse()
  with self.assertRaises(Unsupported):validate_document_binding(bad)
if __name__=='__main__':unittest.main()
