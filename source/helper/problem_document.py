"""Bounded public-question documents. No private application state or model tools."""
import json,re,math
class InvalidDocument(ValueError):pass
RESERVED={'__proto__','prototype','constructor'}
TASKS={'factor','simplify','expand','evaluate','equation','complete-square','divide','slope','point-slope','rate','average-rate','inverse-table','inverse-affine','rational-analysis','error-analysis'}

def bounded_tree(value,depth=0,counter=None):
 counter=[0] if counter is None else counter;counter[0]+=1
 if counter[0]>2500 or depth>10:raise InvalidDocument('DOCUMENT_STRUCTURE_LIMIT')
 if isinstance(value,float) and not math.isfinite(value):raise InvalidDocument('DOCUMENT_NONFINITE_NUMBER')
 if value is None or isinstance(value,(bool,int,float)):return
 if isinstance(value,str):
  if len(value)>7000:raise InvalidDocument('DOCUMENT_TEXT_LIMIT')
 elif isinstance(value,list):
  if len(value)>100:raise InvalidDocument('DOCUMENT_ARRAY_LIMIT')
  for item in value:bounded_tree(item,depth+1,counter)
 elif isinstance(value,dict):
  if len(value)>50 or any(not isinstance(k,str) or len(k)>100 or k in RESERVED for k in value):raise InvalidDocument('DOCUMENT_KEY_LIMIT')
  for item in value.values():bounded_tree(item,depth+1,counter)
 else:raise InvalidDocument('DOCUMENT_VALUE_INVALID')

def validate_document(document):
 bounded_tree(document)
 if not isinstance(document,dict) or document.get('schema')!='kubla-problem-v1':raise InvalidDocument('PROBLEM_SCHEMA_REQUIRED')
 if len(json.dumps(document,separators=(',',':')))>32768:raise InvalidDocument('DOCUMENT_SIZE_LIMIT')
 fingerprint=document.get('fingerprint')
 if not isinstance(fingerprint,str) or not 1<=len(fingerprint)<=200:raise InvalidDocument('FINGERPRINT_REQUIRED')
 original=document.get('original')
 if not isinstance(original,dict):raise InvalidDocument('ORIGINAL_QUESTION_REQUIRED')
 for field in ('instruction','text'):
  if not isinstance(original.get(field,''),str):raise InvalidDocument('ORIGINAL_TEXT_INVALID')
 expressions=original.get('expressions',[])
 if not isinstance(expressions,list) or len(expressions)>24:raise InvalidDocument('ORIGINAL_EXPRESSIONS_INVALID')
 for item in expressions:
  if not isinstance(item,dict) or not isinstance(item.get('text'),str) or len(item['text'])>600:raise InvalidDocument('ORIGINAL_EXPRESSION_INVALID')
 response=document.get('response',{})
 if not isinstance(response,dict):raise InvalidDocument('RESPONSE_INVALID')
 for key,limit in (('slots',16),('choices',32)):
  if not isinstance(response.get(key,[]),list) or len(response.get(key,[]))>limit:raise InvalidDocument('RESPONSE_LIMIT')
 for slot in response.get('slots',[]):
  if not isinstance(slot,dict) or slot.get('id') in RESERVED:raise InvalidDocument('SLOT_INVALID')
 for choice in response.get('choices',[]):
  if not isinstance(choice,dict) or type(choice.get('index')) is not int or not 0<=choice['index']<32 or not isinstance(choice.get('text'),str) or not isinstance(choice.get('expression'),str):raise InvalidDocument('CHOICE_INVALID')
 task=document.get('task')
 if task is not None and (not isinstance(task,dict) or task.get('schema')!='kubla-task-v1' or task.get('task') not in TASKS):raise InvalidDocument('TASK_SCHEMA_INVALID')
 if isinstance(task,dict):
  task_slots=task.get('slots',[])
  if not isinstance(task_slots,list) or len(task_slots)>16:raise InvalidDocument('TASK_SLOT_INVALID')
  for slot in task_slots:
   if not isinstance(slot,dict) or slot.get('id') in RESERVED:raise InvalidDocument('SLOT_INVALID')
 return document

def model_document(document):
 """Copy only scoped public facts. Exclude URL, selectors, work and current selections."""
 validate_document(document)
 original=document['original'];response=document.get('response',{})
 slots=[]
 for slot in response.get('slots',[]):
  if not isinstance(slot,dict):raise InvalidDocument('SLOT_INVALID')
  slots.append({k:slot[k] for k in ('id','role','kind','label','template') if k in slot})
 choices=[]
 for choice in response.get('choices',[]):
  if not isinstance(choice,dict):raise InvalidDocument('CHOICE_INVALID')
  choices.append({k:choice[k] for k in ('index','expression','text') if k in choice})
 evidence=document.get('evidence',{})
 if not isinstance(evidence,dict):raise InvalidDocument('EVIDENCE_INVALID')
 return {'schema':document['schema'],'fingerprint':document['fingerprint'],
  'original':{k:original[k] for k in ('instruction','text','expressions','ordinal','total') if k in original},
  'task':document.get('task'),'response':{'kind':response.get('kind','unknown'),'slots':slots,'choices':choices},
  'evidence':{k:evidence[k] for k in ('tables','graph') if k in evidence},'notation':document.get('notation',{})}

def bind_result(result,document):
 return {**result,'binding':{'fingerprint':document['fingerprint'],'schema':document['schema']}}

# These complete directives have no omitted conditions. The independent binder
# recognizes them; a model supplies a proposal, never the semantic authority.
FORMAL_DIRECTIVES={
 'factor':r'(?:write|express) (?:the |this )?(?:expression|polynomial) (?:as (?:a )?product of (?:irreducible )?factors|in factored form)',
 'expand':r'(?:write|express) (?:the |this )?(?:expression|polynomial) in (?:expanded|standard polynomial) form',
 'simplify':r'(?:write|express) (?:the |this )?(?:expression|polynomial) in (?:its )?(?:simplest|reduced) form',
 'evaluate':r'(?:determine|compute|find) (?:the )?(?:exact|numerical) (?:value|result)(?: of (?:the |this )?expression)?',
 'equation':r'find (?:all )?(?:the )?(?:real )?(?:solutions|roots) (?:of|to|for) (?:the |this )?equation'
}

def grounded_directive(kind,instruction):
 if not isinstance(instruction,str):return False
 normalized=re.sub(r'\s+',' ',instruction).strip().rstrip('.!?').lower()
 return kind in FORMAL_DIRECTIVES and re.fullmatch(FORMAL_DIRECTIVES[kind],normalized) is not None

def recover_formal_task(document,proposed):
 """Only a complete directive + one exact expression + one named slot can recover.

No word-problem interpretation, inferred coordinates, invented domains/precision,
choice selection, or model-supplied slot semantics can pass this gate.
"""
 validate_document(document)
 if document.get('task') is not None or not isinstance(proposed,dict):raise InvalidDocument('TASK_RECOVERY_NOT_ALLOWED')
 if set(proposed)-{'schema','task','expression','variable','domain','givens','slots','output'} or proposed.get('schema')!='kubla-task-v1':raise InvalidDocument('TASK_SCHEMA_INVALID')
 original=document['original'];kind=proposed.get('task');instruction=original.get('instruction','')
 if not grounded_directive(kind,instruction):raise InvalidDocument('FORMAL_DIRECTIVE_NOT_GROUNDED')
 expressions=original.get('expressions',[])
 if len(expressions)!=1:raise InvalidDocument('SINGLE_FORMAL_EXPRESSION_REQUIRED')
 expression=expressions[0]['text'];normalize=lambda text:re.sub(r'\s+','',text).replace('−','-')
 if not isinstance(proposed.get('expression'),str) or normalize(proposed['expression'])!=normalize(expression):raise InvalidDocument('TASK_EXPRESSION_NOT_ORIGINAL')
 # Refuse to silently drop words/conditions outside the complete directive.
 boundary=original.get('text','')
 if '<diagram>' in boundary:raise InvalidDocument('DIAGRAM_REQUIRES_INTERPRETATION')
 boundary=boundary.replace('<math>','').replace('</math>','').replace('<response>','')
 whole=normalize(boundary);stem=normalize(instruction);math=normalize(expression)
 if whole not in ('',stem,stem+math,stem+math+'=',math+stem):raise InvalidDocument('ADDITIONAL_QUESTION_TEXT_NOT_GROUNDED')
 response=document.get('response',{});slots=response.get('slots',[])
 if response.get('kind') not in ('native','mathquill') or len(slots)!=1:raise InvalidDocument('FORMAL_RESPONSE_NOT_GROUNDED')
 slot=slots[0]
 if slot.get('role') not in ('answer','value','solution') or slot.get('disabled') is not False or str(slot.get('value','')).strip():raise InvalidDocument('RESPONSE_NOT_EMPTY_OR_ENABLED')
 graph=document.get('evidence',{}).get('graph',{})
 if not isinstance(graph,dict) or graph.get('relevant') or graph.get('interactiveResponse') or graph.get('points'):raise InvalidDocument('GRAPH_REQUIRES_INTERPRETATION')
 if response.get('choices') or document.get('evidence',{}).get('tables'):raise InvalidDocument('ADDITIONAL_EVIDENCE_REQUIRES_INTERPRETATION')
 expected_slots=[{'id':slot['id'],'role':slot['role']}]
 if proposed.get('slots')!=expected_slots:raise InvalidDocument('SLOT_ROLE_NOT_GROUNDED')
 if proposed.get('givens',{})!={} or proposed.get('output',{})!={} or proposed.get('variable') is not None:raise InvalidDocument('MODEL_CONSTRAINT_NOT_GROUNDED')
 expected_domain='rational' if kind=='factor' else 'real'
 if proposed.get('domain',expected_domain)!=expected_domain:raise InvalidDocument('MODEL_DOMAIN_NOT_GROUNDED')
 notation=document.get('notation',{})
 if any(notation.get(k) for k in ('mixedNumber','logBase','angleUnit')):raise InvalidDocument('NOTATION_REQUIRES_EXPLICIT_TASK')
 return {'schema':'kubla-task-v1','task':kind,'expression':expression,'domain':expected_domain,'givens':{},'slots':expected_slots,'output':{}}
