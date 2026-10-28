import copy,math,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'helper'))
from solver import Unsupported,solve_request,verify_request,parse_expression
from domain_math import parse_document
from task_solver import solve_task,verify_task,validate_document_binding

def task(kind,**kwargs):return {'schema':'kubla-task-v1','task':kind,**kwargs}
def run(t):return solve_task(t)['answer']
def verify(t,answer,fields):return verify_task({'task':t,'answer':answer,'observed':{'fields':fields}})['equivalent']
class TypedMathTest(unittest.TestCase):
 def test_original_ast_and_domain(self):
  doc=parse_document('x^2/x=0',True)
  self.assertEqual(doc.ast.kind,'equation');self.assertEqual(doc.ast.args[0].kind,'div')
  self.assertFalse(doc.valid({next(iter(doc.symbols)):0}))
  self.assertEqual(run(task('equation',expression='x^2/x=0'))['values'],[])
  with self.assertRaises(Unsupported):solve_request({'expression':'x^2/x=0','operation':'equation'})
  with self.assertRaises(Unsupported):verify_request({'expression':'x^2/x=0','operation':'equation','answer':'0','observed':'0'})
 def test_equation_sets(self):
  for expression,values,all_,excluded in [('x^2=4',['-2','2'],False,[]),('x+1=x',[],False,[]),('x=x',[],True,[]),('x/x=1',[],True,['0']),('1/(x-1)=2',['3/2'],False,[]),('sqrt(x+1)=x-1',['3'],False,[]),('sqrt(x)=-1',[],False,[]),('log(x,10)=2',['100'],False,[])]:
   with self.subTest(expression=expression):
    t=task('equation',expression=expression);a=run(t)
    self.assertEqual((a['values'],a['all'],a['excluded']),(values,all_,excluded));self.assertTrue(verify(t,a,a['fields']))
 def test_extraneous_incomplete_and_duplicate_roots(self):
  t=task('equation',expression='x^2=4');a=run(t)
  for observed in ('2','{-2,2,2}','{-2,3}','{-2,2,3}'):
   self.assertFalse(verify(t,a,{'answer':observed}))
  self.assertTrue(verify(t,a,{'answer':'{2,-2}'}))
  a['values']=['2'];self.assertFalse(verify(t,a,{'answer':'2'}))
 def test_rational_powers(self):
  for e,a in [('8^(2/3)','4'),('(-8)^(1/3)','-2'),('(-8)^(2/3)','4'),('16^(-1/2)','1/4'),('27^(1/3)','3')]:
   self.assertEqual(run(task('evaluate',expression=e))['value'],a)
  for e in ['(-1)^(1/2)','0^(-1/3)','2^1000000000','2^(1/13)']:
   with self.assertRaises(Unsupported):run(task('evaluate',expression=e))
 def test_log_semantics(self):
  for e,output,a in [(r'\log_{10}(100)',{},'2'),('log(100)',{'logBase':10},'2'),('ln(e)',{},'1'),('log(8,2)',{},'3')]:
   self.assertEqual(run(task('evaluate',expression=e,output=output))['value'],a)
  for e in ['log(100)','log(-1,10)','log(2,1)','ln(0)']:
   with self.assertRaises(Unsupported):run(task('evaluate',expression=e))
 def test_inverse_angle_domain(self):
  self.assertEqual(run(task('evaluate',expression='asin(1/2)',output={'angleUnit':'degrees'}))['value'],'30')
  self.assertEqual(run(task('evaluate',expression='acos(-1)',output={'angleUnit':'radians'}))['value'],'pi')
  for e in ['asin(2)','acos(-2)']:
   with self.assertRaises(Unsupported):run(task('evaluate',expression=e))
 def test_completing_square_independent_integer_matrix(self):
  # Arithmetic oracle derives coefficients directly, without invoking SymPy.
  for b in range(-8,9,2):
   for c in range(-3,4):
    t=task('complete-square',expression=f'x^2+({b})*x+({c})',givens={'template':'(x+{s})^2+{k}'},slots=[{'id':'s','role':'shift'},{'id':'k','role':'constant'}]);a=run(t)
    self.assertEqual(a['fields'],{'s':str(b//2),'k':str(c-b*b//4)})
    self.assertTrue(verify(t,a,a['fields']))
    swapped={'s':a['fields']['k'],'k':a['fields']['s']}
    if swapped!=a['fields']:self.assertFalse(verify(t,a,swapped))
  t=task('complete-square',expression='2*x^2+8*x+3',givens={'template':'{a}*(x-{v})^2+{c}'},slots=[{'id':'a','role':'coefficient'},{'id':'v','role':'vertex'},{'id':'c','role':'constant'}])
  self.assertEqual(run(t)['fields'],{'a':'2','v':'-2','c':'-5'})
  with self.assertRaises(Unsupported):run(task('complete-square',expression='2*x^2+8*x+3',givens={'template':'2*(x+{v})^2+{c}'},slots=[{'id':'v','role':'vertex'},{'id':'c','role':'constant'}]))
 def test_division_identity_and_slot_readback(self):
  t=task('divide',givens={'dividend':'x^3+2*x+1','divisor':'x+1'},slots=[{'id':'q','role':'quotient'},{'id':'r','role':'remainder'}]);a=run(t)
  self.assertEqual(a['fields'],{'q':'x^2 - x + 3','r':'-2'});self.assertTrue(verify(t,a,a['fields']))
  self.assertFalse(verify(t,a,{'q':a['fields']['q'],'r':'0'}))
 def test_rates_exact_table_and_units(self):
  for m in range(-5,6):
   t=task('rate',givens={'points':[['0','3'],['2',str(2*m+3)],['5',str(5*m+3)]]},output={'unit':'km/hour'});a=run(t)
   self.assertEqual(a['value'],str(m));self.assertEqual(a['unit'],'km/hour');self.assertTrue(verify(t,a,a['fields']))
  for p in [[[0,1],[0,2]],[[0,1],[1,2],[2,10]]]:
   with self.assertRaises(Unsupported):run(task('slope',givens={'points':p}))
 def test_point_slope_requested_form(self):
  t=task('point-slope',givens={'points':[['2','3'],['4','7']]});a=run(t)
  self.assertEqual(a['equation'],'y-(3)=(2)*(x-(2))');self.assertTrue(verify(t,a,a['fields']))
  self.assertFalse(verify(t,a,{'answer':'y=2*x-1'}))
 def test_factor_form_and_domain(self):
  t=task('factor',expression='x^5-x^4+3*x-3',domain='rational');a=run(t)
  self.assertTrue(verify(t,a,a['fields']));self.assertFalse(verify(t,a,{'answer':'x^5-x^4+3*x-3'}))
  with self.assertRaises(Unsupported):run(task('factor',expression='x^2-2',domain='real'))
 def test_semantic_binding(self):
  d={'schema':'kubla-problem-v1','original':{'instruction':'Solve the equation','expressions':[{'text':'x^2=4'}]},'task':task('equation',expression='x^2=4')}
  self.assertEqual(validate_document_binding(d),d['task'])
  for replacement in ['x^2=9','x^2/x=0']:
   bad=copy.deepcopy(d);bad['task']['expression']=replacement
   with self.assertRaises(Unsupported):validate_document_binding(bad)
  bad=copy.deepcopy(d);bad['original']['instruction']='A model says solve'
  # A directive may mention solve, but unchanged original expression remains compulsory.
  bad['task']['expression']='100=100'
  with self.assertRaises(Unsupported):validate_document_binding(bad)
 def test_denominator_exclusions_independent_root_matrix(self):
  for first in range(-3,4):
   for second in range(-3,4):
    expression=f'(x^2-({first+second})*x+({first*second}))/(x-({first}))=0'
    result=run(task('equation',expression=expression))
    self.assertEqual(result['values'],[] if first==second else [str(second)],expression)
 def test_rounding_and_template_signs(self):
  for expression,places,expected in [('sqrt(2)',2,'1.41'),('1/8',2,'0.13'),('-1/8',2,'-0.13'),('2/3',3,'0.667')]:
   t=task('evaluate',expression=expression,output={'decimalPlaces':places});answer=run(t)
   self.assertEqual(answer['value'],expected);self.assertTrue(verify(t,answer,answer['fields']))
  bad=task('complete-square',expression='x^2+6*x+2',givens={'template':'(x-{s})^2+{k}'},slots=[{'id':'s','role':'shift'},{'id':'k','role':'constant'}])
  with self.assertRaises(Unsupported):run(bad)
  good=copy.deepcopy(bad);good['slots'][0]['role']='vertex'
  self.assertEqual(run(good)['fields'],{'s':'-3','k':'-7'})
 def test_candidate_domains_and_variables(self):
  for kind,expression,observed in [('evaluate','1','x/x'),('simplify','x^2','x^3/x'),('factor','x^2-1','(x-1)*(x+1)*x/x')]:
   t=task(kind,expression=expression);a=run(t)
   self.assertFalse(verify(t,a,{'answer':observed}),(expression,observed))
   self.assertFalse(verify_request({'expression':expression,'operation':kind,'answer':a['fields']['answer'],'observed':observed})['equivalent'])
  t=task('simplify',expression='x^3/x');a=run(t)
  self.assertTrue(verify(t,a,{'answer':'x^2'}))
  self.assertEqual(a['value'],'x^2')
  self.assertFalse(verify(t,a,{'answer':'x^2*(x-1)/(x-1)'}))
 def test_average_rate_and_given_slope(self):
  t=task('average-rate',givens={'points':[['0','0'],['1','1'],['2','4']],'interval':['0','2']})
  self.assertEqual(run(t)['value'],'2')
  with self.assertRaises(Unsupported):run(task('average-rate',givens={'points':[['0','0'],['1','1'],['2','4']]}))
  t=task('point-slope',givens={'points':[['2','3']],'slope':'4'})
  self.assertEqual(run(t)['equation'],'y-(3)=(4)*(x-(2))')
 def test_platform_log_convention_binding(self):
  d={'schema':'kubla-problem-v1','url':'https://classroom.khanacademy.org/learner/class/test','notation':{'logConvention':'khan-kas-common'},'original':{'instruction':'Evaluate','expressions':[{'text':'log(100)'}]},'task':task('evaluate',expression='log(100)',output={'logBase':10})}
  validate_document_binding(d);self.assertEqual(run(d['task'])['value'],'2')
  for url in ['https://evil.invalid/','https://classroom.khanacademy.org.evil.invalid/','http://classroom.khanacademy.org/']:
   bad=copy.deepcopy(d);bad['url']=url
   with self.assertRaises(Unsupported):validate_document_binding(bad)
  self.assertEqual(run(task('evaluate',expression='log(8,2)',output={'logBase':10}))['value'],'3')
  self.assertNotEqual(run(task('evaluate',expression='ln(100)',output={'logBase':10}))['value'],'2')
 def test_natural_log_editor_roundtrip(self):
  for expression,kind in [('ln(x)','simplify'),('ln(100)','evaluate'),('log(x,10)','simplify')]:
   t=task(kind,expression=expression);a=run(t);tex=a['latexFields']['answer']
   self.assertNotIn(r'\log',tex);self.assertIn(r'\ln',tex)
   self.assertTrue(verify(t,a,{'answer':tex}))
   legacy=solve_request({'expression':expression,'operation':kind})
   self.assertNotIn(r'\log',legacy['latex'])
  self.assertEqual(run(task('evaluate',expression='exp(ln(3))'))['value'],'3')
 def test_completing_square_function_definition_and_literal_coefficient(self):
  for definition,expression,template,fields in [('f(x)=x^2+6*x+5','x^2+6*x+5','(x+{s0})^2+{s1}',{'s0':'3','s1':'-4'}),('y=2*x^2+8*x+3','2*x^2+8*x+3','2*(x+{s0})^2+{s1}',{'s0':'2','s1':'-5'})]:
   t=task('complete-square',expression=expression,givens={'template':template},slots=[{'id':'s0','role':'shift'},{'id':'s1','role':'constant'}])
   doc={'schema':'kubla-problem-v1','original':{'instruction':'Complete the square.','expressions':[{'text':definition}]},'task':t,'response':{'kind':'fields','slots':[{'id':'s0','role':'shift','template':template},{'id':'s1','role':'constant','template':template}]}}
   validate_document_binding(doc);result=run(t);self.assertEqual(result['fields'],fields);self.assertTrue(verify(t,result,fields))
   wrong=copy.deepcopy(t);wrong['givens']['template']='3*(x+{s0})^2+{s1}'
   with self.assertRaises(Unsupported):run(wrong)
   for bad_definition in ['wrong '+definition,'f(z)='+expression,'x+f(x)='+expression]:
    altered=copy.deepcopy(doc);altered['original']['expressions'][0]['text']=bad_definition
    with self.assertRaises(Unsupported):validate_document_binding(altered)
 def test_inverse_power_degree_output_ast_and_outer_division_binding(self):
  for expression,expected in [(r'\sin^{-1}(1/2)','30'),('sin^-1(1/2)','30'),(r'\cos^{-1}(1/2)','60'),(r'\tan^{-1}(1)','45')]:
   result=run(task('evaluate',expression=expression,output={'angleUnit':'degrees'}));self.assertEqual(result['value'],expected)
  with self.assertRaises(Unsupported):run(task('evaluate',expression='sin(1/2)',output={'angleUnit':'degrees'}))
  t=task('divide',expression=r'\frac{x^3-1}{x-1}',givens={'dividend':'x^3-1','divisor':'x-1'},slots=[{'id':'q','role':'quotient'},{'id':'r','role':'remainder'}])
  doc={'schema':'kubla-problem-v1','original':{'instruction':'Divide the polynomials.','expressions':[{'text':t['expression']}]},'task':t,'response':{'kind':'fields','slots':[{'id':'q','role':'quotient'},{'id':'r','role':'remainder'}]}}
  validate_document_binding(doc);self.assertEqual(run(t)['fields'],{'q':'x^2 + x + 1','r':'0'})
  wrong=copy.deepcopy(doc);wrong['task']['givens']['divisor']='x+1'
  with self.assertRaises(Unsupported):validate_document_binding(wrong)
 def test_parser_attack_and_bounds(self):
  for e in ["__import__('os')",'x.__class__','open(1)','sin(1,2)','1;2','x+y',"2^"+'9'*50]:
   with self.subTest(expression=e),self.assertRaises((Unsupported,ValueError)):parse_expression(e)
if __name__=='__main__':unittest.main()
