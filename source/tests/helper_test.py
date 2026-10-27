"""Exact-parser and real-loopback-service checks; no mocked solver/network."""
import http.client,json,os,subprocess,sys,tempfile,threading,time,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'helper'))
from solver import solve_request,verify_request,parse_expression,Unsupported
from server import Server
import server as solver_server
ORIGIN='chrome-extension://'+'a'*32
TOKEN='a'*64
class ExactMath(unittest.TestCase):
 def test_exact_solutions(self):
  for expression,operation,answer in [('sqrt(8)','simplify','2*sqrt(2)'),(r'\sqrt{8}','simplify','2*sqrt(2)'),('sin(pi/5)','evaluate','sqrt(10 - 2*sqrt(5))/4'),('(x^2-1)/(x+1)','simplify','x - 1'),('(x-3)^2=0','equation','3'),('7/3+5/6','evaluate','19/6')]:
   with self.subTest(expression=expression):
    r=solve_request({'expression':expression,'operation':operation});self.assertEqual(r['answer'],answer)
    v=verify_request({'expression':expression,'operation':operation,'answer':r['answer'],'observed':r['latex']});self.assertTrue(v['equivalent'])
 def test_degree_twelve_factors(self):
  r=solve_request({'expression':'x^12-1','operation':'factor'});self.assertEqual(r['status'],'solved')
  self.assertTrue(verify_request({'expression':'x^12-1','operation':'factor','answer':r['answer'],'observed':r['latex']})['equivalent'])
 def test_readback_requires_original_correctness_and_factored_form(self):
  self.assertFalse(verify_request({'expression':'sqrt(8)','operation':'simplify','answer':'3','observed':'3'})['equivalent'])
  self.assertFalse(verify_request({'expression':'x^2-1','operation':'factor','answer':'(x-1)(x+1)','observed':'x^2-1'})['equivalent'])
  self.assertFalse(verify_request({'expression':'sqrt(8)','operation':'simplify','answer':'2sqrt(2)','observed':'2sqrt(3)'})['equivalent'])
 def test_no_guess_for_multiple_no_or_nonfinite_solutions(self):
  for expr in ['x^2-2=0','x^2+1=0','x=x']:
   with self.assertRaises(Unsupported):solve_request({'expression':expr,'operation':'equation'})
 def test_unsafe_and_bounded_inputs(self):
  for expression in ['__import__("os")','x.__class__','Symbol(x)','[1,2]','factorial(9)','2^10000','1/0','sqrt(-1)','x+y','1 1/2','x'*301,'sin(sin('*25+'1'+'))'*25]:
   with self.subTest(expression=expression),self.assertRaises(Unsupported):parse_expression(expression)
 def test_surd_certificate(self):
  r=solve_request({'expression':'sqrt(8)','operation':'simplify'})
  self.assertEqual(r['certificate'],{'kind':'quadratic-surd','coefficientNumerator':'2','coefficientDenominator':'1','radicand':'2'})
class RealHTTP(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.server=Server(('127.0.0.1',0),ORIGIN,TOKEN);cls.port=cls.server.server_port
  cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
 @classmethod
 def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join()
 def request(self,method,path,body=None,extra=None):
  headers={'Origin':ORIGIN,'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'};headers.update(extra or {})
  c=http.client.HTTPConnection('127.0.0.1',self.port,timeout=8)
  c.request(method,path,json.dumps(body) if body is not None else None,headers)
  r=c.getresponse();data=r.read();result=(r.status,dict(r.getheaders()),json.loads(data) if data else None);c.close();return result
 def test_health_and_actual_solve_verify(self):
  self.assertEqual(self.request('GET','/v1/health')[0],200)
  code,headers,r=self.request('POST','/v1/solve',{'expression':r'\sqrt{8}','operation':'simplify'})
  self.assertEqual(code,200);self.assertEqual(headers['Access-Control-Allow-Origin'],ORIGIN);self.assertEqual(r['answer'],'2*sqrt(2)')
  _,_,v=self.request('POST','/v1/verify',{'expression':r'\sqrt{8}','operation':'simplify','answer':r['answer'],'observed':r'2\sqrt{2}'});self.assertTrue(v['equivalent'])
 def test_authenticated_post_health(self):
  status,headers,body=self.request('POST','/v1/health',{})
  self.assertEqual(status,200);self.assertTrue(body['ok']);self.assertEqual(body['engine'],'sympy');self.assertEqual(headers['Access-Control-Allow-Origin'],ORIGIN)
  self.assertEqual(self.request('POST','/v1/health',{},extra={'Origin':'https://evil.example'})[0],403)
  self.assertEqual(self.request('POST','/v1/health',{},extra={'Authorization':'Bearer bad'})[0],401)
  self.assertEqual(self.request('POST','/v1/health',{'bad':True})[0],400)
 def test_auth_origin_and_host_rejected(self):
  self.assertEqual(self.request('GET','/v1/health',extra={'Authorization':'Bearer bad'})[0],401)
  self.assertEqual(self.request('GET','/v1/health',extra={'Origin':'https://evil.example'})[0],403)
  self.assertEqual(self.request('GET','/v1/health',extra={'Host':'evil.example'})[0],403)
 def test_invalid_and_oversized_requests(self):
  self.assertEqual(self.request('POST','/v1/solve',{'expression':'sqrt(8)','operation':'simplify','code':'x'})[2]['reason'],'INVALID_REQUEST')
  self.assertEqual(self.request('POST','/v1/solve',{'expression':'x'*5000,'operation':'factor'})[0],413)
 def test_preflight(self):
  status,headers,_=self.request('OPTIONS','/v1/solve',extra={'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'})
  self.assertEqual(status,204);self.assertEqual(headers['Access-Control-Allow-Origin'],ORIGIN)
 def test_worker_process_limits_and_invalid_math(self):
  _,_,r=self.request('POST','/v1/solve',{'expression':'2^1000000000','operation':'evaluate'});self.assertFalse(r['ok']);self.assertEqual(r['reason'],'EXPONENT_LIMIT')
  _,_,r=self.request('POST','/v1/solve',{'expression':'x^2-2=0','operation':'equation'});self.assertFalse(r['ok']);self.assertEqual(r['reason'],'NEED_EXACTLY_ONE_REAL_SOLUTION')
 def test_hung_worker_is_killed_and_next_request_recovers(self):
  with tempfile.TemporaryDirectory() as directory:
   worker=Path(directory)/'slow.py';worker.write_text('import time; time.sleep(10)')
   original=solver_server.WORKER;solver_server.WORKER=worker;started=time.monotonic()
   try:
    _,_,r=self.request('POST','/v1/solve',{'expression':'1+1','operation':'evaluate'})
    self.assertEqual(r['reason'],'SOLVER_TIME_LIMIT');self.assertLess(time.monotonic()-started,6)
   finally:solver_server.WORKER=original
   self.assertEqual(self.request('POST','/v1/solve',{'expression':'1+1','operation':'evaluate'})[2]['answer'],'2')
if __name__=='__main__':unittest.main(verbosity=2)
