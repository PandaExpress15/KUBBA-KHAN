"""Bounded exact CAS. No eval, sympify(string), parse_expr, model or network."""
from __future__ import annotations
import re
import sympy as s

MAX_INPUT = 300
FUNCTIONS = {'sqrt': s.sqrt, 'sin': s.sin, 'cos': s.cos, 'tan': s.tan,
             'sec': s.sec, 'csc': s.csc, 'cot': s.cot,
             'asin': s.asin, 'acos': s.acos, 'atan': s.atan,
             'arcsin': s.asin, 'arccos': s.acos, 'arctan': s.atan,
             'log': s.log, 'ln': s.log, 'exp': s.exp}
class Unsupported(ValueError): pass

def tokenize(source):
    if not isinstance(source, str) or not source.strip() or len(source) > MAX_INPUT:
        raise Unsupported('EXPRESSION_SIZE')
    if re.search(r'\d\s+\d|\d\s*(?:\\[,!;: ]\s*)*\\(?:d?frac)\s*\{\s*\d+\s*\}\s*\{\s*\d+\s*\}', source): raise Unsupported('MIXED_NUMBER_NOTATION')
    source = source.replace('−', '-').replace('–', '-').replace('×', '*').replace('·', '*').replace('π','pi').replace('²','^2').replace('³','^3')
    # These substitutions normalize only a fixed math vocabulary. They never
    # execute model text or treat an arbitrary identifier as a callable.
    source = re.sub(r'\^\s*\{\s*\\circ\s*\}', '°', source)
    source = re.sub(r'\^\s*\\circ\b', '°', source)
    source = re.sub(r'\\operatorname\s*\{(sec|csc|cot|asin|acos|atan|arcsin|arccos|arctan)\}', r'\1', source)
    # Standard inverse-function notation is distinct from (sin(x))^(-1).
    source = re.sub(r'(?:\\)?(sin|cos|tan)\s*\^\s*(?:\{\s*-1\s*\}|\(\s*-1\s*\)|-1)\s*(?=(?:\\left)?\()', lambda m: 'a'+m.group(1), source)
    source = re.sub(r'(?<![A-Za-z])(?:\\)?(sin|cos|tan|sec|csc|cot)\s*(-?\d+(?:\.\d+)?°)(?=$|[+\-*/)\]}])', lambda m: m.group(1)+'('+m.group(2)+')', source)
    source = re.sub(r'\\(?:left|right|displaystyle|textstyle)\b', '', source)
    source = re.sub(r'\\[,!;: ]', '', source)
    source = re.sub(r'\\(?:cdot|times)\b', '*', source)
    source = re.sub(r'\\(?:d?frac)\b', ' frac ', source)
    source = re.sub(r'\\(sqrt|sin|cos|tan|sec|csc|cot|asin|acos|atan|arcsin|arccos|arctan|log|ln|exp|pi)\b', r'\1', source)
    # Never concatenate spaced digits (a mixed number is not implicit multiplication).
    if re.search(r'\d\s+\d', source): raise Unsupported('MIXED_NUMBER_NOTATION')
    result=[]; pos=0
    pattern=re.compile(r'\s*(?:(\d+(?:\.\d+)?)|([A-Za-z]+)|(\*\*|[+\-*/^(){}=°,]))')
    while pos<len(source):
        if source[pos:].isspace(): break
        m=pattern.match(source,pos)
        if not m: raise Unsupported('UNSUPPORTED_NOTATION')
        token=m.group(1) or m.group(2) or m.group(3)
        if m.group(1) and len(token)>24: raise Unsupported('NUMBER_SIZE')
        if m.group(2) and token not in FUNCTIONS and token not in ('frac','pi','e') and not re.fullmatch('[a-z]',token):
            raise Unsupported('UNKNOWN_IDENTIFIER')
        result.append(token);pos=m.end()
        if len(result)>200: raise Unsupported('TOKEN_LIMIT')
    return result

def parse_expression(source, equation=False):
    from domain_math import parse_document
    doc=parse_document(source,equation)
    return doc.values if equation else doc.values[0]


def equal(a,b):
    delta=a-b
    try:
        if delta.is_rational_function(): return s.cancel(delta)==0
    except (ValueError,NotImplementedError): pass
    return s.simplify(s.trigsimp(delta))==0

def polynomial(value):
    symbols=list(value.free_symbols)
    if not symbols:
        if not value.is_Rational: raise Unsupported('RATIONAL_POLYNOMIAL_REQUIRED')
        return None
    try: poly=s.Poly(value,symbols[0],domain=s.QQ)
    except (s.PolynomialError,s.CoercionFailed): raise Unsupported('RATIONAL_POLYNOMIAL_REQUIRED')
    if poly.degree()>24: raise Unsupported('POLYNOMIAL_DEGREE_LIMIT')
    return poly

def factored_form(value):
    for term in s.Mul.make_args(value):
        if term.is_Rational: continue
        base,exponent=term.as_base_exp()
        if not exponent.is_Integer or exponent<1: return False
        try: p=polynomial(base)
        except Unsupported: return False
        if p is not None and not p.is_irreducible: return False
    return True

def certificate(value):
    if value.is_Rational:
        return {'kind':'rational','numerator':str(value.p),'denominator':str(value.q)}
    coeff,root=value.as_coeff_Mul()
    if coeff.is_Rational and root.is_Pow and root.exp==s.Rational(1,2) and root.base.is_Integer and 0<root.base<=10**12:
        return {'kind':'quadratic-surd','coefficientNumerator':str(coeff.p),'coefficientDenominator':str(coeff.q),'radicand':str(root.base)}
    try:
        p=polynomial(value)
        if p is not None:
            return {'kind':'rational-polynomial','variable':str(p.gens[0]),'coefficients':[{'numerator':str(c.p),'denominator':str(c.q)} for c in reversed(p.all_coeffs())]}
    except Unsupported: pass
    return {'kind':'exact-symbolic'}

def solve_request(request):
    if not isinstance(request,dict) or set(request)-{'expression','operation'}: raise Unsupported('INVALID_REQUEST')
    expression=request.get('expression');operation=request.get('operation')
    if operation not in ('factor','expand','simplify','evaluate','equation'): raise Unsupported('UNSUPPORTED_OPERATION')
    if operation=='equation':
        from domain_math import parse_document
        document=parse_document(expression,True);left,right=document.values;symbols=document.symbols
        if len(symbols)!=1: raise Unsupported('ONE_VARIABLE_EQUATION_REQUIRED')
        variable=next(iter(symbols));difference=left-right
        p=polynomial(s.cancel(difference).as_numer_denom()[0])
        if p is None or p.degree()>4: raise Unsupported('EQUATION_DEGREE_LIMIT')
        roots=s.solveset(difference,variable,domain=s.S.Reals)
        if isinstance(roots,s.FiniteSet): roots=s.FiniteSet(*(r for r in roots if document.valid({variable:r})))
        if not isinstance(roots,s.FiniteSet) or len(roots)!=1: raise Unsupported('NEED_EXACTLY_ONE_REAL_SOLUTION')
        answer=next(iter(roots))
        if not equal(left.subs(variable,answer),right.subs(variable,answer)): raise Unsupported('SOLUTION_VERIFICATION_FAILED')
    else:
        from domain_math import parse_document
        document=parse_document(expression);original=document.values[0]
        if operation=='factor':
            polynomial(original);answer=s.factor(original)
            if not equal(original,answer) or not factored_form(answer): raise Unsupported('FACTOR_VERIFICATION_FAILED')
        elif operation=='expand': answer=s.expand(original)
        elif operation=='simplify': answer=s.simplify(s.trigsimp(original))
        else:
            if original.free_symbols: raise Unsupported('NUMERIC_EXPRESSION_REQUIRED')
            answer=s.simplify(s.trigsimp(original))
        if not equal(original,answer): raise Unsupported('EXACT_VERIFICATION_FAILED')
    if answer.has(s.zoo,s.nan,s.oo,-s.oo,s.I) or answer.is_real is False: raise Unsupported('REAL_FINITE_ANSWER_REQUIRED')
    text=s.sstr(answer).replace('**','^').replace('log(', 'ln(');latex=s.latex(answer).replace(r'\log',r'\ln')
    if len(text)>600 or len(latex)>1200: raise Unsupported('ANSWER_SIZE')
    try: parse_expression(text)
    except Unsupported: raise Unsupported('ANSWER_NOT_SUPPORTED')
    return {'ok':True,'status':'solved','answer':text,'latex':latex,'request':{'expression':expression,'operation':operation},'source':'local-sympy','certificate':certificate(answer),'domain':document.domain(),'verification':{'exact':True,'method':'sympy-exact','factorDomain':'rational' if operation=='factor' else None}}

def verify_request(request):
    if not isinstance(request,dict) or set(request)-{'expression','operation','answer','observed'}: raise Unsupported('INVALID_REQUEST')
    expected=solve_request({'expression':request.get('expression'),'operation':request.get('operation')})
    answer=parse_expression(request.get('answer'));observed=parse_expression(request.get('observed'));computed=parse_expression(expected['answer'])
    from domain_math import parse_document
    from task_solver import _same_value
    original=None if request['operation']=='equation' else parse_document(request['expression'])
    equivalent=_same_value(expected['answer'],request['answer'],original) and _same_value(expected['answer'],request['observed'],original)
    if request['operation']=='expand': equivalent=equivalent and s.expand(observed)==observed and s.expand(answer)==answer
    if request['operation']=='simplify': equivalent=equivalent and s.simplify(s.trigsimp(observed))==observed and s.simplify(s.trigsimp(answer))==answer
    if request['operation']=='factor': equivalent=equivalent and factored_form(observed) and factored_form(answer)
    return {'ok':True,'equivalent':bool(equivalent),'verification':{'exact':True,'method':'sympy-exact-recompute'}}
