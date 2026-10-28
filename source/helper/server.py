#!/usr/bin/env python3
"""Authenticated loopback-only exact CAS bridge for KUBLA KHAN."""
import argparse,hmac,json,os,re,secrets,subprocess,sys,threading,time,select,socket,tempfile,signal
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
VERSION='2.2.0'
WORKER=Path(__file__).with_name('worker.py')
LIMIT=4096
TYPED_LIMIT=32768
OCR_LIMIT=3*1024*1024
ROUTES=('/v1/solve','/v1/verify','/v1/health','/v1/reason','/v2/task/solve','/v2/task/verify','/v2/interpret','/v2/transcribe','/v2/task/compare-option','/v2/task/compare')
class Server(ThreadingHTTPServer):
    daemon_threads=True
    allow_reuse_address=True
    def __init__(self,address,origin,token,reasoning_model=''):
        self.origin=origin;self.token=token;self.slots=threading.BoundedSemaphore(2)
        self.ocr_temp_prefix='kubla-ocr-'+secrets.token_hex(6)+'-'
        self.reasoning_model=reasoning_model;self.reasoning_slot=threading.BoundedSemaphore(1);self.ocr_slot=threading.BoundedSemaphore(1)
        super().__init__(address,Handler)
    def get_request(self):
        connection,address=super().get_request();connection.settimeout(5);return connection,address
class Handler(BaseHTTPRequestHandler):
    server_version='KUBLA-Exact-CAS'
    def log_message(self,*args): pass
    def reply(self,status,body):
        data=json.dumps(body,separators=(',',':')).encode()
        try:
            self.send_response(status)
            self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)))
            self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
            if self.headers.get('Origin')==self.server.origin:
                self.send_header('Access-Control-Allow-Origin',self.server.origin);self.send_header('Vary','Origin')
            self.end_headers();self.wfile.write(data)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):
            # Stop may close the browser request while local work finishes.
            # Do not log a traceback, request headers or the pairing token.
            self.close_connection=True
    def allowed(self,auth=True):
        host=f'127.0.0.1:{self.server.server_port}'
        if self.client_address[0]!='127.0.0.1' or self.headers.get('Host')!=host:
            self.reply(403,{'ok':False,'error':'HOST_DENIED'});return False
        if self.headers.get('Origin')!=self.server.origin:
            self.reply(403,{'ok':False,'error':'ORIGIN_DENIED'});return False
        expected='Bearer '+self.server.token
        if auth and not hmac.compare_digest(self.headers.get('Authorization','').encode('utf-8'),expected.encode('ascii')):
            self.reply(401,{'ok':False,'error':'AUTH_REQUIRED'});return False
        return True
    def do_OPTIONS(self):
        if not self.allowed(False):return
        if self.path not in ROUTES or self.headers.get('Access-Control-Request-Method') not in ('POST','GET'):
            self.reply(403,{'ok':False,'error':'PREFLIGHT_DENIED'});return
        requested={x.strip().lower() for x in self.headers.get('Access-Control-Request-Headers','').split(',') if x.strip()}
        if requested-{'authorization','content-type'}:
            self.reply(403,{'ok':False,'error':'PREFLIGHT_DENIED'});return
        self.send_response(204);self.send_header('Access-Control-Allow-Origin',self.server.origin)
        self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Authorization, Content-Type')
        
        if self.headers.get('Access-Control-Request-Private-Network')=='true':self.send_header('Access-Control-Allow-Private-Network','true')
        self.send_header('Access-Control-Max-Age','0');self.send_header('Content-Length','0');self.end_headers()
    def health(self):
        reasoning={'reasoningConfigured':bool(self.server.reasoning_model),'reasoningAvailable':False,'reasoningModel':self.server.reasoning_model}
        if self.server.reasoning_model:
            result=self.reasoning_job('--availability',{'model':self.server.reasoning_model},.95)
            if isinstance(result,dict) and 'reasoningAvailable' in result:reasoning=result
        from ocr import availability as ocr_availability
        ocr=ocr_availability()
        return {'ok':True,**ocr,'version':VERSION,'engine':'sympy','engineVersion':'1.14.0','localOnly':True,'capabilities':['factor','expand','simplify','evaluate','equation-single-real','verify-original-and-readback','local-reasoning-review','typed-task-v1','structured-local-interpretation','original-domain-verification','local-ocr-unverified','typed-option-comparison'],**reasoning}
    def reasoning_job(self,mode,payload,timeout):
        from reasoner import OLLAMA_PORT
        payload={**payload,'internalPort':OLLAMA_PORT}
        process=subprocess.Popen([sys.executable,str(Path(__file__).with_name('reasoner.py')),mode],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,start_new_session=True)
        deadline=time.monotonic()+timeout
        first=True
        while True:
            try:
                output,_=process.communicate(json.dumps(payload) if first else None,timeout=min(.1,max(.001,deadline-time.monotonic())))
                break
            except subprocess.TimeoutExpired:
                first=False
                if self.client_disconnected():
                    self.kill_child(process);process.communicate();return {'ok':False,'status':'cancelled','reason':'CLIENT_DISCONNECTED'}
                if time.monotonic()>=deadline:
                    self.kill_child(process);process.communicate();return {'ok':False,'status':'unavailable','reason':'LOCAL_REASONING_TIME_LIMIT'}
        if process.returncode or len(output)>65536:return {'ok':False,'status':'unavailable','reason':'LOCAL_REASONING_RESOURCE_LIMIT'}
        try:return json.loads(output)
        except ValueError:return {'ok':False,'status':'unavailable','reason':'LOCAL_MODEL_RESPONSE_INVALID'}
    def kill_child(self,process):
        try:os.killpg(process.pid,signal.SIGKILL)
        except ProcessLookupError:pass
    def client_disconnected(self):
        connection=getattr(self,'connection',None)
        if connection is None:return False
        try:
            return bool(select.select([connection],[],[],0)[0]) and connection.recv(1,socket.MSG_PEEK|socket.MSG_DONTWAIT)==b''
        except (OSError,ValueError):return True
    def do_GET(self):
        if not self.allowed():return
        if self.path!='/v1/health':self.reply(404,{'ok':False,'error':'NOT_FOUND'});return
        self.reply(200,self.health())
    def do_POST(self):
        if not self.allowed():return
        if self.path not in ROUTES:
            self.reply(404,{'ok':False,'error':'NOT_FOUND'});return
        if self.headers.get('Transfer-Encoding') or self.headers.get_content_type()!='application/json':
            self.reply(415,{'ok':False,'error':'JSON_REQUIRED'});return
        try:length=int(self.headers.get('Content-Length','0'))
        except ValueError:length=0
        if not 0<length<=(OCR_LIMIT if self.path=='/v2/transcribe' else TYPED_LIMIT if self.path.startswith('/v2/') else LIMIT):
            self.close_connection=True;self.reply(413,{'ok':False,'error':'REQUEST_SIZE'});return
        try:
            body=json.loads(self.rfile.read(length))
            if not isinstance(body,dict):raise ValueError()
        except (ValueError,UnicodeDecodeError,RecursionError,OSError):
            self.reply(400,{'ok':False,'error':'INVALID_JSON'});return
        if self.path=='/v1/health':
            if body!={}:self.reply(400,{'ok':False,'error':'INVALID_REQUEST'});return
            self.reply(200,self.health());return
        if self.path=='/v1/reason':
            self.reason(body);return
        if self.path=='/v2/transcribe':
            self.transcribe(body);return
        if self.path.startswith('/v2/'):
            self.typed(body);return
        if not self.server.slots.acquire(False):
            self.reply(429,{'ok':False,'error':'SOLVER_BUSY'});return
        try:
            process=subprocess.Popen([sys.executable,str(WORKER)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,start_new_session=True)
            try:
                output,_=process.communicate(json.dumps({'action':'verify' if self.path.endswith('/verify') else 'solve','body':body}),timeout=4)
            except subprocess.TimeoutExpired:
                self.kill_child(process);process.communicate();self.reply(200,{'ok':False,'status':'unsupported','reason':'SOLVER_TIME_LIMIT'});return
            if process.returncode or len(output)>12000:
                self.reply(200,{'ok':False,'status':'unsupported','reason':'SOLVER_RESOURCE_LIMIT'});return
            try:result=json.loads(output)
            except ValueError:result={'ok':False,'status':'unsupported','reason':'SOLVER_FAILED'}
            self.reply(200,result)
        finally:self.server.slots.release()
    def transcribe(self,body):
        if not isinstance(body,dict) or set(body)!={'image','fingerprint','source'}:
            self.reply(400,{'ok':False,'status':'review','reason':'OCR_REQUEST_INVALID'});return
        if not self.server.ocr_slot.acquire(False):
            self.reply(429,{'ok':False,'error':'OCR_BUSY'});return
        result=None
        try:
            # Complete cleanup BEFORE reporting completion to the caller.
            # The parent also owns cleanup if Stop kills worker and decoder.
            with tempfile.TemporaryDirectory(prefix=self.server.ocr_temp_prefix) as private:
                process=subprocess.Popen([sys.executable,str(Path(__file__).with_name('ocr.py'))],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,start_new_session=True)
                payload=json.dumps({'body':body,'internalDirectory':private});deadline=time.monotonic()+5;first=True
                while True:
                    try:
                        output,_=process.communicate(payload if first else None,timeout=min(.1,max(.001,deadline-time.monotonic())))
                        break
                    except subprocess.TimeoutExpired:
                        first=False
                        if self.client_disconnected():
                            self.kill_child(process);process.communicate();return
                        if time.monotonic()>=deadline:
                            self.kill_child(process);process.communicate()
                            result={'ok':False,'status':'review','reason':'OCR_TIME_LIMIT','verification':{'exact':False,'method':'ocr-unverified'}}
                            break
                if result is None:
                    if process.returncode or len(output)>65536:
                        result={'ok':False,'status':'review','reason':'OCR_RESOURCE_LIMIT','verification':{'exact':False,'method':'ocr-unverified'}}
                    else:
                        try:result=json.loads(output)
                        except ValueError:result={'ok':False,'status':'review','reason':'OCR_FAILED','verification':{'exact':False,'method':'ocr-unverified'}}
        finally:self.server.ocr_slot.release()
        self.reply(200,result)
    def typed(self,body):
        from problem_document import validate_document,InvalidDocument
        comparing=self.path.endswith(('/compare','/compare-option'))
        keys={'document','answer','option'} if comparing else {'document','answer','observed'} if self.path.endswith('/verify') else {'document'}
        if set(body)-keys or 'document' not in body:
            self.reply(400,{'ok':False,'status':'unsupported','reason':'INVALID_TYPED_REQUEST'});return
        try:validate_document(body['document'])
        except InvalidDocument as error:
            self.reply(400,{'ok':False,'status':'unsupported','reason':str(error)});return
        if self.path=='/v2/interpret':
            self.interpret(body['document']);return
        if not self.server.slots.acquire(False):
            self.reply(429,{'ok':False,'error':'SOLVER_BUSY'});return
        try:
            action='task-compare' if comparing else 'task-verify' if self.path.endswith('/verify') else 'task-solve'
            process=subprocess.Popen([sys.executable,str(WORKER)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,start_new_session=True)
            try:output,_=process.communicate(json.dumps({'action':action,'body':body}),timeout=4)
            except subprocess.TimeoutExpired:
                self.kill_child(process);process.communicate();self.reply(200,{'ok':False,'status':'unsupported','reason':'SOLVER_TIME_LIMIT'});return
            if process.returncode or len(output)>65536:
                self.reply(200,{'ok':False,'status':'unsupported','reason':'SOLVER_RESOURCE_LIMIT'});return
            try:result=json.loads(output)
            except ValueError:result={'ok':False,'status':'unsupported','reason':'SOLVER_FAILED'}
            self.reply(200,result)
        finally:self.server.slots.release()
    def interpret(self,document):
        if not self.server.reasoning_slot.acquire(False):
            self.reply(429,{'ok':False,'error':'REASONING_BUSY'});return
        try:
            proposed=self.reasoning_job('--interpret',{'body':document,'model':self.server.reasoning_model},34)
            if proposed.get('status')!='proposal':self.reply(200,proposed);return
            verified=self.reasoning_job('--verify-interpretation',proposed,4)
            # Never return the model's copied document or any DOM paths/current work.
            verified.pop('document',None)
            self.reply(200,verified)
        finally:self.server.reasoning_slot.release()
    def reason(self,body):
        if not isinstance(body,dict) or set(body)-{'expression','operation','instruction'} or not isinstance(body.get('expression',''),str) or len(body.get('expression',''))>300 or not isinstance(body.get('operation',''),str) or len(body.get('operation',''))>30 or not isinstance(body.get('instruction',''),str) or len(body.get('instruction',''))>1200:
            self.reply(400,{'ok':False,'status':'review','reason':'REASONING_REQUEST_SIZE'});return
        if not self.server.reasoning_slot.acquire(False):
            self.reply(429,{'ok':False,'error':'REASONING_BUSY'});return
        try:
            proposed=self.reasoning_job('--propose',{'body':body,'model':self.server.reasoning_model},34)
            if proposed.get('status')!='proposal':self.reply(200,proposed);return
            process=subprocess.Popen([sys.executable,str(Path(__file__).with_name('reasoner.py'))],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,start_new_session=True)
            try:output,_=process.communicate(json.dumps(proposed),timeout=4)
            except subprocess.TimeoutExpired:
                self.kill_child(process);process.communicate();self.reply(200,{'ok':True,'status':'review','reason':'PROPOSAL_VERIFICATION_TIME_LIMIT',**{k:proposed[k] for k in ('request','proposal','reasoning')}});return
            if process.returncode or len(output)>12000:
                self.reply(200,{'ok':True,'status':'review','reason':'PROPOSAL_VERIFICATION_RESOURCE_LIMIT',**{k:proposed[k] for k in ('request','proposal','reasoning')}});return
            try:result=json.loads(output)
            except ValueError:result={'ok':False,'status':'review','reason':'PROPOSAL_VERIFICATION_FAILED'}
            self.reply(200,result)
        finally:self.server.reasoning_slot.release()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extension-origin',required=True,help='chrome-extension:// followed by the ID shown in chrome://extensions')
    parser.add_argument('--port',type=int,default=9000)
    parser.add_argument('--reasoning-model',default='',help='Optional installed Ollama model; empty disables local model requests')
    parser.add_argument('--config',type=Path,default=Path(os.environ.get('XDG_CONFIG_HOME',str(Path.home()/'.config')))/'kubla-khan'/'helper.json')
    args=parser.parse_args()
    if not re.fullmatch(r'chrome-extension://[a-p]{32}',args.extension_origin):parser.error('Invalid Chrome extension origin')
    if not 0<=args.port<=65535:parser.error('Invalid port')
    if args.reasoning_model:
        from reasoner import model_name,ReasoningUnavailable
        try:model_name(args.reasoning_model)
        except ReasoningUnavailable:parser.error('Invalid reasoning model name')
    args.config.parent.mkdir(parents=True,exist_ok=True)
    if args.config.exists():
        if args.config.stat().st_mode&0o077:parser.error('Config must be private: chmod 600 '+str(args.config))
        token=json.loads(args.config.read_text()).get('token','')
        if not re.fullmatch('[a-f0-9]{64}',token):parser.error('Invalid helper token config')
    else:
        token=secrets.token_hex(32)
        fd=os.open(args.config,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as f:json.dump({'token':token},f)
    try:import sympy
    except ImportError:parser.error('Install pinned helper requirements in the included virtual environment first')
    if sympy.__version__!='1.14.0':parser.error('This helper requires the tested SymPy 1.14.0')
    try:server=Server(('127.0.0.1',args.port),args.extension_origin,token,args.reasoning_model)
    except OSError as error:
        if error.errno==98:parser.error('Port is already in use. Leave the existing process running and choose another port with --port. No process was stopped.')
        parser.error('Could not bind the requested loopback port: '+str(error))
    print(json.dumps({'ready':True,'host':'127.0.0.1','port':server.server_port,'version':VERSION,'tokenConfig':str(args.config)}),flush=True)
    if sys.stderr.isatty():
        print('Local pairing token (paste into this extension only): '+token,file=sys.stderr,flush=True)
    else:
        print('Paste the token from the private config into the extension local-solver settings. Keep this terminal running.',file=sys.stderr,flush=True)
    try:server.serve_forever(poll_interval=.2)
    except KeyboardInterrupt:pass
    finally:server.server_close()
if __name__=='__main__':main()
