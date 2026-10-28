"""Bounded, typed exact task adapters. Models supply data, never executable code."""
import re
from urllib.parse import urlsplit
import sympy as s
from solver import Unsupported,equal,polynomial,factored_form,certificate
from domain_math import parse_document

from task_extensions import EXTENSION_TASKS,solve_extension,validate_extension_binding
TASKS=EXTENSION_TASKS|{'factor','expand','simplify','evaluate','equation','complete-square','divide','slope','rate','average-rate','point-slope'}
def text(v):return s.sstr(v).replace('**','^').replace('log(','ln(')
def number(v):
    if not isinstance(v,(str,int)) or isinstance(v,bool):raise Unsupported('EXACT_NUMBER_REQUIRED')
    d=parse_document(str(v))
    if d.symbols or d.values[0].is_real is not True:raise Unsupported('EXACT_NUMBER_REQUIRED')
    return d.values[0]
def slots(task,allowed):
    result={}
    if not isinstance(task.get('slots',[]),list) or len(task.get('slots',[]))>8:raise Unsupported('INVALID_RESPONSE_SLOT')
    for slot in task.get('slots',[]):
        if not isinstance(slot,dict) or set(slot)-{'id','role'} or not isinstance(slot.get('id'),str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,40}',slot['id']) or slot.get('role') not in allowed or slot['id'] in ('__proto__','constructor','prototype') or slot['id'] in result:raise Unsupported('INVALID_RESPONSE_SLOT')
        result[slot['id']]=slot['role']
    return result

def solve_task(task):
    if not isinstance(task,dict) or task.get('schema')!='kubla-task-v1' or set(task)-{'schema','task','expression','variable','domain','givens','slots','output'}:raise Unsupported('INVALID_TYPED_TASK')
    kind=task.get('task');givens=task.get('givens',{});output=task.get('output',{})
    if kind not in TASKS or not isinstance(givens,dict) or not isinstance(output,dict):raise Unsupported('UNSUPPORTED_TYPED_TASK')
    if set(output)-{'kind','angleUnit','logBase','unit','form','decimalPlaces'}:raise Unsupported('UNSUPPORTED_OUTPUT_CONSTRAINT')
    if task.get('domain','real') not in ('real','rational'):raise Unsupported('UNSUPPORTED_DOMAIN')
    if kind=='equation' and task.get('domain','real')!='real':raise Unsupported('REAL_EQUATION_DOMAIN_REQUIRED')
    if output.get('angleUnit','radians') not in ('degrees','radians'):raise Unsupported('UNSUPPORTED_ANGLE_UNIT')
    base=output.get('logBase');base=s.E if base=='e' else number(base) if base is not None else None
    domain=[]
    if kind in EXTENSION_TASKS:
        answer,domain=solve_extension(task)
    elif kind in ('slope','rate','average-rate','point-slope'):
        if set(givens)-{'points','interval','slope'}:raise Unsupported('UNSUPPORTED_GIVENS')
        points=givens.get('points')
        if not isinstance(points,list) or not 1<=len(points)<=30 or any(not isinstance(p,list) or len(p)!=2 for p in points):raise Unsupported('EXACT_POINTS_REQUIRED')
        points=[(number(p[0]),number(p[1])) for p in points];x0,y0=points[0]
        if kind=='point-slope' and 'slope' in givens:
            if len(points)!=1:raise Unsupported('ONE_POINT_WITH_SLOPE_REQUIRED')
            slope=number(givens['slope'])
        else:
            if len(points)<2:raise Unsupported('TWO_POINTS_REQUIRED')
            if kind=='average-rate':
                interval=givens.get('interval')
                if not isinstance(interval,list) or len(interval)!=2:raise Unsupported('AVERAGE_RATE_INTERVAL_REQUIRED')
                start,end=map(number,interval)
                first=[p for p in points if equal(p[0],start)];last=[p for p in points if equal(p[0],end)]
                if len(first)!=1 or len(last)!=1 or equal(start,end):raise Unsupported('AVERAGE_RATE_ENDPOINTS_AMBIGUOUS')
                x0,y0=first[0];x1,y1=last[0]
            else:x1,y1=points[1]
            if x1==x0:raise Unsupported('VERTICAL_RATE_UNDEFINED')
            slope=s.cancel((y1-y0)/(x1-x0))
            if kind!='average-rate' and any(not equal(y-y0,slope*(x-x0)) for x,y in points):raise Unsupported('NONCONSTANT_RATE')
        if kind=='point-slope':answer={'kind':'equation','equation':f'y-({text(y0)})=({text(slope)})*(x-({text(x0)}))','form':'point-slope'}
        else:answer={'kind':'scalar','value':text(slope)}
    elif kind=='divide':
        if set(givens)-{'dividend','divisor'}:raise Unsupported('UNSUPPORTED_GIVENS')
        a=parse_document(givens.get('dividend'));b=parse_document(givens.get('divisor'));symbols=a.symbols|b.symbols
        if len(symbols)!=1:raise Unsupported('ONE_VARIABLE_POLYNOMIAL_REQUIRED')
        variable=next(iter(symbols))
        if a.real_domain(variable)!=s.S.Reals or b.real_domain(variable)!=s.S.Reals:raise Unsupported('POLYNOMIAL_ORIGINAL_DOMAIN_REQUIRED')
        p=s.Poly(a.values[0],variable,domain=s.QQ);q=s.Poly(b.values[0],variable,domain=s.QQ)
        if p.degree()>24 or q.degree()>24 or q.is_zero:raise Unsupported('POLYNOMIAL_DIVISION_LIMIT')
        quotient,remainder=s.div(p,q)
        if not (p==q*quotient+remainder) or not remainder.is_zero and remainder.degree()>=q.degree():raise Unsupported('DIVISION_VERIFICATION_FAILED')
        answer={'kind':'quotient-remainder','quotient':text(quotient.as_expr()),'remainder':text(remainder.as_expr())}
        mapping=slots(task,{'quotient','remainder'})
        if mapping:answer['fields']={identifier:answer[role] for identifier,role in mapping.items()}
    else:
        document=parse_document(task.get('expression'),equation=kind=='equation',log_base=base);domain=document.domain();original=document.values[0]
        if kind=='complete-square':
            if set(givens)-{'variable','template'}:raise Unsupported('UNSUPPORTED_GIVENS')
            p=polynomial(original)
            if p is None or p.degree()!=2:raise Unsupported('QUADRATIC_REQUIRED')
            variable=p.gens[0];a,b,c=p.all_coeffs();shift=b/(2*a);constant=c-b*b/(4*a)
            if not equal(original,a*(variable+shift)**2+constant):raise Unsupported('COMPLETING_SQUARE_VERIFICATION_FAILED')
            mapping=slots(task,{'shift','vertex','constant','coefficient'})
            if not mapping or 'constant' not in mapping.values() or not ({'shift','vertex'}&set(mapping.values())):raise Unsupported('COMPLETING_SQUARE_TEMPLATE_REQUIRED')
            values={'shift':shift,'vertex':-shift,'constant':constant,'coefficient':a}
            fields={identifier:text(values[role]) for identifier,role in mapping.items()}
            template=givens.get('template')
            if not isinstance(template,str) or len(template)>300 or set(re.findall(r'\{([A-Za-z0-9_-]+)\}',template))!=set(mapping):raise Unsupported('COMPLETING_SQUARE_TEMPLATE_REQUIRED')
            reconstruction=template
            for identifier,value in fields.items():reconstruction=reconstruction.replace('{'+identifier+'}','('+value+')')
            if not equal(parse_document(reconstruction).values[0],original):raise Unsupported('COMPLETING_SQUARE_TEMPLATE_SIGN_MISMATCH')
            answer={'kind':'field-map','fields':fields}
        elif kind=='equation':
            if len(document.symbols)!=1:raise Unsupported('ONE_VARIABLE_EQUATION_REQUIRED')
            variable=next(iter(document.symbols));left,right=document.values
            # solveset is bounded by the helper process and preserves completeness;
            # ConditionSet/approximate output is never declared a solved set.
            if max(s.count_ops(left),s.count_ops(right))>100:raise Unsupported('EQUATION_WORK_LIMIT')
            roots=s.solveset(left-right,variable,domain=s.S.Reals)
            excluded=[]
            if roots is s.S.Reals:
                for condition,value in document.constraints:
                    if condition!='nonzero':raise Unsupported('NONDISCRETE_SOLUTION_DOMAIN')
                    forbidden=s.solveset(value,variable,domain=s.S.Reals)
                    if forbidden is not s.S.EmptySet and not isinstance(forbidden,s.FiniteSet):raise Unsupported('NONDISCRETE_SOLUTION_DOMAIN')
                    excluded.extend(list(forbidden))
                answer={'kind':'solution-set','values':[],'all':True,'excluded':[text(v) for v in sorted(set(excluded),key=s.default_sort_key)]}
            elif roots is s.S.EmptySet or isinstance(roots,s.FiniteSet):
                candidates=[v for v in roots if document.valid({variable:v}) and equal(left.subs(variable,v),right.subs(variable,v))]
                if len(candidates)>24:raise Unsupported('SOLUTION_COUNT_LIMIT')
                answer={'kind':'solution-set','values':[text(v) for v in sorted(candidates,key=s.default_sort_key)],'all':False,'excluded':[]}
            else:raise Unsupported('NONFINITE_OR_UNPROVEN_SOLUTION_SET')
        else:
            if kind=='factor':
                if task.get('domain','rational')!='rational':raise Unsupported('RATIONAL_FACTOR_DOMAIN_REQUIRED')
                polynomial(original);value=s.factor(original)
                if not factored_form(value):raise Unsupported('INCOMPLETE_FACTOR_FORM')
            elif kind=='expand':value=s.expand(original)
            elif kind=='simplify':value=s.simplify(s.trigsimp(original))
            else:
                if document.symbols:raise Unsupported('NUMERIC_EXPRESSION_REQUIRED')
                value=s.simplify(s.trigsimp(original))
            if not equal(original,value):raise Unsupported('ORIGINAL_VERIFICATION_FAILED')
            if value.has(s.I,s.zoo,s.nan,s.oo,-s.oo) or value.is_real is False:raise Unsupported('REAL_FINITE_ANSWER_REQUIRED')
            if output.get('angleUnit')=='degrees':
                inverse=document.ast.kind=='function' and document.ast.args[0] in ('asin','acos','atan','arcsin','arccos','arctan')
                if not inverse:raise Unsupported('ANGLE_OUTPUT_TASK_REQUIRED')
                value=s.simplify(value*180/s.pi)
            if 'decimalPlaces' in output:
                places=output['decimalPlaces']
                if type(places) is not int or not 0<=places<=8 or value.free_symbols:raise Unsupported('INVALID_DECIMAL_PRECISION')
                scaled=s.floor(abs(value)*10**places+s.Rational(1,2))
                if not scaled.is_Integer:raise Unsupported('ROUNDING_NOT_EXACTLY_PROVEN')
                if value.is_negative is not True and value.is_nonnegative is not True:raise Unsupported('ROUNDING_SIGN_UNPROVEN')
                sign=-1 if value.is_negative else 1
                numerator=int(scaled)*sign
                rendered=(('-' if numerator<0 else '')+str(abs(numerator)//10**places)+('.'+str(abs(numerator)%10**places).zfill(places) if places else ''))
            else:rendered=text(value)
            answer={'kind':'scalar','value':rendered}
    if 'decimalPlaces' in output and kind in ('slope','rate','average-rate'):
        places=output['decimalPlaces']
        if type(places) is not int or not 0<=places<=8:raise Unsupported('INVALID_DECIMAL_PRECISION')
        value=number(answer['value']);scaled=s.floor(abs(value)*10**places+s.Rational(1,2))
        if not scaled.is_Integer:raise Unsupported('ROUNDING_NOT_EXACTLY_PROVEN')
        numerator=int(scaled)*(-1 if value.is_negative else 1)
        answer['value']=('-' if numerator<0 else '')+str(abs(numerator)//10**places)+('.'+str(abs(numerator)%10**places).zfill(places) if places else '')
    if 'unit' in output:
        if not isinstance(output['unit'],str) or not re.fullmatch(r'[A-Za-z /²³^0-9.-]{1,60}',output['unit']):raise Unsupported('INVALID_UNIT')
        answer['unit']=output['unit']
    if 'fields' not in answer:
        mapping=slots(task,{'value','answer','solution','equation'})
        if len(mapping)>1:raise Unsupported('SINGLE_RESPONSE_SLOT_REQUIRED')
        identifier=next(iter(mapping),'answer')
        if answer['kind']=='scalar': rendered=answer['value']
        elif answer['kind']=='equation': rendered=answer['equation']
        elif answer['kind']=='solution-set':
            if answer['all']:rendered='All real numbers'+(' except {'+','.join(answer['excluded'])+'}' if answer['excluded'] else '')
            elif not answer['values']:rendered='No solution'
            elif len(answer['values'])==1:rendered=answer['values'][0]
            else:rendered='{'+','.join(answer['values'])+'}'
        else:raise Unsupported('RESPONSE_SLOTS_REQUIRED')
        answer['fields']={identifier:rendered}
    answer['latexFields']={k:_latex_field(v) for k,v in answer['fields'].items()}
    if any(len(v)>1200 for v in answer['fields'].values()):raise Unsupported('ANSWER_SIZE')
    return {'ok':True,'status':'solved','answer':answer,'domain':domain,'verification':{'exact':True,'method':'typed-original-task','factorDomain':'rational' if kind=='factor' else None}}

def _same_value(a,b,original=None):
    if not isinstance(a,str) or not isinstance(b,str):return False
    try:
        expected=parse_document(a);candidate=parse_document(b)
        original=original or expected
        if not candidate.symbols.issubset(original.symbols):return False
        if not equal(expected.values[0],candidate.values[0]):return False
        if not original.symbols:return candidate.valid({})
        variable=next(iter(original.symbols));before=original.real_domain(variable);after=candidate.real_domain(variable)
        return before is not None and after is not None and before.is_subset(after) is True
    except (Unsupported,ValueError,TypeError,NotImplementedError):return False

def _latex_field(value):
    if value in ('infinity','-infinity'):return ('-' if value.startswith('-') else '')+r'\infty'
    if value.startswith('{') and value.endswith('}'):return r'\left\{'+value[1:-1]+r'\right\}'
    if re.fullmatch(r'-?\d+\.\d+',value):return value
    try:return s.latex(parse_document(value).values[0]).replace(r'\log',r'\ln')
    except (Unsupported,ValueError,TypeError):return value

def _point_slope_readback(expected,candidate):
    try:
        a=parse_document(expected,True,maximum_symbols=2);b=parse_document(candidate,True,maximum_symbols=2)
        if b.symbols-a.symbols:return False
        if any(v.free_symbols for _,v in b.constraints):return False
        left,right=b.ast.args
        def symbol(n,name):return n.kind=='symbol' and n.args[0]==name
        def numeric(n):
            if n.kind=='symbol':return False
            return all(numeric(v) for v in n.args if hasattr(v,'kind'))
        def shifted(n,name):
            return symbol(n,name) or n.kind in ('add','sub') and symbol(n.args[0],name) and numeric(n.args[1])
        if not shifted(left,'y'):return False
        if not (shifted(right,'x') or right.kind=='mul' and ((numeric(right.args[0]) and shifted(right.args[1],'x')) or (numeric(right.args[1]) and shifted(right.args[0],'x')))):return False
        return equal(a.values[0]-a.values[1],b.values[0]-b.values[1])
    except (Unsupported,ValueError,TypeError):return False

def _observed_matches(task,expected,observed):
    if not isinstance(observed,dict) or set(observed)!={'fields'} or not isinstance(observed['fields'],dict) or set(observed['fields'])!=set(expected['fields']):return False
    kind=expected['kind']
    for identifier,value in expected['fields'].items():
        candidate=observed['fields'][identifier]
        if not isinstance(candidate,str) or len(candidate)>1200:return False
        if kind in ('solution-set','point-set'):candidate=re.sub(r'\\(?:left|right)\s*','',candidate).replace(r'\{','{').replace(r'\}','}')
        if task['task'] in EXTENSION_TASKS:
            from task_extensions import compare_extension_field
            if compare_extension_field(task,expected,candidate) is not True:return False
            continue
        if 'decimalPlaces' in task.get('output',{}) and not re.fullmatch(r'-?\d+(?:\.\d+)?',candidate.strip()):return False
        if kind in ('claim','limit','point-set'):
            from task_extensions import compare_extension_field
            compared=compare_extension_field(task,expected,candidate)
            if compared is not True:return False
        elif kind=='solution-set':
            if len(expected['values'])==1 and not expected['all']:
                if not _same_value(value,candidate):return False
            elif expected['all']:
                if re.sub(r'\s','',candidate).lower()!=re.sub(r'\s','',value).lower():return False
            elif not expected['values']:
                if candidate.strip().lower() not in ('no solution','no solutions','{}','∅'):return False
            else:
                candidate=candidate.strip()
                if not candidate.startswith('{') or not candidate.endswith('}'):return False
                pieces=candidate[1:-1].split(',')
                if len(pieces)!=len(expected['values']) or not all(sum(_same_value(v,c) for c in pieces)==1 for v in expected['values']):return False
        elif kind=='equation':
            if not _point_slope_readback(value,candidate):return False
        else:
            original=None
            if kind=='scalar' and task.get('expression') and task['task'] not in EXTENSION_TASKS:
                base=task.get('output',{}).get('logBase');base=s.E if base=='e' else number(base) if base is not None else None
                original=parse_document(task['expression'],log_base=base)
            if not _same_value(value,candidate,original):return False
            observed_expression=parse_document(candidate).values[0]
            if task['task']=='expand' and s.expand(observed_expression)!=observed_expression:return False
            if task['task']=='simplify' and s.simplify(s.trigsimp(observed_expression))!=observed_expression:return False
        if task['task']=='factor':
            try:
                if not factored_form(parse_document(candidate).values[0]):return False
            except (Unsupported,ValueError):return False
    return True

def verify_task(request):
    if not isinstance(request,dict) or set(request)!={'task','answer','observed'}:raise Unsupported('INVALID_TYPED_VERIFY')
    task=request['task'];result=solve_task(task);expected=result['answer']
    # Candidate metadata is never allowed to redefine the original answer.
    answer=request['answer']
    metadata_ok=isinstance(answer,dict) and answer==expected
    equivalent=metadata_ok and _observed_matches(task,expected,request['observed'])
    return {'ok':True,'equivalent':bool(equivalent),'verification':{'exact':True,'method':'typed-original-recompute'}}

def recognized_definition_rhs(source):
    """Whole public function definition only; no substring or arbitrary equation."""
    if not isinstance(source,str):return None
    source=re.sub(r'\\(?:left|right)\b','',source)
    match=re.fullmatch(r'\s*(?:[fg]\(\s*([a-z])\s*\)|y)\s*=\s*(.+?)\s*',source,re.S)
    if not match:return None
    try:
        rhs=match.group(2);document=parse_document(rhs)
        if match.group(1):
            if not document.symbols.issubset({s.Symbol(match.group(1),real=True)}):return None
        elif s.Symbol('y',real=True) in document.symbols:return None
        return rhs
    except (Unsupported,ValueError,TypeError):return None

def validate_document_binding(document):
    """Conservative public-evidence gate; model claims never establish provenance."""
    if not isinstance(document,dict) or document.get('schema')!='kubla-problem-v1':raise Unsupported('INVALID_PROBLEM_DOCUMENT')
    task=document.get('task');original=document.get('original',{})
    if not isinstance(task,dict) or not isinstance(original,dict):raise Unsupported('UNGROUNDED_TASK')
    kind=task.get('task');instruction=str(original.get('instruction') or original.get('stem') or original.get('text') or '')
    response=document.get('response',{})
    response_slots=response.get('slots',[]) if isinstance(response,dict) else []
    mapped={(x.get('id'),x.get('role')) for x in response_slots if isinstance(x,dict)}
    for slot in task.get('slots',[]):
        if not isinstance(slot,dict) or slot.get('id') in ('__proto__','constructor','prototype'):raise Unsupported('INVALID_RESPONSE_SLOT')
        virtual=response.get('kind') in ('choice','multiple-choice') and slot.get('id')=='answer' and slot.get('role') in ('value','answer')
        if (slot.get('id'),slot.get('role')) not in mapped and not virtual:raise Unsupported('SLOT_ROLE_NOT_GROUNDED')
    if kind in EXTENSION_TASKS:return validate_extension_binding(document)
    expressions=original.get('expressions',[])
    expressions=[x.get('text','') if isinstance(x,dict) else x for x in expressions]
    if any(not isinstance(x,str) for x in expressions):raise Unsupported('INVALID_ORIGINAL_EXPRESSIONS')
    normalize=lambda x:re.sub(r'\s+','',x).replace('−','-').rstrip('=')
    if task.get('expression') and normalize(task['expression']) not in [normalize(x) for x in expressions]:
        definitions=[recognized_definition_rhs(value) for value in expressions] if kind=='complete-square' else []
        if normalize(task['expression']) not in [normalize(value) for value in definitions if value is not None]:raise Unsupported('TASK_EXPRESSION_NOT_ORIGINAL')
    verbs={'factor':r'\bfactor', 'expand':r'\bexpand', 'simplify':r'\b(simplify|reduce|combine like)', 'evaluate':r'\b(evaluate|calculate|value)', 'equation':r'\b(solve|solutions?)', 'complete-square':r'\bcomplet\w*\s+(?:the\s+)?square', 'divide':r'\b(divide|division|quotient|remainder)', 'slope':r'\bslope', 'rate':r'\b(rate of change|rate)', 'average-rate':r'\baverage\s+rate', 'point-slope':r'\bpoint[ -]slope'}
    from problem_document import grounded_directive
    if kind not in verbs or not (re.search(verbs[kind],instruction,re.I) or grounded_directive(kind,instruction)):raise Unsupported('TASK_DIRECTIVE_NOT_GROUNDED')
    output=task.get('output',{})
    if 'decimalPlaces' in output and not re.search(r'round|nearest|decimal places',instruction,re.I):raise Unsupported('PRECISION_NOT_GROUNDED')
    if output.get('angleUnit')=='degrees' and not re.search(r'\bdegrees?\b',instruction,re.I):raise Unsupported('ANGLE_UNIT_NOT_GROUNDED')
    if output.get('unit') and str(output['unit']) not in instruction and str(output['unit']) not in str(document.get('tables',[])):raise Unsupported('OUTPUT_UNIT_NOT_GROUNDED')
    if output.get('logBase') is not None and re.search(r'(?<![A-Za-z])(?:\\)?log\b',str(task.get('expression',''))):
        base=str(output['logBase'])
        site=urlsplit(str(document.get('url','')))
        platform_common=document.get('notation',{}).get('logConvention')=='khan-kas-common' and site.scheme=='https' and site.hostname in ('classroom.khanacademy.org','www.khanacademy.org','khanacademy.org') and site.username is None
        if base=='10' and not platform_common and not re.search(r'common|base\s*10|log_\{?10',instruction+' '+str(task.get('expression','')),re.I):raise Unsupported('LOG_BASE_NOT_GROUNDED')
        if base=='e' and not re.search(r'natural|base\s*e',instruction,re.I):raise Unsupported('LOG_BASE_NOT_GROUNDED')
    if kind=='divide':
        givens=task.get('givens',{})
        separate=len(expressions)==2 and normalize(givens.get('dividend',''))==normalize(expressions[0]) and normalize(givens.get('divisor',''))==normalize(expressions[1])
        outer=False
        if len(expressions)==1:
            whole=parse_document(expressions[0]);numerator=parse_document(givens.get('dividend'));denominator=parse_document(givens.get('divisor'))
            outer=whole.ast.kind=='div' and whole.ast.args==(numerator.ast,denominator.ast)
        if not separate and not outer:raise Unsupported('DIVISION_GIVENS_NOT_GROUNDED')
    if kind=='complete-square':
        response=document.get('response',{});response_slots=response.get('slots',[])
        mapping={(x.get('id'),x.get('role')) for x in response_slots if isinstance(x,dict)}
        if any((x.get('id'),x.get('role')) not in mapping for x in task.get('slots',[])):raise Unsupported('SLOT_ROLE_NOT_GROUNDED')
        # Reader must expose actual labelled slots or a public mathematical template.
        template=task.get('givens',{}).get('template')
        if not template or any(str(x.get('template',''))!=template for x in response_slots):raise Unsupported('COMPLETING_SQUARE_TEMPLATE_NOT_GROUNDED')
    if kind in ('rate','slope','average-rate','point-slope'):
        expected=task.get('givens',{}).get('points');tables=document.get('tables',document.get('evidence',{}).get('tables',[]))
        grounded=False
        for table in tables if isinstance(tables,list) else []:
            if isinstance(table,dict) and table.get('points')==expected and table.get('exact') is True:grounded=True
        graph=document.get('graphEvidence',document.get('evidence',{}).get('graph',{}))
        if isinstance(graph,dict) and graph.get('points')==expected and graph.get('exact') is True and graph.get('source') in ('accessible','dom-labels'):grounded=True
        # Explicit ordered point pairs in the public math are exact evidence.
        if expected and all(any(normalize(f'({p[0]},{p[1]})')==normalize(e) for e in expressions) for p in expected):grounded=True
        if expected and all(normalize(f'({p[0]},{p[1]})') in normalize(instruction) for p in expected):grounded=True
        if not grounded:raise Unsupported('POINTS_OR_TABLE_NOT_GROUNDED')
        givens=task.get('givens',{})
        if kind=='point-slope' and 'slope' in givens:
            literal=re.escape(str(givens['slope']))
            if not re.search(r'\bslope\s*(?:is|=|of)\s*'+literal+r'(?![\d.])',instruction,re.I):raise Unsupported('GIVEN_SLOPE_NOT_GROUNDED')
        if kind=='average-rate':
            interval=givens.get('interval',[])
            if len(interval)!=2:raise Unsupported('AVERAGE_RATE_INTERVAL_REQUIRED')
            left,right=[re.escape(str(v)) for v in interval]
            if not re.search(r'(?:from\s*(?:[a-z]\s*=\s*)?'+left+r'\s*to\s*(?:[a-z]\s*=\s*)?'+right+r'|between\s*'+left+r'\s*and\s*'+right+r'|interval\s*\[\s*'+left+r'\s*,\s*'+right+r'\s*\])',instruction,re.I):raise Unsupported('AVERAGE_RATE_INTERVAL_NOT_GROUNDED')
    return task
