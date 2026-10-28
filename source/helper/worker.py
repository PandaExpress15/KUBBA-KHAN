"""One resource-bounded exact operation; launched by the loopback server."""
import json,sys,resource
resource.setrlimit(resource.RLIMIT_CPU,(3,3))
resource.setrlimit(resource.RLIMIT_AS,(768*1024*1024,768*1024*1024))
from solver import solve_request,verify_request,Unsupported
try:
    request=json.loads(sys.stdin.read(70001));action=request['action'];body=request['body']
    if action in ('task-solve','task-verify','task-compare'):
        from problem_document import validate_document,bind_result
        from task_solver import solve_task,verify_task,validate_document_binding
        document=validate_document(body['document']);validate_document_binding(document)
        if action=='task-solve':result=solve_task(document['task'])
        elif action=='task-compare':
            option=body.get('option');choices=document.get('response',{}).get('choices',[])
            if not isinstance(option,dict) or set(option)-{'index','text','expression','selected'}:raise Unsupported('OPTION_NOT_CAPTURED')
            matches=[c for c in choices if isinstance(c,dict) and type(c.get('index')) is int and c.get('index')==option.get('index')]
            if type(option.get('index')) is not int or len(matches)!=1 or any(option.get(k)!=matches[0].get(k) for k in ('index','text','expression')):raise Unsupported('OPTION_NOT_CAPTURED')
            if 'answer' in body and body['answer']!=solve_task(document['task'])['answer']:raise Unsupported('ANSWER_NOT_ORIGINAL')
            from task_extensions import compare_task_option
            result=compare_task_option(document['task'],{k:option[k] for k in ('index','text','expression') if k in option})
        else:result=verify_task({'task':document['task'],'answer':body.get('answer'),'observed':body.get('observed')})
        result=bind_result(result,document)
    else:result=(verify_request if action=='verify' else solve_request)(body)
except ValueError as error:
    result={'ok':False,'status':'unsupported','reason':str(error)[:120]}
except Exception:
    result={'ok':False,'status':'unsupported','reason':'EXACT_SOLVER_FAILED'}
print(json.dumps(result,separators=(',',':')))
