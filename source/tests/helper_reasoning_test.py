"""Protocol tests use a SCRIPTED Ollama-shaped fixture, not real inference.
The helper HTTP, auth, parser and exact SymPy recomputation are real.
"""
import http.client,json,os,socket,subprocess,sys,tempfile,threading,time,unittest,io,contextlib,struct
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'helper'))
import reasoner
from server import Server,Handler
ORIGIN='chrome-extension://'+'a'*32;TOKEN='a'*64
class FixtureHandler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def reply(self,body):
  data=json.dumps(body).encode()
  try:self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
  except (BrokenPipeError,ConnectionResetError):pass # Expected scripted-runtime disconnect when helper child is cancelled.
 def do_GET(self):self.reply({'models':[self.server.metadata]})
 def do_POST(self):
  request=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
  if self.path=='/api/show':
   self.reply(self.server.show);return
  self.server.requests.append(request)
  time.sleep(getattr(self.server,'delay',0))
  self.reply({'message':{'role':'assistant','content':json.dumps(self.server.proposal)}})
class ProtocolTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.fixture=ThreadingHTTPServer(('127.0.0.1',0),FixtureHandler);cls.fixture.requests=[];cls.fixture.metadata={'name':'fixture:latest','digest':'a'*64,'size':100,'details':{'format':'gguf'}};cls.fixture.show={'details':{'format':'gguf'},'model_info':{'general.architecture':'qwen3'}};cls.fixture.proposal={'answer':'2sqrt(2)','explanation':'Simplify the square factor.'}
  cls.old_port=reasoner.OLLAMA_PORT;reasoner.OLLAMA_PORT=cls.fixture.server_port
  cls.fixture_thread=threading.Thread(target=cls.fixture.serve_forever,daemon=True);cls.fixture_thread.start()
  cls.server=Server(('127.0.0.1',0),ORIGIN,TOKEN,'fixture:latest');cls.server_thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.server_thread.start()
 @classmethod
 def tearDownClass(cls):
  cls.server.shutdown();cls.server.server_close();cls.fixture.shutdown();cls.fixture.server_close();reasoner.OLLAMA_PORT=cls.old_port
 def call(self,path,body,headers=None):
  c=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=10);h={'Origin':ORIGIN,'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'};h.update(headers or {})
  c.request('POST',path,json.dumps(body),h);r=c.getresponse();result=(r.status,json.loads(r.read()));c.close();return result
 def test_real_exact_verification_gates_scripted_proposal(self):
  self.fixture.proposal={'answer':'2sqrt(2)','explanation':'Simplify the square factor.'}
  status,result=self.call('/v1/reason',{'expression':'sqrt(8)','operation':'simplify'})
  self.assertEqual(status,200);self.assertEqual(result['status'],'solved');self.assertEqual(result['source'],'local-reasoning-verified');self.assertEqual(result['answer'],'2*sqrt(2)');self.assertTrue(result['verification']['exact'])
  request=self.fixture.requests[-1];self.assertFalse(request['stream']);self.assertFalse(request['think']);self.assertEqual(request['format'],reasoner.SCHEMA);self.assertNotIn('tools',request);self.assertEqual(request['options']['num_predict'],256)
 def test_wrong_answer_stays_review_only(self):
  self.fixture.proposal={'answer':'3','explanation':'This scripted wrong proposal must not be accepted.'}
  _,result=self.call('/v1/reason',{'expression':'sqrt(8)','operation':'simplify'})
  self.assertEqual(result['status'],'review');self.assertNotIn('answer',result);self.assertEqual(result['proposal']['answer'],'3');self.assertFalse(result['verification']['exact'])
 def test_equivalent_expanded_factor_answer_is_not_fully_factored(self):
  self.fixture.proposal={'answer':'x^2-1','explanation':'Equivalent but not factored.'}
  _,result=self.call('/v1/reason',{'expression':'x^2-1','operation':'factor'});self.assertEqual(result['status'],'review')
 def test_unknown_word_problem_never_becomes_auto_entry(self):
  self.fixture.proposal={'answer':'12','explanation':'A proposed value only.'}
  _,result=self.call('/v1/reason',{'expression':'','operation':'unknown','instruction':'A word problem not formalized for the exact verifier.'});self.assertEqual(result['status'],'review');self.assertEqual(result['request']['operation'],'unknown')
 def test_injection_proposal_cannot_execute(self):
  self.fixture.proposal={'answer':'__import__("os").system("echo unsafe")','explanation':'A malicious response remains data.'}
  _,result=self.call('/v1/reason',{'expression':'1+1','operation':'evaluate'});self.assertEqual(result['status'],'review');self.assertFalse(result['verification']['exact'])
 def test_health_config_and_available_model(self):
  _,result=self.call('/v1/health',{});self.assertTrue(result['reasoningConfigured']);self.assertTrue(result['reasoningAvailable']);self.assertEqual(result['reasoningModel'],'fixture:latest')
 def test_no_model_requests_without_optin(self):
  before=len(self.fixture.requests);result=reasoner.proposal_request({'expression':'1+1','operation':'evaluate'},'');self.assertEqual(result['reason'],'LOCAL_REASONING_DISABLED');self.assertEqual(len(self.fixture.requests),before)
 def test_auth_and_origin_guards_apply_to_reasoning(self):
  self.assertEqual(self.call('/v1/reason',{}, {'Authorization':'Bearer bad'})[0],401)
  self.assertEqual(self.call('/v1/reason',{}, {'Origin':'https://evil.example'})[0],403)
 def test_request_and_model_bounds(self):
  self.assertEqual(self.call('/v1/reason',{'instruction':'x'*1201})[0],400)
  for model in ['http://evil.example/model','../model','bad model','x'*100,'qwen3:cloud','qwen3:4b-cloud']:
   with self.assertRaises(reasoner.ReasoningUnavailable):reasoner.model_name(model)
 def test_configured_model_unavailable_is_explicit(self):
  old=reasoner.OLLAMA_PORT
  unused=socket.socket();unused.bind(('127.0.0.1',0));port=unused.getsockname()[1];unused.close();reasoner.OLLAMA_PORT=port
  try:
   availability=reasoner.availability('fixture:latest');self.assertTrue(availability['reasoningConfigured']);self.assertFalse(availability['reasoningAvailable'])
   _,r=self.call('/v1/reason',{'expression':'1+1','operation':'evaluate'});self.assertEqual(r['status'],'unavailable')
  finally:reasoner.OLLAMA_PORT=old
 def test_remote_model_aliases_rejected_before_inference(self):
  before=len(self.fixture.requests);saved=dict(self.fixture.metadata)
  try:
   self.fixture.metadata['remote_host']='https://ollama.com';_,r=self.call('/v1/reason',{'expression':'1+1','operation':'evaluate'})
   self.assertEqual(r['reason'],'CLOUD_MODEL_NOT_ALLOWED');self.assertEqual(len(self.fixture.requests),before)
  finally:self.fixture.metadata=saved
  saved_show=dict(self.fixture.show)
  try:
   self.fixture.show['remote_model']='cloud-alias';_,r=self.call('/v1/reason',{'expression':'1+1','operation':'evaluate'})
   self.assertEqual(r['reason'],'CLOUD_MODEL_NOT_ALLOWED');self.assertEqual(len(self.fixture.requests),before)
  finally:self.fixture.show=saved_show
 def test_metadata_missing_local_weights_rejected(self):
  before=len(self.fixture.requests);saved=dict(self.fixture.metadata)
  try:
   self.fixture.metadata['size']=0;_,r=self.call('/v1/reason',{'expression':'1+1','operation':'evaluate'})
   self.assertEqual(r['reason'],'LOCAL_MODEL_METADATA_UNVERIFIED');self.assertEqual(len(self.fixture.requests),before)
  finally:self.fixture.metadata=saved
 def test_absolute_subprocess_deadline_is_enforced(self):
  # This uses a real child, not a monkeypatched timer or simulated subprocess.
  handler=Handler.__new__(Handler);started=time.monotonic()
  r=handler.reasoning_job('--propose',{'body':{'expression':'1+1','operation':'evaluate'},'model':'fixture:latest'},.001)
  self.assertEqual(r['reason'],'LOCAL_REASONING_TIME_LIMIT');self.assertLess(time.monotonic()-started,1)
 def test_client_stop_disconnect_has_no_traceback_and_server_recovers(self):
  self.fixture.proposal={'answer':'2','explanation':'A bounded scripted proposal.'};self.fixture.delay=.2
  before=len(self.fixture.requests);capture=io.StringIO()
  try:
   with contextlib.redirect_stderr(capture):
    connection=socket.create_connection(('127.0.0.1',self.server.server_port),timeout=3)
    body=json.dumps({'expression':'1+1','operation':'evaluate'}).encode()
    headers=(f'POST /v1/reason HTTP/1.1\r\nHost: 127.0.0.1:{self.server.server_port}\r\nOrigin: {ORIGIN}\r\nAuthorization: Bearer {TOKEN}\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n').encode()
    connection.sendall(headers+body);deadline=time.monotonic()+3
    while len(self.fixture.requests)==before and time.monotonic()<deadline:time.sleep(.01)
    self.assertGreater(len(self.fixture.requests),before)
    connection.setsockopt(socket.SOL_SOCKET,socket.SO_LINGER,struct.pack('ii',1,0));connection.close()
    time.sleep(.7)
   self.assertNotIn('Traceback',capture.getvalue());self.assertNotIn(TOKEN,capture.getvalue());self.assertEqual(self.call('/v1/health',{})[0],200)
  finally:self.fixture.delay=0
 def test_cli_port_collision_does_not_stop_existing_server(self):
  with tempfile.TemporaryDirectory() as d:
   config=Path(d)/'helper.json';config.write_text(json.dumps({'token':TOKEN}));config.chmod(0o600)
   p=subprocess.run([sys.executable,str(Path(__file__).resolve().parents[1]/'helper/server.py'),'--extension-origin',ORIGIN,'--port',str(self.server.server_port),'--config',str(config)],capture_output=True,text=True,timeout=10)
   self.assertNotEqual(p.returncode,0);self.assertIn('Port is already in use',p.stderr);self.assertEqual(self.call('/v1/health',{})[0],200)
if __name__=='__main__':unittest.main(verbosity=2)
