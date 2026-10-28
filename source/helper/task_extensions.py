"""Grounded finite inverse, rational-feature and ordered algebra-step adapters."""
import re
import sympy as s
from solver import Unsupported,equal,polynomial
from domain_math import parse_document,Node
EXTENSION_TASKS={'inverse-table','inverse-affine','rational-analysis','error-analysis'}
FEATURES={'zeros','poles','holes','horizontal-asymptote','slant-asymptote','end-positive','end-negative'}
def _utils():
 from task_solver import text,number,slots
 return text,number,slots
def _field(task,value):
 _,_,slots=_utils();mapping=slots(task,{'answer','value','solution','equation'})
 if len(mapping)>1:raise Unsupported('SINGLE_RESPONSE_SLOT_REQUIRED')
 return {next(iter(mapping),'answer'):value}
def _roots(poly,variable):
 roots=s.solveset(poly,variable,domain=s.S.Reals)
 if roots is s.S.EmptySet:return []
 if not isinstance(roots,s.FiniteSet) or len(roots)>16:raise Unsupported('FINITE_EXACT_ROOTS_REQUIRED')
 text,_,_=_utils()
 for root in roots:parse_document(text(root))
 return sorted(roots,key=s.default_sort_key)
def _poly(source):
 doc=parse_document(source);value=doc.values[0]
 p=polynomial(value)
 if p is not None and p.degree()>12:raise Unsupported('RATIONAL_ANALYSIS_DEGREE_LIMIT')
 if doc.symbols and doc.real_domain(next(iter(doc.symbols)))!=s.S.Reals:raise Unsupported('POLYNOMIAL_ORIGINAL_DOMAIN_REQUIRED')
 return doc,value

def solve_extension(task):
 text,number,slots=_utils();kind=task['task'];givens=task.get('givens',{});output=task.get('output',{});domain=[]
 if kind=='inverse-table':
  if set(givens)-{'points','target'}:raise Unsupported('UNSUPPORTED_GIVENS')
  points=givens.get('points')
  if not isinstance(points,list) or not 1<=len(points)<=30 or any(not isinstance(p,list) or len(p)!=2 for p in points):raise Unsupported('EXACT_TABLE_REQUIRED')
  values=[(number(p[0]),number(p[1])) for p in points];target=number(givens.get('target'))
  if len({p[0] for p in values})!=len(values):raise Unsupported('TABLE_NOT_A_FUNCTION')
  if len({p[1] for p in values})!=len(values):raise Unsupported('TABLE_INVERSE_NOT_A_FUNCTION')
  matches=[x for x,y in values if equal(y,target)]
  if len(matches)!=1:raise Unsupported('INVERSE_TARGET_NOT_IN_TABLE')
  answer={'kind':'scalar','value':text(matches[0])}
 elif kind=='inverse-affine':
  if givens:raise Unsupported('UNSUPPORTED_GIVENS')
  doc=parse_document(task.get('expression'));p=polynomial(doc.values[0])
  if p is None or p.degree()!=1 or doc.real_domain(p.gens[0])!=s.S.Reals:raise Unsupported('AFFINE_INVERSE_REQUIRED')
  x=p.gens[0];a,b=p.all_coeffs();inverse=(x-b)/a
  if not equal(doc.values[0].subs(x,inverse),x) or not equal(inverse.subs(x,doc.values[0]),x):raise Unsupported('INVERSE_COMPOSITION_FAILED')
  answer={'kind':'scalar','value':text(inverse),'form':'inverse'};domain=doc.domain()
 elif kind=='rational-analysis':
  if set(givens)-{'numerator','denominator','feature'}:raise Unsupported('UNSUPPORTED_GIVENS')
  feature=givens.get('feature')
  if feature not in FEATURES:raise Unsupported('UNSUPPORTED_RATIONAL_FEATURE')
  nd,n=_poly(givens.get('numerator'));dd,d=_poly(givens.get('denominator'));symbols=nd.symbols|dd.symbols
  if len(symbols)!=1 or d==0:raise Unsupported('ONE_VARIABLE_RATIONAL_REQUIRED')
  x=next(iter(symbols));original=parse_document(f'({givens["numerator"]})/({givens["denominator"]})');domain=original.domain()
  reduced=s.cancel(n/d);rn,rd=s.fraction(reduced);pn=s.Poly(rn,x,domain=s.QQ);pd=s.Poly(rd,x,domain=s.QQ)
  excluded=_roots(d,x)
  poles=[v for v in excluded if equal(rd.subs(x,v),0)]
  holes=[v for v in excluded if not equal(rd.subs(x,v),0)]
  if feature in ('zeros','poles','holes'):
   if feature=='zeros' and pn.is_zero:
    answer={'kind':'solution-set','values':[],'all':True,'excluded':[text(v) for v in excluded]}
   else:
    values=[v for v in _roots(rn,x) if not equal(d.subs(x,v),0)] if feature=='zeros' else poles if feature=='poles' else holes
    if feature=='holes' and output.get('form')=='points':
     points=[[text(v),text(s.cancel(reduced.subs(x,v)))] for v in values]
     rendered='{'+','.join('('+','.join(p)+')' for p in points)+'}'
     answer={'kind':'point-set','points':points,'fields':_field(task,rendered)}
    elif feature=='holes' and output.get('form') not in ('x-values',):raise Unsupported('HOLE_RESPONSE_FORM_REQUIRED')
    else:answer={'kind':'solution-set','values':[text(v) for v in values],'all':False,'excluded':[]}
  elif feature in ('horizontal-asymptote','slant-asymptote'):
   if pd.degree()==0:raise Unsupported('ASYMPTOTE_DEGENERATE_POLYNOMIAL')
   q,r=s.div(pn,pd)
   if feature=='horizontal-asymptote':
    exists=pn.degree()<=pd.degree();value=s.Integer(0) if pn.degree()<pd.degree() else pn.LC()/pd.LC()
   else:exists=q.degree()==1;value=q.as_expr()
   if exists:answer={'kind':'scalar','value':text(value),'form':feature}
   else:answer={'kind':'claim','value':'none','form':feature,'fields':_field(task,'No '+feature.replace('-',' '))}
  else:
   difference=pn.degree()-pd.degree()
   if pn.is_zero or difference<0:value=s.Integer(0)
   elif difference==0:value=pn.LC()/pd.LC()
   else:
    sign=s.sign(pn.LC()/pd.LC())*(-1 if feature=='end-negative' and difference%2 else 1)
    value=s.oo if sign>0 else -s.oo
   if value in (s.oo,-s.oo):answer={'kind':'limit','value':'positive-infinity' if value==s.oo else 'negative-infinity','fields':_field(task,'infinity' if value==s.oo else '-infinity')}
   else:answer={'kind':'scalar','value':text(value)}
 elif kind=='error-analysis':
  if set(givens)-{'steps'}:raise Unsupported('UNSUPPORTED_GIVENS')
  steps=givens.get('steps')
  if not isinstance(steps,list) or not 2<=len(steps)<=16 or not all(isinstance(v,str) for v in steps):raise Unsupported('ORDERED_STEPS_REQUIRED')
  documents=[parse_document(v,equation='=' in v) for v in steps]
  equations=[len(d.values)==2 for d in documents]
  if len(set(equations))!=1:raise Unsupported('MIXED_STEP_KINDS')
  original=documents[0];first=None
  for index,(before,after) in enumerate(zip(documents,documents[1:]),start=2):
   if equations[0]:
    from task_solver import solve_task
    if not before.symbols.issubset(original.symbols) or not after.symbols.issubset(original.symbols):raise Unsupported('STEP_VARIABLE_CHANGED')
    variable=next(iter(original.symbols),s.Symbol('x',real=True));carried_domain=original.real_domain(variable)
    if carried_domain is None:raise Unsupported('STEP_DOMAIN_UNPROVEN')
    def roots_of(doc):
     if not doc.symbols:
      return s.S.Reals if equal(doc.values[0],doc.values[1]) else s.S.EmptySet
     result=solve_task({'schema':'kubla-task-v1','task':'equation','expression':doc.source})['answer']
     if result['all']:return s.Complement(s.S.Reals,s.FiniteSet(*(number(v) for v in result['excluded'])))
     return s.FiniteSet(*(number(v) for v in result['values']))
    difference=s.SymmetricDifference(s.Intersection(roots_of(before),carried_domain),s.Intersection(roots_of(after),carried_domain))
    if difference is s.S.EmptySet:valid=True
    elif difference.is_empty is False:valid=False
    else:raise Unsupported('STEP_EQUIVALENCE_UNPROVEN')
   else:
    symbols=original.symbols|before.symbols|after.symbols
    if len(symbols)>1:raise Unsupported('ONE_VARIABLE_ONLY')
    if not before.values[0].is_rational_function() or not after.values[0].is_rational_function():raise Unsupported('RATIONAL_STEPS_REQUIRED')
    if symbols:
     variable=next(iter(symbols))
     for value in (before.values[0],after.values[0]):
      numerator,denominator=s.fraction(s.cancel(value))
      try:s.Poly(numerator,variable,domain=s.QQ);s.Poly(denominator,variable,domain=s.QQ)
      except (s.PolynomialError,s.CoercionFailed):raise Unsupported('RATIONAL_STEPS_REQUIRED')
    elif not before.values[0].is_Rational or not after.values[0].is_Rational:raise Unsupported('RATIONAL_STEPS_REQUIRED')
    delta=s.cancel(before.values[0]-after.values[0])
    if delta!=0:valid=False
    elif not after.symbols.issubset(original.symbols):valid=False
    elif not symbols:valid=after.valid({})
    else:
     variable=next(iter(symbols));old=original.real_domain(variable);new=after.real_domain(variable)
     if old is None or new is None:raise Unsupported('STEP_DOMAIN_UNPROVEN')
     subset=old.is_subset(new)
     if subset is None:
      lost=s.Complement(old,new)
      if lost is s.S.EmptySet:subset=True
      elif lost.is_empty is False:subset=False
     if subset is True:valid=True
     elif subset is False:valid=False
     else:raise Unsupported('STEP_DOMAIN_UNPROVEN')
   if not valid:first=index;break
  if first is None:answer={'kind':'claim','value':'all-valid','fields':_field(task,'No error')}
  else:answer={'kind':'scalar','value':str(first),'form':'step-number'}
 else:raise Unsupported('UNSUPPORTED_EXTENSION_TASK')
 return answer,domain

def _definition_rhs(value):
 match=re.match(r'^\s*(?:[fg]\(\s*[a-z]\s*\)|y)\s*=\s*(.+)$',value,re.S)
 return match.group(1) if match else value

def validate_extension_binding(document):
 task=document['task'];kind=task['task'];given=task.get('givens',{});original=document.get('original',{})
 instruction=str(original.get('instruction') or original.get('text') or '')
 expressions=[v.get('text','') for v in original.get('expressions',[]) if isinstance(v,dict)]
 normalize=lambda value:re.sub(r'\s+','',value).replace('−','-')
 if kind=='inverse-affine':
  if not re.search(r'\binverse\b',instruction,re.I):raise Unsupported('INVERSE_DIRECTIVE_NOT_GROUNDED')
  if not any(normalize(_definition_rhs(v))==normalize(task.get('expression','')) for v in expressions):raise Unsupported('TASK_EXPRESSION_NOT_ORIGINAL')
 elif kind=='inverse-table':
  if not re.search(r'\binverse\b|[fg]\s*\^\s*\{?-1\}?',instruction,re.I):raise Unsupported('INVERSE_DIRECTIVE_NOT_GROUNDED')
  target=re.escape(str(given.get('target','')))
  if not target or not re.search(r'[fg]\s*\^\s*(?:\{\s*-1\s*\}|-1)\s*\(\s*'+target+r'\s*\)',instruction+' '+' '.join(expressions),re.I):raise Unsupported('INVERSE_TARGET_NOT_GROUNDED')
  tables=document.get('tables',document.get('evidence',{}).get('tables',[]))
  if not any(isinstance(t,dict) and t.get('exact') is True and t.get('points')==given.get('points') for t in tables):raise Unsupported('EXACT_TABLE_NOT_GROUNDED')
 elif kind=='rational-analysis':
  feature=given.get('feature');directives={'zeros':r'\b(zeros?|x[ -]intercepts?)\b','poles':r'\b(poles?|vertical asymptotes?)\b','holes':r'\b(holes?|removable discontinuities)\b','horizontal-asymptote':r'\bhorizontal asymptote','slant-asymptote':r'\b(slant|oblique) asymptote','end-positive':r'(?:positive infinity|\+\s*(?:infinity|∞)|x\s*(?:→|->)\s*(?:infinity|∞))','end-negative':r'(?:negative infinity|-\s*(?:infinity|∞))'}
  if feature not in directives or not re.search(directives[feature],instruction,re.I):raise Unsupported('RATIONAL_FEATURE_NOT_GROUNDED')
  if len(expressions)!=1:raise Unsupported('SINGLE_RATIONAL_EXPRESSION_REQUIRED')
  parsed=parse_document(_definition_rhs(expressions[0]));numerator=parse_document(given.get('numerator'));denominator=parse_document(given.get('denominator'))
  if parsed.ast.kind!='div' or parsed.ast.args!=(numerator.ast,denominator.ast):raise Unsupported('RATIONAL_COMPONENTS_NOT_ORIGINAL')
  if feature=='holes' and task.get('output',{}).get('form')=='x-values' and not re.search(r'\bx[ -]values?\b|\bx\s*=',instruction,re.I):raise Unsupported('HOLE_RESPONSE_FORM_NOT_GROUNDED')
 elif kind=='error-analysis':
  if not re.search(r'\bfirst\b.{0,50}\b(incorrect|invalid|mistake|error)\b.{0,30}\b(step|line)\b|\bfirst\s+(?:incorrect|invalid)\s+(?:step|line)\b',instruction,re.I):raise Unsupported('ERROR_DIRECTIVE_NOT_GROUNDED')
  steps=given.get('steps');evidence=document.get('evidence',{}).get('steps',[])
  if not isinstance(steps,list) or len(steps)!=len(expressions) or any(normalize(a)!=normalize(b) for a,b in zip(steps,expressions)):raise Unsupported('STEPS_NOT_ORIGINAL')
  if len(evidence)!=len(steps) or any(not isinstance(e,dict) or e.get('number')!=i or normalize(str(e.get('expression','')))!=normalize(steps[i-1]) for i,e in enumerate(evidence,start=1)):raise Unsupported('ORDERED_STEP_LABELS_NOT_GROUNDED')
 else:raise Unsupported('UNSUPPORTED_EXTENSION_TASK')
 return task

def _split_values(source):
 values=[];start=0;depth=0
 for index,char in enumerate(source):
  if char in '({[':depth+=1
  elif char in ')}]':depth-=1
  elif char==',' and depth==0:values.append(source[start:index]);start=index+1
  if depth<0:raise Unsupported('OPTION_NOT_INTERPRETABLE')
 if depth:raise Unsupported('OPTION_NOT_INTERPRETABLE')
 values.append(source[start:])
 if any(not value.strip() for value in values) or len(values)>24:raise Unsupported('OPTION_NOT_INTERPRETABLE')
 return values

def _number_list(source):
 _,number,_=_utils()
 return [number(v.strip()) for v in _split_values(source)] if source.strip() else []

def _parse_option(task,source,expected):
 if not isinstance(source,str) or not source.strip() or len(source)>1200:raise Unsupported('OPTION_NOT_INTERPRETABLE')
 source=re.sub(r'\\(?:left|right)\s*','',source).replace(r'\{','{').replace(r'\}','}').strip().replace('−','-');compact=re.sub(r'\s+','',source).lower();kind=task['task'];feature=task.get('givens',{}).get('feature')
 if kind=='error-analysis':
  if re.fullmatch(r'(?:noerror|nomistake|allsteps(?:are)?(?:correct|valid))',compact):return ('claim','all-valid')
  match=re.fullmatch(r'(?:step|line)?\s*(\d+)',source,re.I)
  if not match or not 1<=int(match.group(1))<=len(task['givens']['steps']):raise Unsupported('OPTION_NOT_INTERPRETABLE')
  return ('scalar',str(int(match.group(1))))
 if kind=='rational-analysis' and feature in ('horizontal-asymptote','slant-asymptote'):
  names=('horizontal',) if feature=='horizontal-asymptote' else ('slant','oblique')
  if any(compact in ('no'+n+'asymptote','no'+n+'asymptotes') for n in names):return ('claim','none')
  if re.match(r'^y\s*=',source):source=source.split('=',1)[1]
 elif kind=='inverse-affine':
  symbols=parse_document(expected['value']).symbols
  variable=re.escape(str(next(iter(symbols)))) if len(symbols)==1 else 'x'
  source=re.sub(r'^[fg]\s*\^\s*(?:\{-1\}|-1)\s*\(\s*'+variable+r'\s*\)\s*=\s*','',source)
 if expected['kind'] in ('equation','field-map','quotient-remainder'):raise Unsupported('OPTION_RESPONSE_KIND_UNSUPPORTED')
 if expected['kind']=='solution-set':
  if compact in ('nosolution','nosolutions','emptyset','∅','{}'):return ('set',(False,[],[]))
  if kind=='rational-analysis' and feature=='poles' and compact in ('noverticalasymptote','noverticalasymptotes','nopoles'):return ('set',(False,[],[]))
  if kind=='rational-analysis' and feature=='holes' and compact in ('nohole','noholes','noremovablediscontinuities'):return ('set',(False,[],[]))
  match=re.fullmatch(r'all\s+real\s+numbers(?:\s+except\s*\{([^{}]*)\})?',source,re.I)
  if match:return ('set',(True,[],_number_list(match.group(1) or '')))
  variable=task.get('variable','x')
  if kind=='rational-analysis':
   symbols=parse_document(task['givens']['numerator']).symbols|parse_document(task['givens']['denominator']).symbols
   if len(symbols)==1:variable=str(next(iter(symbols)))
  if task.get('expression') and kind=='equation':
   doc=parse_document(task['expression'],True)
   if len(doc.symbols)==1:variable=str(next(iter(doc.symbols)))
  if re.match(r'^'+re.escape(variable)+r'\s*=',source):source=source.split('=',1)[1]
  if source.startswith('{') and source.endswith('}'):return ('set',(False,_number_list(source[1:-1]),[]))
  return ('set',(False,_number_list(source),[]))
 if expected['kind']=='point-set':
  if compact in ('nohole','noholes','{}','∅'):return ('points',[])
  if not source.startswith('{') or not source.endswith('}'):raise Unsupported('OPTION_NOT_INTERPRETABLE')
  pairs=[]
  for pair in _split_values(source[1:-1]):
   if not pair.strip().startswith('(') or not pair.strip().endswith(')'):raise Unsupported('OPTION_NOT_INTERPRETABLE')
   values=_number_list(pair.strip()[1:-1])
   if len(values)!=2:raise Unsupported('OPTION_NOT_INTERPRETABLE')
   pairs.append(values)
  return ('points',pairs)
 if compact in ('∞','+∞',r'\infty',r'+\infty','infinity','+infinity','positiveinfinity'):return ('limit','positive-infinity')
 if compact in ('-∞',r'-\infty','-infinity','negativeinfinity'):return ('limit','negative-infinity')
 doc=parse_document(source)
 return ('scalar',source)

def _number_equal(a,b):
 difference=s.simplify(s.trigsimp(a-b))
 if difference==0:return True
 if difference.is_zero is False:return False
 raise Unsupported('OPTION_NUMBER_COMPARISON_UNPROVEN')
def _set_equal(expected,candidate):
 def unique(values):
  out=[]
  for value in values:
   if not any(_number_equal(value,old) for old in out):out.append(value)
  return out
 expected=unique(expected);candidate=unique(candidate)
 return len(expected)==len(candidate) and all(any(_number_equal(v,w) for w in candidate) for v in expected)

def _scalar_proof(task,expected,candidate):
 """True/false only with an exact value and original-domain proof."""
 from task_solver import _same_value
 a=parse_document(expected);b=parse_document(candidate)
 original=a
 if task['task'] in ('factor','simplify','expand','evaluate') and task.get('expression'):
  base=task.get('output',{}).get('logBase');base=s.E if base=='e' else s.Rational(str(base)) if base is not None else None
  original=parse_document(task['expression'],log_base=base)
 if not b.symbols.issubset(original.symbols):raise Unsupported('OPTION_VARIABLE_UNSUPPORTED')
 delta=s.simplify(s.trigsimp(a.values[0]-b.values[0]))
 if delta==0:
  if original.symbols:
   x=next(iter(original.symbols));before=original.real_domain(x);after=b.real_domain(x)
   if before is None or after is None:raise Unsupported('OPTION_DOMAIN_UNPROVEN')
   implication=before.is_subset(after)
   if implication is None:
    lost=s.Complement(before,after)
    if lost is s.S.EmptySet:implication=True
    elif lost.is_empty is False:implication=False
   if implication is not True and implication is not False:raise Unsupported('OPTION_DOMAIN_UNPROVEN')
   if implication is False:return False
  if task['task']=='factor':
   from solver import factored_form
   return factored_form(b.values[0])
  if task['task']=='expand':return s.expand(b.values[0])==b.values[0]
  if task['task']=='simplify':return s.simplify(s.trigsimp(b.values[0]))==b.values[0]
  return True
 if not delta.free_symbols:
  if delta.is_zero is False:return False
  raise Unsupported('OPTION_VALUE_UNPROVEN')
 try:
  n,d=s.fraction(s.cancel(delta));x=next(iter(delta.free_symbols));s.Poly(n,x,domain=s.QQ);s.Poly(d,x,domain=s.QQ)
  return False
 except (s.PolynomialError,s.CoercionFailed):raise Unsupported('OPTION_VALUE_UNPROVEN')

def _compare_parsed(task,expected,parsed):
 text,number,_=_utils();kind,value=parsed
 if expected['kind']=='claim':return kind=='claim' and value==expected['value']
 if expected['kind']=='limit':return kind=='limit' and value==expected['value']
 if expected['kind']=='point-set':
  if kind!='points':return False
  points=[[number(v) for v in p] for p in expected['points']]
  return len(points)==len(value) and all(sum(_number_equal(p[0],q[0]) and _number_equal(p[1],q[1]) for q in value)==1 for p in points)
 if expected['kind']=='solution-set':
  if kind!='set':return False
  all_,values,excluded=value
  return all_==expected['all'] and _set_equal([number(v) for v in expected['values']],values) and _set_equal([number(v) for v in expected['excluded']],excluded)
 if kind!='scalar':return False
 return _scalar_proof(task,expected['value'],value)

def compare_extension_field(task,expected,source):
 try:return _compare_parsed(task,expected,_parse_option(task,source,expected))
 except (Unsupported,ValueError,TypeError,NotImplementedError):return None

def _same_parsed(task,a,b):
 if a[0]!=b[0]:return False
 kind,left=a;right=b[1]
 if kind=='scalar':
  neutral={**task,'task':'source-equivalence'}
  return _scalar_proof(neutral,left,right) and _scalar_proof(neutral,right,left)
 if kind in ('claim','limit'):return left==right
 if kind=='set':return left[0]==right[0] and _set_equal(left[1],right[1]) and _set_equal(left[2],right[2])
 if kind=='points':return len(left)==len(right) and all(sum(_number_equal(p[0],q[0]) and _number_equal(p[1],q[1]) for q in right)==1 for p in left)
 raise Unsupported('OPTION_NOT_INTERPRETABLE')

def compare_task_option(task,option):
 from task_solver import solve_task
 verification={'exact':True,'method':'typed-option-proof'}
 try:
  if not isinstance(option,dict) or set(option)-{'index','expression','text'}:raise Unsupported('INVALID_OPTION')
  if any(k in option and not isinstance(option[k],str) for k in ('text','expression')):raise Unsupported('INVALID_OPTION_TEXT')
  if 'index' in option and (type(option['index']) is not int or option['index']<0):raise Unsupported('INVALID_OPTION_INDEX')
  expected=solve_task(task)['answer']
  sources=[v for v in (option.get('expression'),option.get('text')) if isinstance(v,str) and v.strip()]
  if not sources:raise Unsupported('OPTION_NOT_INTERPRETABLE')
  parsed=[_parse_option(task,source,expected) for source in sources]
  if not all(_same_parsed(task,parsed[0],value) for value in parsed[1:]):raise Unsupported('OPTION_TEXT_MATH_CONTRADICTION')
  proofs=[_compare_parsed(task,expected,value) for value in parsed]
  if len(set(proofs))!=1:raise Unsupported('OPTION_TEXT_MATH_CONTRADICTION')
  return {'ok':True,'interpreted':True,'equivalent':proofs[0],'kind':expected['kind'],'verification':verification}
 except (Unsupported,ValueError,TypeError,NotImplementedError) as error:
  return {'ok':True,'interpreted':False,'equivalent':None,'reason':str(error)[:100],'verification':{'exact':False,'method':'not-proven'}}
