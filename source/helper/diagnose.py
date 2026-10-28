#!/usr/bin/env python3
"""Owner-run, privacy-limited local prerequisites report. Never reads browser/config data."""
import json,os,platform,shutil,sys,subprocess,re
from pathlib import Path
from reasoner import ollama_request,has_remote_metadata,ReasoningUnavailable

def report():
 result={'schema':'kubla-local-diagnostics-v1','python':platform.python_version(),'system':platform.system(),
         'machine':platform.machine(),'logicalCpuCount':os.cpu_count(),'freeDiskMiB':shutil.disk_usage(Path(__file__).parent).free//1048576}
 try:result['ramMiB']=os.sysconf('SC_PAGE_SIZE')*os.sysconf('SC_PHYS_PAGES')//1048576
 except (ValueError,OSError,AttributeError):result['ramMiB']=None
 try:
  import sympy
  result['sympyVersion']=sympy.__version__
 except ImportError:result['sympyVersion']=None
 result['nvidiaGpus']=[]
 if shutil.which('nvidia-smi'):
  try:
   gpu=subprocess.run(['nvidia-smi','--query-gpu=name,memory.total,memory.free','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=2)
   if gpu.returncode==0:
    for line in gpu.stdout.splitlines()[:8]:
     fields=line.split(',')
     if len(fields)==3 and fields[1].strip().isdigit() and fields[2].strip().isdigit():result['nvidiaGpus'].append({'name':fields[0].strip()[:100],'totalMiB':int(fields[1]),'freeMiB':int(fields[2])})
  except (OSError,subprocess.TimeoutExpired):pass
 try:
  tags=ollama_request('/api/tags',timeout=1);models=tags.get('models',[])
  result['ollamaReachable']=True;result['installedModels']=[]
  if isinstance(models,list):
   for model in models[:40]:
    if not isinstance(model,dict):continue
    result['installedModels'].append({'name':str(model.get('name',''))[:96],
      'sizeMiB':model.get('size',0)//1048576 if isinstance(model.get('size'),int) else None,
      'format':model.get('details',{}).get('format') if isinstance(model.get('details'),dict) else None,
      'remoteMetadata':has_remote_metadata(model)})
  try:
   version=ollama_request('/api/version',timeout=.5).get('version','')
   if isinstance(version,str) and re.fullmatch(r'[A-Za-z0-9.+-]{1,60}',version):result['ollamaVersion']=version
  except ReasoningUnavailable:pass
 except ReasoningUnavailable as error:result.update(ollamaReachable=False,reason=str(error),installedModels=[])
 from ocr import availability as ocr_availability,engine_path,engine_env
 result.update(ocr_availability())
 if result['ocrAvailable']:
  try:
   check=subprocess.run([engine_path(),'--version'],stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=.5,env=engine_env())
   version=check.stdout.splitlines()[0] if check.stdout else ''
   if re.fullmatch(r'tesseract [0-9][A-Za-z0-9.+-]{0,30}',version):result['ocrVersion']=version
  except (OSError,subprocess.TimeoutExpired):pass
 return result
if __name__=='__main__':print(json.dumps(report(),indent=2))
