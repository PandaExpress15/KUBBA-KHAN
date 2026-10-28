"""Optional local printed-text transcription. OCR is never a mathematical proof.

Only bounded PNG bytes are accepted. No URL fetching, shell, language selection,
model tools or browser actions. Parent owns the private temporary directory.
"""
import base64,binascii,csv,io,json,math,os,resource,shutil,struct,subprocess,sys,zlib
from pathlib import Path
MAX_PNG=2*1024*1024
MAX_DIMENSION=2048
MAX_WORDS=200
class OCRError(ValueError):pass

def engine_path():return shutil.which('tesseract')

def availability():
 engine=engine_path()
 if not engine:return {'ocrAvailable':False,'ocrEngine':'tesseract','ocrReason':'TESSERACT_NOT_INSTALLED'}
 try:
  check=subprocess.run([engine,'--list-langs'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=.5,text=True,env=engine_env())
  available=check.returncode==0 and 'eng' in check.stdout.splitlines()
 except (OSError,subprocess.TimeoutExpired):available=False
 return {'ocrAvailable':available,'ocrEngine':'tesseract',**({} if available else {'ocrReason':'TESSERACT_ENG_UNAVAILABLE'})}

def engine_env():
 # Do not inherit TESSDATA_PREFIX, LD_PRELOAD, arbitrary language/config options
 # or model/tool instructions. Existing system installation supplies its data.
 return {'PATH':'/usr/bin:/bin:/usr/local/bin','LANG':'C.UTF-8','LC_ALL':'C.UTF-8','OMP_THREAD_LIMIT':'1','OMP_NUM_THREADS':'1'}

def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',binascii.crc32(kind+data)&0xffffffff)

def png_bytes(encoded):
 if not isinstance(encoded,str) or not 1<=len(encoded)<=((MAX_PNG+2)//3)*4:raise OCRError('OCR_IMAGE_SIZE')
 try:data=base64.b64decode(encoded,validate=True)
 except (ValueError,binascii.Error):raise OCRError('OCR_BASE64_INVALID') from None
 if len(data)>MAX_PNG:raise OCRError('OCR_IMAGE_SIZE')
 if not data.startswith(b'\x89PNG\r\n\x1a\n'):raise OCRError('OCR_PNG_REQUIRED')
 at=8;header=None;idat=[];palette=None;transparency=None;done=False;seen_idat=False;idat_ended=False
 while at<len(data):
  if at+12>len(data):raise OCRError('OCR_PNG_INVALID')
  size=struct.unpack('>I',data[at:at+4])[0];kind=data[at+4:at+8]
  if size>MAX_PNG or at+12+size>len(data):raise OCRError('OCR_PNG_INVALID')
  value=data[at+8:at+8+size];crc=struct.unpack('>I',data[at+8+size:at+12+size])[0];at+=12+size
  if binascii.crc32(kind+value)&0xffffffff!=crc:raise OCRError('OCR_PNG_CRC')
  if header is None and kind!=b'IHDR':raise OCRError('OCR_PNG_INVALID')
  if kind==b'IHDR':
   if header is not None or size!=13:raise OCRError('OCR_PNG_INVALID')
   width,height,depth,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',value)
   if not 1<=width<=MAX_DIMENSION or not 1<=height<=MAX_DIMENSION:raise OCRError('OCR_IMAGE_DIMENSIONS')
   if depth!=8 or color not in (0,2,3,4,6) or compression or filtering or interlace:raise OCRError('OCR_PNG_FORMAT_UNSUPPORTED')
   header=value
  elif kind==b'IDAT':
   if idat_ended:raise OCRError('OCR_PNG_INVALID')
   seen_idat=True;idat.append(value)
  else:
   if seen_idat:idat_ended=True
   if kind==b'IEND':
    if size or at!=len(data):raise OCRError('OCR_PNG_INVALID')
    done=True;break
   if kind==b'PLTE':
    if palette is not None or seen_idat or not 3<=size<=768 or size%3:raise OCRError('OCR_PNG_INVALID')
    palette=value
   elif kind==b'tRNS':
    if transparency is not None or seen_idat or size>256:raise OCRError('OCR_PNG_INVALID')
    transparency=value
   elif kind not in (b'cHRM',b'gAMA',b'sRGB',b'pHYs',b'tEXt',b'zTXt',b'iTXt',b'iCCP',b'bKGD',b'tIME'):
    raise OCRError('OCR_PNG_CHUNK_UNSUPPORTED')
   # All metadata is discarded before handing bytes to the image decoder.
 if not done or not idat or color==3 and palette is None:raise OCRError('OCR_PNG_INVALID')
 channels={0:1,2:3,3:1,4:2,6:4}[color];expected=(width*channels+1)*height;compressed=b''.join(idat)
 try:
  decoder=zlib.decompressobj();pixels=decoder.decompress(compressed,expected+1)
  if len(pixels)!=expected or not decoder.eof or decoder.unconsumed_tail or decoder.unused_data:raise OCRError('OCR_PNG_PIXEL_SIZE')
 except zlib.error:raise OCRError('OCR_PNG_DECOMPRESSION') from None
 row=width*channels+1
 if any(pixels[i]>4 for i in range(0,len(pixels),row)):raise OCRError('OCR_PNG_FILTER_INVALID')
 if palette is not None and color in (0,4):raise OCRError('OCR_PNG_PALETTE_INVALID')
 if transparency is not None and (color in (4,6) or color==0 and len(transparency)!=2 or color==2 and len(transparency)!=6 or color==3 and len(transparency)>len(palette)//3):raise OCRError('OCR_PNG_TRANSPARENCY_INVALID')
 sanitized=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',header)
 if palette is not None:sanitized+=chunk(b'PLTE',palette)
 if transparency is not None:sanitized+=chunk(b'tRNS',transparency)
 sanitized+=chunk(b'IDAT',compressed)+chunk(b'IEND',b'')
 return sanitized,width,height

def tesseract_limits():
 resource.setrlimit(resource.RLIMIT_CPU,(4,4));resource.setrlimit(resource.RLIMIT_AS,(768*1024*1024,768*1024*1024))
 resource.setrlimit(resource.RLIMIT_FSIZE,(1048576,1048576))

def transcribe_request(body,directory):
 if not isinstance(body,dict) or set(body)!={'image','fingerprint','source'} or body.get('source')!='question-crop':raise OCRError('OCR_REQUEST_INVALID')
 fingerprint=body.get('fingerprint')
 if not isinstance(fingerprint,str) or not 1<=len(fingerprint)<=200:raise OCRError('FINGERPRINT_REQUIRED')
 image=body.get('image')
 if not isinstance(image,dict) or set(image)!={'mime','data'} or image.get('mime')!='image/png':raise OCRError('OCR_PNG_REQUIRED')
 png,width,height=png_bytes(image.get('data'))
 engine=engine_path()
 if not engine:raise OCRError('TESSERACT_NOT_INSTALLED')
 directory=Path(directory)
 if not directory.is_dir() or directory.stat().st_mode&0o077:raise OCRError('OCR_PRIVATE_DIRECTORY_REQUIRED')
 input_file=directory/'question.png';output_base=directory/'transcription'
 with input_file.open('xb') as target:target.write(png)
 input_file.chmod(0o600)
 try:
  result=subprocess.run([engine,str(input_file),str(output_base),'-l','eng','--psm','6','tsv'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=4,env=engine_env(),preexec_fn=tesseract_limits)
 except subprocess.TimeoutExpired:raise OCRError('OCR_TIME_LIMIT') from None
 except OSError:raise OCRError('OCR_ENGINE_UNAVAILABLE') from None
 output=directory/'transcription.tsv'
 if result.returncode or not output.exists():raise OCRError('OCR_ENGINE_FAILED')
 if output.stat().st_size>1048576:raise OCRError('OCR_OUTPUT_LIMIT')
 words=[];lines=[];current=None;truncated=False
 for item in csv.DictReader(io.StringIO(output.read_text(encoding='utf-8',errors='strict')),delimiter='\t'):
  if item.get('level')!='5' or not item.get('text','').strip():continue
  if len(words)>=MAX_WORDS:truncated=True;break
  try:
   confidence=float(item['conf']);x,y,w,h=[int(item[key]) for key in ('left','top','width','height')]
  except (ValueError,KeyError):raise OCRError('OCR_TSV_INVALID') from None
  if not math.isfinite(confidence) or not 0<=confidence<=100 or min(x,y,w,h)<0 or x+w>width or y+h>height:raise OCRError('OCR_TSV_INVALID')
  value=item['text'].strip()
  if len(value)>80:value=value[:80];truncated=True
  key=(item.get('block_num'),item.get('par_num'),item.get('line_num'))
  if key!=current:lines.append([]);current=key
  lines[-1].append(value);words.append({'text':value,'confidence':round(confidence,3),'box':{'x':x,'y':y,'width':w,'height':h}})
 transcription='\n'.join(' '.join(line) for line in lines)
 if len(transcription)>8000:transcription=transcription[:8000];truncated=True
 return {'ok':True,'status':'transcribed','source':'local-ocr-unverified','fingerprint':fingerprint,'engine':'tesseract','image':{'width':width,'height':height},'transcription':transcription,'words':words,'truncated':truncated,'verification':{'exact':False,'method':'ocr-unverified'}}

if __name__=='__main__':
 resource.setrlimit(resource.RLIMIT_CPU,(4,4));resource.setrlimit(resource.RLIMIT_AS,(768*1024*1024,768*1024*1024));resource.setrlimit(resource.RLIMIT_FSIZE,(3*1048576,3*1048576))
 try:
  incoming=json.loads(sys.stdin.read(3*1024*1024+1));result=transcribe_request(incoming['body'],incoming['internalDirectory'])
 except OCRError as error:result={'ok':False,'status':'review','reason':str(error),'verification':{'exact':False,'method':'ocr-unverified'}}
 except Exception:result={'ok':False,'status':'review','reason':'OCR_FAILED','verification':{'exact':False,'method':'ocr-unverified'}}
 print(json.dumps(result,separators=(',',':')))
