"""Actual installed Tesseract/HTTP tests. Fixtures are synthetic printed questions.
OCR is UNVERIFIED: the fixture's caret is in fact misread by Tesseract 5.5.0.
No model inference or owner browser/image is represented by these checks.
"""
import base64,binascii,copy,glob,http.client,json,os,socket,struct,sys,tempfile,threading,time,unittest,zlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'helper'))
from ocr import availability,png_bytes,chunk,OCRError,MAX_PNG
from server import Server
FIXTURES=Path(__file__).with_name('fixtures')
ORIGIN='chrome-extension://'+'a'*32;TOKEN='d'*64
PNG=(FIXTURES/'ocr-printed-question.png').read_bytes()

def encoded(data):return base64.b64encode(data).decode()
def request(data=PNG):return {'image':{'mime':'image/png','data':encoded(data)},'fingerprint':'synthetic-ocr-question-1','source':'question-crop'}

class PNGTests(unittest.TestCase):
 def test_valid_png_and_metadata_removed(self):
  metadata=chunk(b'tEXt',b'Comment\0https://invalid.example/instructions; never fetched')
  raw=PNG[:33]+metadata+PNG[33:];clean,w,h=png_bytes(encoded(raw))
  self.assertEqual((w,h),(1000,230));self.assertNotIn(b'invalid.example',clean);self.assertNotIn(b'tEXt',clean)
 def test_wrong_magic_and_base64(self):
  for value in ['https://invalid.example/image.png','!!!!',encoded(b'%PDF-1.7')]:
   with self.assertRaises(OCRError):png_bytes(value)
 def test_crc_and_trailing_payload_rejected(self):
  for value in [PNG[:-1]+bytes([PNG[-1]^1]),PNG+b'payload']:
   with self.assertRaises(OCRError):png_bytes(encoded(value))
 def test_dimensions_unsupported_interlace_and_depth(self):
  for width,height,depth,interlace in [(2049,1,8,0),(1,2049,8,0),(1,1,16,0),(1,1,8,1)]:
   bad=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,depth,2,0,0,interlace))+chunk(b'IEND',b'')
   with self.assertRaises(OCRError):png_bytes(encoded(bad))
 def test_size_and_decompression_bomb_rejected(self):
  with self.assertRaises(OCRError):png_bytes(encoded(b'x'*(MAX_PNG+1)))
  bomb=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\0'*100000))+chunk(b'IEND',b'')
  with self.assertRaises(OCRError):png_bytes(encoded(bomb))

@unittest.skipUnless(availability()['ocrAvailable'],'Optional installed Tesseract + eng data unavailable')
class ActualOCRTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.helper=Server(('127.0.0.1',0),ORIGIN,TOKEN);threading.Thread(target=cls.helper.serve_forever,daemon=True).start()
 @classmethod
 def tearDownClass(cls):cls.helper.shutdown();cls.helper.server_close()
 def call(self,path,body,headers=None):
  connection=http.client.HTTPConnection('127.0.0.1',self.helper.server_port,timeout=10)
  h={'Origin':ORIGIN,'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'};h.update(headers or {})
  connection.request('POST',path,json.dumps(body),h);reply=connection.getresponse();result=(reply.status,json.loads(reply.read()));connection.close();return result
 def test_actual_printed_question_and_axis_transcription_unverified(self):
  before=set(glob.glob(str(Path(tempfile.gettempdir())/(self.helper.ocr_temp_prefix+'*'))));started=time.monotonic();status,result=self.call('/v2/transcribe',request())
  self.assertEqual(status,200);self.assertEqual(result['status'],'transcribed');self.assertEqual(result['source'],'local-ocr-unverified');self.assertFalse(result['verification']['exact']);self.assertIn('Factor',result['transcription']);self.assertIn('5*x',result['transcription']);self.assertIn('axis',result['transcription']);self.assertTrue(result['words']);self.assertLessEqual(len(json.dumps(result)),65536)
  for word in result['words']:
   self.assertTrue(0<=word['confidence']<=100);box=word['box'];self.assertLessEqual(box['x']+box['width'],1000);self.assertLessEqual(box['y']+box['height'],230)
  self.assertEqual(set(glob.glob(str(Path(tempfile.gettempdir())/(self.helper.ocr_temp_prefix+'*')))),before)
  # Persist only synthetic fixture evidence; never owner screenshots/data.
  target=Path(__file__).resolve().parents[1]/'evidence';target.mkdir(exist_ok=True)
  (target/'actual-ocr.json').write_text(json.dumps({'evidence':'ACTUAL Tesseract; synthetic image; not mathematical verification','expectedPrintedLines':['Factor: x^2 - 5*x + 6','x axis: 0 1 2 3','y axis: -2 -1 0 1'],'actual':result,'elapsedSeconds':round(time.monotonic()-started,4)},indent=2)+'\n')
 def test_health_exposes_optional_ocr(self):
  _,health=self.call('/v1/health',{});self.assertTrue(health['ocrAvailable']);self.assertEqual(health['ocrEngine'],'tesseract')
 def test_auth_origin_and_no_url_or_command_fields(self):
  self.assertEqual(self.call('/v2/transcribe',request(),{'Authorization':'Bearer bad'})[0],401);self.assertEqual(self.call('/v2/transcribe',request(),{'Origin':'https://evil.invalid'})[0],403)
  body=request();body['command']='touch /tmp/never-run';self.assertEqual(self.call('/v2/transcribe',body)[0],400)
  body=request();body['image']={'mime':'image/png','url':'https://invalid.example/image.png'};_,result=self.call('/v2/transcribe',body);self.assertEqual(result['reason'],'OCR_PNG_REQUIRED')
 def test_malformed_and_oversized_png_return_review(self):
  for data in [b'not an image',b'x'*(MAX_PNG+1)]:
   _,result=self.call('/v2/transcribe',request(data));self.assertEqual(result['status'],'review');self.assertFalse(result['verification']['exact'])
 def test_client_disconnect_cleans_private_files_and_releases_slot(self):
  before=set(glob.glob(str(Path(tempfile.gettempdir())/(self.helper.ocr_temp_prefix+'*'))));body=json.dumps(request((FIXTURES/'ocr-cancellation-question.png').read_bytes())).encode()
  connection=socket.create_connection(('127.0.0.1',self.helper.server_port),timeout=3)
  head=(f'POST /v2/transcribe HTTP/1.1\r\nHost: 127.0.0.1:{self.helper.server_port}\r\nOrigin: {ORIGIN}\r\nAuthorization: Bearer {TOKEN}\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n').encode();connection.sendall(head+body)
  deadline=time.monotonic()+3;active=[]
  while time.monotonic()<deadline:
   active=[p for p in set(glob.glob(str(Path(tempfile.gettempdir())/(self.helper.ocr_temp_prefix+'*'))))-before if (Path(p)/'question.png').exists()]
   if active:break
   time.sleep(.01)
  self.assertTrue(active,'Real OCR job should have created its private question PNG')
  self.assertEqual(Path(active[0]).stat().st_mode&0o077,0);self.assertEqual((Path(active[0])/'question.png').stat().st_mode&0o077,0)
  started=time.monotonic();connection.setsockopt(socket.SOL_SOCKET,socket.SO_LINGER,struct.pack('ii',1,0));connection.close()
  released=False
  while time.monotonic()-started<1:
   if not any(Path(p).exists() for p in active) and self.helper.ocr_slot.acquire(False):
    self.helper.ocr_slot.release();released=True;break
   time.sleep(.01)
  self.assertFalse(any(Path(p).exists() for p in active),'Cancelled worker must not leave the private PNG behind')
  self.assertTrue(released,'Cancellation must clean files AND release its OCR slot within one second');self.assertEqual(self.call('/v1/health',{})[0],200)
if __name__=='__main__':unittest.main(verbosity=2)
