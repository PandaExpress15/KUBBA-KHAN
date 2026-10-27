"""One resource-bounded operation; launched by the loopback server."""
import json,sys,resource
resource.setrlimit(resource.RLIMIT_CPU,(3,3))
resource.setrlimit(resource.RLIMIT_AS,(768*1024*1024,768*1024*1024))
from solver import solve_request,verify_request,Unsupported
try:
    request=json.loads(sys.stdin.read(8193))
    result=(verify_request if request['action']=='verify' else solve_request)(request['body'])
except Unsupported as error:
    result={'ok':False,'status':'unsupported','reason':str(error)}
except Exception:
    result={'ok':False,'status':'unsupported','reason':'EXACT_SOLVER_FAILED'}
print(json.dumps(result,separators=(',',':')))
