"""Real HTTP/exact-engine tests; Ollama protocol responses are SCRIPTED, not inference."""
import contextlib,copy,http.client,json,socket,struct,sys,threading,time,unittest
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'helper'))
import reasoner
from server import Server
from task_solver import solve_task
from problem_document import validate_document,model_document,InvalidDocument
ORIGIN='chrome-extension://'+'a'*32;TOKEN='b'*64

def document():
 return {'schema':'kubla-problem-v1','url':'https://example.invalid/private-class',
  'original':{'instruction':'Simplify the expression.','text':'Simplify the expression.','expressions':[{'source':'math','text':'sqrt(8)'}]},
  'task':{'schema':'kubla-task-v1','task':'simplify','expression':'sqrt(8)','slots':[{'id':'answer','role':'answer'}]},
  'response':{'kind':'single','slots':[{'id':'answer','role':'answer','kind':'mathquill','label':'Answer','path':'private-selector','value':'private-existing-work','disabled':False}],
   'choices':[{'index':0,'expression':'2sqrt(2)','text':'A choice','selected':False}]},
  'evidence':{'tables':[],'graph':{}},'notation':{},'fingerprint':'fixture-question-1'}

class Model(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def reply(self,body):
  data=json.dumps(body).encode()
  try:self.send_response(200);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
  except (BrokenPipeError,ConnectionResetError):pass
 def do_GET(self):self.reply({'models':[{'name':'fixture:latest','size':100,'digest':'a'*64,'details':{'format':'gguf'}}]})
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
  if self.path=='/api/show':self.reply({'details':{'format':'gguf'},'model_info':{'general.architecture':'qwen3'}});return
  self.server.requests.append(body);time.sleep(self.server.delay)
  self.reply({'message':{'content':json.dumps(self.server.proposal)}})

class StructuredTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.model=ThreadingHTTPServer(('127.0.0.1',0),Model);cls.model.requests=[];cls.model.delay=0
  cls.oldport=reasoner.OLLAMA_PORT;reasoner.OLLAMA_PORT=cls.model.server_port
  threading.Thread(target=cls.model.serve_forever,daemon=True).start()
  cls.helper=Server(('127.0.0.1',0),ORIGIN,TOKEN,'fixture:latest')
  threading.Thread(target=cls.helper.serve_forever,daemon=True).start()
 @classmethod
 def tearDownClass(cls):
  cls.helper.shutdown();cls.helper.server_close();cls.model.shutdown();cls.model.server_close();reasoner.OLLAMA_PORT=cls.oldport
 def setUp(self):
  self.doc=document();self.model.delay=0
  self.model.proposal={'task':self.doc['task'],'answer':solve_task(self.doc['task'])['answer'],'explanation':'A scripted proposal independently checked by exact arithmetic.'}
 def call(self,path,body,headers=None):
  connection=http.client.HTTPConnection('127.0.0.1',self.helper.server_port,timeout=10)
  h={'Origin':ORIGIN,'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'};h.update(headers or {})
  connection.request('POST',path,json.dumps(body),h);r=connection.getresponse();result=(r.status,json.loads(r.read()));connection.close();return result
 def test_typed_solve_and_verified_readback(self):
  status,result=self.call('/v2/task/solve',{'document':self.doc});self.assertEqual(status,200);self.assertEqual(result['status'],'solved');self.assertEqual(result['binding']['fingerprint'],self.doc['fingerprint'])
  _,verified=self.call('/v2/task/verify',{'document':self.doc,'answer':result['answer'],'observed':{'fields':result['answer']['fields']}});self.assertTrue(verified['equivalent'])
  _,changed=self.call('/v2/task/verify',{'document':self.doc,'answer':result['answer'],'observed':{'fields':{'answer':'3'}}});self.assertFalse(changed['equivalent'])
 def test_choice_comparison_bound_to_every_public_option_and_unknown_distinct(self):
  self.doc['response']['kind']='choice';self.doc['response']['slots']=[]
  self.doc['response']['choices']=[{'index':0,'expression':'2sqrt(2)','text':'2sqrt(2)','selected':False},{'index':1,'expression':'3','text':'3','selected':False},{'index':2,'expression':'unparsed error-analysis prose','text':'unparsed error-analysis prose','selected':False}]
  results=[]
  for choice in self.doc['response']['choices']:
   _,result=self.call('/v2/task/compare-option',{'document':self.doc,'option':choice});results.append(result)
  self.assertTrue(results[0]['interpreted']);self.assertTrue(results[0]['equivalent']);self.assertTrue(results[1]['interpreted']);self.assertFalse(results[1]['equivalent']);self.assertFalse(results[2]['interpreted']);self.assertIsNone(results[2]['equivalent']);self.assertEqual(results[0]['binding']['fingerprint'],self.doc['fingerprint'])
  tampered={**self.doc['response']['choices'][0],'expression':'3'}
  _,result=self.call('/v2/task/compare-option',{'document':self.doc,'option':tampered});self.assertFalse(result['ok']);self.assertEqual(result['reason'],'OPTION_NOT_CAPTURED')
 def test_original_domain_counterexample_empty_solution(self):
  self.doc['original']['instruction']='Solve the equation.';self.doc['original']['expressions'][0]['text']='x^2/x=0';self.doc['task'].update(task='equation',expression='x^2/x=0')
  _,result=self.call('/v2/task/solve',{'document':self.doc});self.assertEqual(result['status'],'solved');self.assertEqual(result['answer']['values'],[]);self.assertEqual(result['answer']['fields']['answer'],'No solution')
 def test_copied_task_cannot_replace_original_expression(self):
  self.doc['task']['expression']='sqrt(9)';_,result=self.call('/v2/task/solve',{'document':self.doc});self.assertFalse(result['ok']);self.assertEqual(result['reason'],'TASK_EXPRESSION_NOT_ORIGINAL')
 def test_model_context_uses_scoped_question_and_excludes_work_selectors_url(self):
  _,result=self.call('/v2/interpret',{'document':self.doc});self.assertEqual(result['status'],'solved')
  request=self.model.requests[-1];context=json.loads(request['messages'][1]['content']);raw=json.dumps(context)
  for private in ['private-class','private-selector','private-existing-work','selected']:
   self.assertNotIn(private,raw)
  self.assertIn('Simplify the expression.',raw);self.assertEqual(context['response']['slots'][0]['label'],'Answer');self.assertEqual(request['format'],reasoner.INTERPRET_SCHEMA);self.assertNotIn('tools',request)
 def test_correct_scripted_model_proposal_only_returns_canonical_exact_answer(self):
  self.model.proposal['answer']={'kind':'scalar','fields':{'answer':'sqrt(2)*2'}}
  _,result=self.call('/v2/interpret',{'document':self.doc});self.assertEqual(result['status'],'solved');self.assertEqual(result['source'],'local-model-typed-exact');self.assertTrue(result['verification']['exact']);self.assertNotIn('document',result);self.assertEqual(result['answer']['value'],'2*sqrt(2)')
 def test_wrong_model_field_is_review_not_autoentry(self):
  self.model.proposal['answer']['fields']['answer']='3';_,result=self.call('/v2/interpret',{'document':self.doc});self.assertEqual(result['status'],'review');self.assertFalse(result['verification']['exact']);self.assertNotIn('answer',result)
 def test_model_cannot_authorize_its_own_task(self):
  self.model.proposal['task']={**self.doc['task'],'expression':'sqrt(9)'};_,result=self.call('/v2/interpret',{'document':self.doc});self.assertEqual(result['status'],'review')
 def test_unknown_word_interpretation_never_becomes_semantic_proof(self):
  self.doc['task']=None;self.doc['original']['text']='A word problem without independent semantic grounding.'
  _,result=self.call('/v2/interpret',{'document':self.doc});self.assertEqual(result['status'],'review');self.assertFalse(result['verification']['exact'])
 def test_model_string_is_data_and_not_executed(self):
  self.model.proposal['answer']['fields']['answer']='__import__("os").system("bad")'
  _,result=self.call('/v2/interpret',{'document':self.doc});self.assertEqual(result['status'],'review')
 def test_strict_origin_and_token_on_all_new_routes(self):
  for route in ['/v2/task/solve','/v2/task/verify','/v2/interpret']:
   self.assertEqual(self.call(route,{'document':self.doc},{'Authorization':'Bearer bad'})[0],401)
   self.assertEqual(self.call(route,{'document':self.doc},{'Origin':'https://evil.invalid'})[0],403)
 def test_large_structured_document_allowed_but_bounded(self):
  self.doc['original']['text']='x'*5000;self.assertEqual(self.call('/v2/task/solve',{'document':self.doc})[0],200)
  self.doc['original']['text']='x'*7001;self.assertEqual(self.call('/v2/task/solve',{'document':self.doc})[0],400)
 def recovered(self):
  self.doc['task']=None;self.doc['response']['kind']='native';self.doc['response']['slots'][0]['value']='';self.doc['response']['choices']=[]
  self.doc['original']['instruction']='Express the expression in simplest form.'
  self.doc['original']['text']='Express the expression in simplest form. <math> sqrt(8) </math> <response>'
 def test_unknown_formal_alias_recovers_with_independent_semantic_binding(self):
  self.recovered();_,result=self.call('/v2/interpret',{'document':self.doc})
  self.assertEqual(result['status'],'solved');self.assertEqual(result['interpretation']['semanticBinding'],'bounded-formal-directive');self.assertEqual(result['interpretation']['task']['task'],'simplify');self.assertIsNone(self.doc['task']);self.assertTrue(result['verification']['exact'])
  resolved={**self.doc,'task':result['interpretation']['task']}
  _,verified=self.call('/v2/task/verify',{'document':resolved,'answer':result['answer'],'observed':{'fields':result['answer']['fields']}});self.assertTrue(verified['equivalent'])
 def test_recovery_cannot_drop_extra_original_conditions(self):
  self.recovered();self.doc['original']['text']+=' Round to the nearest integer.'
  _,result=self.call('/v2/interpret',{'document':self.doc});self.assertEqual(result['status'],'review');self.assertEqual(result['reason'],'ADDITIONAL_QUESTION_TEXT_NOT_GROUNDED')
 def test_recovery_cannot_invent_task_output_domain_or_slot(self):
  self.recovered()
  for change in [{'task':'factor'},{'output':{'decimalPlaces':2}},{'domain':'rational'},{'slots':[{'id':'invented','role':'answer'}]}]:
   old=copy.deepcopy(self.model.proposal['task']);self.model.proposal['task'].update(change)
   _,result=self.call('/v2/interpret',{'document':self.doc});self.assertEqual(result['status'],'review');self.model.proposal['task']=old
 def test_recovery_does_not_ignore_graph_or_existing_work(self):
  self.recovered();self.doc['evidence']['graph']={'relevant':True,'labels':['An unread diagram']}
  _,result=self.call('/v2/interpret',{'document':self.doc});self.assertEqual(result['status'],'review')
  self.doc['evidence']['graph']={};self.doc['response']['slots'][0]['value']='user answer'
  _,result=self.call('/v2/interpret',{'document':self.doc});self.assertEqual(result['status'],'review')
 def test_hostile_json_keys_and_nonfinite_numbers_rejected(self):
  self.doc['evidence']['graph']={'__proto__':{'polluted':True}}
  self.assertEqual(self.call('/v2/task/solve',{'document':self.doc})[0],400)
  self.doc=document();self.doc['evidence']['graph']={'scale':float('nan')}
  self.assertEqual(self.call('/v2/task/solve',{'document':self.doc})[0],400)
  self.doc=document();self.doc['task']['slots']=None
  self.assertEqual(self.call('/v2/task/solve',{'document':self.doc})[0],400)
  self.doc=document();self.doc['task']['slots'][0]['id']='__proto__'
  self.assertEqual(self.call('/v2/task/solve',{'document':self.doc})[0],400)
 def test_cancelled_http_job_releases_reasoning_slot_promptly(self):
  self.model.delay=3;before=len(self.model.requests)
  connection=socket.create_connection(('127.0.0.1',self.helper.server_port),timeout=3);body=json.dumps({'document':self.doc}).encode()
  head=(f'POST /v2/interpret HTTP/1.1\r\nHost: 127.0.0.1:{self.helper.server_port}\r\nOrigin: {ORIGIN}\r\nAuthorization: Bearer {TOKEN}\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n').encode();connection.sendall(head+body)
  deadline=time.monotonic()+3
  while len(self.model.requests)==before and time.monotonic()<deadline:time.sleep(.01)
  self.assertGreater(len(self.model.requests),before);started=time.monotonic();connection.setsockopt(socket.SOL_SOCKET,socket.SO_LINGER,struct.pack('ii',1,0));connection.close()
  acquired=False
  while time.monotonic()-started<1:
   if self.helper.reasoning_slot.acquire(False):acquired=True;self.helper.reasoning_slot.release();break
   time.sleep(.01)
  self.assertTrue(acquired,'Cancelling Chrome fetch should kill child and release its helper job within one second')
if __name__=='__main__':unittest.main(verbosity=2)
