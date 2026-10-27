"""Bounded exact CAS. No eval, sympify(string), parse_expr, model or network."""
from __future__ import annotations
import re
import sympy as s

MAX_INPUT = 300
FUNCTIONS = {'sqrt': s.sqrt, 'sin': s.sin, 'cos': s.cos, 'tan': s.tan,
             'log': s.log, 'ln': s.log, 'exp': s.exp}
class Unsupported(ValueError): pass

def tokenize(source):
    if not isinstance(source, str) or not source.strip() or len(source) > MAX_INPUT:
        raise Unsupported('EXPRESSION_SIZE')
    source = source.replace('−', '-').replace('–', '-').replace('×', '*').replace('·', '*').replace('π','pi').replace('²','^2').replace('³','^3')
    source = re.sub(r'\\(?:left|right|displaystyle|textstyle)\b', '', source)
    source = re.sub(r'\\[,!;: ]', '', source)
    source = re.sub(r'\\(?:cdot|times)\b', '*', source)
    source = re.sub(r'\\(?:d?frac)\b', 'frac', source)
    source = re.sub(r'\\(sqrt|sin|cos|tan|log|ln|exp|pi)\b', r'\1', source)
    # Never concatenate spaced digits (a mixed number is not implicit multiplication).
    if re.search(r'\d\s+\d', source): raise Unsupported('MIXED_NUMBER_NOTATION')
    result=[]; pos=0
    pattern=re.compile(r'\s*(?:(\d+(?:\.\d+)?)|([A-Za-z]+)|(\*\*|[+\-*/^(){}=]))')
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

class Parser:
    def __init__(self, tokens): self.tokens=tokens; self.i=0; self.depth=0
    def peek(self): return self.tokens[self.i] if self.i<len(self.tokens) else None
    def take(self):
        token=self.peek();self.i+=1;return token
    def group(self):
        opening=self.take()
        if opening not in ('(', '{'): raise Unsupported('GROUP_REQUIRED')
        closing=')' if opening=='(' else '}'
        answer=self.sum()
        if self.take()!=closing: raise Unsupported('UNBALANCED_GROUP')
        return answer
    def atom(self):
        self.depth+=1
        if self.depth>24: raise Unsupported('NESTING_LIMIT')
        token=self.peek()
        if token in ('(', '{'): answer=self.group()
        else:
            self.take()
            if token is None: raise Unsupported('MISSING_OPERAND')
            if re.fullmatch(r'\d+(?:\.\d+)?',token):
                if '.' in token:
                    whole,fraction=token.split('.');answer=s.Rational(int(whole+fraction),10**len(fraction))
                else: answer=s.Integer(int(token))
            elif token=='pi': answer=s.pi
            elif token=='e': answer=s.E
            elif token=='frac':
                numerator=self.group();denominator=self.group()
                if denominator==0: raise Unsupported('DIVISION_BY_ZERO')
                answer=numerator/denominator
            elif token in FUNCTIONS:
                argument=self.group()
                if token=='sqrt' and argument.is_number and argument.is_nonnegative is not True: raise Unsupported('REAL_DOMAIN_REQUIRED')
                answer=FUNCTIONS[token](argument)
            elif re.fullmatch('[a-z]',token): answer=s.Symbol(token,real=True)
            else: raise Unsupported('EXPECTED_OPERAND')
        self.depth-=1
        return answer
    def power(self):
        base=self.atom()
        if self.peek() in ('^','**'):
            self.take()
            if self.peek() in ('(', '{'): exponent=self.group()
            else:
                sign=1
                if self.peek() in ('+','-'): sign=-1 if self.take()=='-' else 1
                token=self.take()
                if token is None or not re.fullmatch(r'\d+',token): raise Unsupported('INTEGER_EXPONENT_REQUIRED')
                exponent=s.Integer(sign*int(token))
            if not exponent.is_Integer or abs(exponent)>12: raise Unsupported('EXPONENT_LIMIT')
            if base==0 and exponent<=0: raise Unsupported('UNDEFINED_POWER')
            base=base**exponent
        return base
    def unary(self):
        if self.peek() in ('+','-'):
            op=self.take();return self.unary() if op=='+' else -self.unary()
        return self.power()
    def product(self):
        answer=self.unary()
        while self.peek() is not None:
            token=self.peek()
            if token in ('*','/'):
                self.take();other=self.unary()
                if token=='/' and other==0: raise Unsupported('DIVISION_BY_ZERO')
                answer=answer*other if token=='*' else answer/other
            elif token in ('(', '{') or token in FUNCTIONS or token in ('frac','pi','e') or re.fullmatch(r'(?:\d+(?:\.\d+)?|[a-z])', token):
                answer*=self.unary()
            else: break
        return answer
    def sum(self):
        answer=self.product()
        while self.peek() in ('+','-'):
            op=self.take();other=self.product();answer=answer+other if op=='+' else answer-other
        return answer

def parse_expression(source, equation=False):
    tokens=tokenize(source); parser=Parser(tokens)
    left=parser.sum();right=None
    if parser.peek()=='=' and equation:
        parser.take();right=parser.sum()
    if parser.peek() is not None: raise Unsupported('UNEXPECTED_TOKEN')
    values=[left] if right is None else [left,right]
    symbols=set().union(*(v.free_symbols for v in values))
    if len(symbols)>1: raise Unsupported('ONE_VARIABLE_ONLY')
    for value in values:
        if s.count_ops(value)>180 or value.has(s.zoo,s.nan,s.oo,-s.oo,s.I): raise Unsupported('UNDEFINED_OR_COMPLEX')
        for number in value.atoms(s.Rational):
            if len(str(abs(number.p)))>120 or len(str(number.q))>120: raise Unsupported('NUMBER_SIZE')
    if equation and right is None: raise Unsupported('EQUATION_REQUIRED')
    return (left,right) if equation else left

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
        left,right=parse_expression(expression,True);symbols=left.free_symbols|right.free_symbols
        if len(symbols)!=1: raise Unsupported('ONE_VARIABLE_EQUATION_REQUIRED')
        variable=next(iter(symbols));difference=left-right
        p=polynomial(s.cancel(difference).as_numer_denom()[0])
        if p is None or p.degree()>4: raise Unsupported('EQUATION_DEGREE_LIMIT')
        roots=s.solveset(difference,variable,domain=s.S.Reals)
        if not isinstance(roots,s.FiniteSet) or len(roots)!=1: raise Unsupported('NEED_EXACTLY_ONE_REAL_SOLUTION')
        answer=next(iter(roots))
        if not equal(left.subs(variable,answer),right.subs(variable,answer)): raise Unsupported('SOLUTION_VERIFICATION_FAILED')
    else:
        original=parse_expression(expression)
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
    text=s.sstr(answer).replace('**','^');latex=s.latex(answer)
    if len(text)>600 or len(latex)>1200: raise Unsupported('ANSWER_SIZE')
    try: parse_expression(text)
    except Unsupported: raise Unsupported('ANSWER_NOT_SUPPORTED')
    return {'ok':True,'status':'solved','answer':text,'latex':latex,'request':{'expression':expression,'operation':operation},'source':'local-sympy','certificate':certificate(answer),'verification':{'exact':True,'method':'sympy-exact','factorDomain':'rational' if operation=='factor' else None}}

def verify_request(request):
    if not isinstance(request,dict) or set(request)-{'expression','operation','answer','observed'}: raise Unsupported('INVALID_REQUEST')
    expected=solve_request({'expression':request.get('expression'),'operation':request.get('operation')})
    answer=parse_expression(request.get('answer'));observed=parse_expression(request.get('observed'));computed=parse_expression(expected['answer'])
    equivalent=equal(answer,computed) and equal(observed,computed)
    if request['operation']=='factor': equivalent=equivalent and factored_form(observed) and factored_form(answer)
    return {'ok':True,'equivalent':bool(equivalent),'verification':{'exact':True,'method':'sympy-exact-recompute'}}
