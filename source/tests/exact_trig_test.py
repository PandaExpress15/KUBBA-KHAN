"""Exact trigonometric syntax, domains and independent original recomputation."""
import math,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'helper'))
from solver import parse_expression,solve_request,verify_request,Unsupported
class ExactTrig(unittest.TestCase):
 def check(self,expression,expected,operation='evaluate'):
  result=solve_request({'expression':expression,'operation':operation})
  self.assertEqual(parse_expression(result['answer']),parse_expression(expected),expression)
  self.assertTrue(verify_request({'expression':expression,'operation':operation,'answer':result['answer'],'observed':result['latex']})['equivalent'])
  return result
 def test_reciprocal_trig_known_values(self):
  for expression,expected in [('sec(pi/3)','2'),('csc(pi/6)','2'),('cot(pi/4)','1'),('sec(pi/6)','2sqrt(3)/3'),('csc(pi/4)','sqrt(2)'),('cot(pi/6)','sqrt(3)'),('cot(-pi/4)','-1'),('sec(pi)','-1'),('csc(3pi/2)','-1')]:
   with self.subTest(expression=expression):self.check(expression,expected)
 def test_standard_circle_against_independent_python_math(self):
  for fn in ['sin','cos','tan','sec','csc','cot']:
   for n in range(-12,13):
    angle=n*math.pi/6
    denominator=math.cos(angle) if fn in ('tan','sec') else math.sin(angle) if fn in ('csc','cot') else 1
    expression=f'{fn}({n}pi/6)'
    if abs(denominator)<1e-12:
     with self.assertRaises(Unsupported):solve_request({'expression':expression,'operation':'evaluate'})
     continue
    expected={'sin':lambda:math.sin(angle),'cos':lambda:math.cos(angle),'tan':lambda:math.tan(angle),'sec':lambda:1/math.cos(angle),'csc':lambda:1/math.sin(angle),'cot':lambda:math.cos(angle)/math.sin(angle)}[fn]()
    result=solve_request({'expression':expression,'operation':'evaluate'})
    self.assertAlmostEqual(float(parse_expression(result['answer'])),expected,places=10, msg=expression)
 def test_inverse_principal_real_values(self):
  for expression,expected in [('asin(1/2)','pi/6'),('acos(-1/2)','2pi/3'),('atan(1)','pi/4'),('asin(-1)','-pi/2'),('acos(1)','0'),('atan(-sqrt(3))','-pi/3'),('arcsin(1/2)','pi/6'),(r'\arccos(0)','pi/2'),(r'\sin^{-1}(1/2)','pi/6'),('cos^(-1)(1/2)','pi/3'),('tan^-1(1)','pi/4')]:
   with self.subTest(expression=expression):self.check(expression,expected)
 def test_explicit_degrees(self):
  for expression,expected in [('sin(30°)','1/2'),('cos(60°)','1/2'),('tan(45°)','1'),('sec(60°)','2'),('csc(-30°)','-2'),('cot(135°)','-1'),(r'\sin(30^{\circ})','1/2'),(r'cos(60^\circ)','1/2'),('sin 30°','1/2'),(r'\sin30^{\circ}','1/2'),('cos -60°','1/2'),('sin((30+60)°)','1')]:
   with self.subTest(expression=expression):self.check(expression,expected)
 def test_delimited_tex_fraction_argument(self):
  self.check(r'\sin\frac{\pi}{6}','1/2');self.check(r'\cos\frac{\pi}{3}','1/2');self.check(r'\cot\frac{\pi}{4}','1')
 def test_function_power_is_not_argument_power(self):
  self.check(r'\sin^{2}(x)+\cos^{2}(x)','1','simplify')
  self.check('sec^2(x)-tan^2(x)','1','simplify')
  self.check('csc(x)^2-cot(x)^2','1','simplify')
  self.assertNotEqual(parse_expression('sin^2(x)'),parse_expression('sin(x^2)'))
  self.assertNotEqual(parse_expression('sin^-1(1/2)'),parse_expression('(sin(1/2))^-1'))
 def test_radians_are_never_inferred_as_degrees(self):
  rad=parse_expression('sin(30)');deg=parse_expression('sin(30°)')
  self.assertNotEqual(rad,deg);self.assertAlmostEqual(float(rad),math.sin(30),places=12)
  for ambiguous in ['sin 30','sin 2x','sin pi/6','cos x+1','asin 1/2','30°°']:
   with self.subTest(expression=ambiguous),self.assertRaises(Unsupported):parse_expression(ambiguous)
 def test_invalid_domains_and_poles(self):
  for expression in ['asin(2)','acos(-2)','asin(sqrt(-1))','tan(pi/2)','sec(pi/2)','csc(0)','cot(pi)','sin(x+y)','sin^13(x)','sin^(1/2)(x)']:
   with self.subTest(expression=expression),self.assertRaises(Unsupported):solve_request({'expression':expression,'operation':'evaluate'})
 def test_proposal_cannot_validate_itself(self):
  for request in [
   {'expression':'sec(pi/3)','operation':'evaluate','answer':'3','observed':'3'},
   {'expression':'sin(30)','operation':'evaluate','answer':'1/2','observed':'1/2'},
   {'expression':'asin(1/2)','operation':'evaluate','answer':'5pi/6','observed':'5pi/6'},
   {'expression':'sin^2(x)+cos^2(x)','operation':'simplify','answer':'1','observed':'0'}]:
   self.assertFalse(verify_request(request)['equivalent'])
 def test_nonnumeric_trig_evaluation_is_not_claimed(self):
  with self.assertRaises(Unsupported):solve_request({'expression':'sec(x)','operation':'evaluate'})
 def test_principal_branch_not_globally_cancelled(self):
  self.check('asin(sin(3pi/4))','pi/4')
  self.assertFalse(verify_request({'expression':'asin(sin(x))','operation':'simplify','answer':'x','observed':'x'})['equivalent'])
 def test_unknown_identifiers_and_executable_text_stay_rejected(self):
  for expression in [r'\operatorname{system}(1)','__import__(os)','sin.__class__','eval(1)','atan2(1,2)','sin(1);open(x)','f(x)','sin[30]']:
   with self.subTest(expression=expression),self.assertRaises(Unsupported):parse_expression(expression)
if __name__=='__main__':unittest.main(verbosity=2)
