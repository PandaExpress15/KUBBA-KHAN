import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'helper'))
from solver import solve_request,Unsupported
class MixedNotation(unittest.TestCase):
 def test_ambiguous_forms_rejected(self):
  for value in ['1 1/2',r'1\frac{1}{2}',r'1 \frac{ 1 }{ 2 }',r'1\,\frac{1}{2}','sin(1 1/3*pi)']:
   with self.subTest(value=value):
    with self.assertRaisesRegex(Unsupported,'MIXED_NUMBER_NOTATION'):solve_request({'expression':value,'operation':'simplify'})
 def test_explicit_multiplication(self):
  for value in [r'2*\frac{1}{2}',r'2\cdot \frac{1}{2}','2(1/2)']:
   with self.subTest(value=value):self.assertEqual(solve_request({'expression':value,'operation':'simplify'})['answer'],'1')
if __name__=='__main__':unittest.main(verbosity=2)
