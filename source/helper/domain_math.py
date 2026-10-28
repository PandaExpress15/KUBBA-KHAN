"""Restricted immutable syntax tree and original-domain ledger, before CAS evaluation."""
from dataclasses import dataclass
import re
import sympy as s

@dataclass(frozen=True)
class Node:
    kind: str
    args: tuple

@dataclass
class Document:
    source: str
    ast: Node
    values: tuple
    constraints: tuple
    symbols: frozenset
    def valid(self, substitutions):
        for kind,value in self.constraints:
            v=s.simplify(value.subs(substitutions))
            if v.has(s.zoo,s.nan,s.oo,-s.oo,s.I): return False
            condition={'nonzero':lambda:v!=0, 'nonnegative':lambda:v.is_nonnegative is True,
                       'positive':lambda:v.is_positive is True, 'unit':lambda:v.is_real is True and (v>=-1) is s.true and (v<=1) is s.true}[kind]()
            if condition is not True and condition is not s.true: return False
        return True
    def real_domain(self, variable):
        """Exact univariate domain; unknown set computations stay unsupported."""
        result=s.S.Reals
        for kind,value in self.constraints:
            if not value.free_symbols:
                if not Document(self.source,self.ast,(),((kind,value),),frozenset()).valid({}):return s.S.EmptySet
                continue
            try:
                if kind=='nonzero':
                    zeros=s.solveset(value,variable,domain=s.S.Reals)
                    if zeros.has(s.ConditionSet):return None
                    allowed=s.Complement(s.S.Reals,zeros)
                else:
                    relations=[value>=0] if kind=='nonnegative' else [value>0] if kind=='positive' else [value>=-1,value<=1]
                    allowed=s.S.Reals
                    for relation in relations:allowed=s.Intersection(allowed,s.solve_univariate_inequality(relation,variable,relational=False))
                result=s.Intersection(result,allowed)
            except (ValueError,NotImplementedError,TypeError):return None
        return result
    def domain(self):
        return [{'kind':kind,'expression':s.sstr(value).replace('**','^')} for kind,value in self.constraints]

class SyntaxParser:
    def __init__(self,tokens): self.tokens=tokens;self.i=0;self.depth=0
    def peek(self): return self.tokens[self.i] if self.i<len(self.tokens) else None
    def take(self): t=self.peek();self.i+=1;return t
    def group(self):
        from solver import Unsupported
        opening=self.take()
        if opening not in ('(','{'): raise Unsupported('GROUP_REQUIRED')
        value=self.sum()
        if self.take()!=(')' if opening=='(' else '}'):raise Unsupported('UNBALANCED_GROUP')
        return value
    def exponent(self):
        from solver import Unsupported
        value=self.group() if self.peek() in ('(','{') else self.unary_atom()
        # Exponents must be literal rational arithmetic, not computed functions/symbols.
        def constant(n):
            if n.kind=='number':return s.Rational(n.args[0])
            if n.kind=='neg':return -constant(n.args[0])
            if n.kind in ('add','sub','mul','div'):
                a,b=map(constant,n.args)
                if n.kind=='add':return a+b
                if n.kind=='sub':return a-b
                if n.kind=='mul':return a*b
                if b==0:raise Unsupported('DIVISION_BY_ZERO')
                return a/b
            raise Unsupported('RATIONAL_EXPONENT_REQUIRED')
        power=constant(value)
        if abs(power)>12 or power.q>12 or abs(power.p)>144:raise Unsupported('EXPONENT_LIMIT')
        return value
    def unary_atom(self):
        if self.peek() in ('+','-'):
            op=self.take();n=self.unary_atom();return Node('neg',(n,)) if op=='-' else n
        return self.atom()
    def atom(self):
        from solver import FUNCTIONS,Unsupported
        self.depth+=1
        if self.depth>24:raise Unsupported('NESTING_LIMIT')
        t=self.peek()
        if t in ('(','{'): n=self.group()
        else:
            self.take()
            if t is None:raise Unsupported('MISSING_OPERAND')
            if re.fullmatch(r'\d+(?:\.\d+)?',t):n=Node('number',(t,))
            elif t in ('pi','e'):n=Node('constant',(t,))
            elif t=='frac':n=Node('div',(self.group(),self.group()))
            elif t in FUNCTIONS:
                power=None
                if self.peek() in ('^','**'):self.take();power=self.exponent()
                if self.peek()=='frac':argument=self.atom();args=(argument,)
                else:
                    opening=self.take()
                    if opening not in ('(','{'):raise Unsupported('GROUP_REQUIRED')
                    args=(self.sum(),)
                    if self.peek()==',':self.take();args+= (self.sum(),)
                    if self.take()!=(')' if opening=='(' else '}'):raise Unsupported('UNBALANCED_GROUP')
                if len(args)>1 and t!='log':raise Unsupported('FUNCTION_ARITY')
                n=Node('function',(t,)+args)
                if power is not None:n=Node('pow',(n,power))
            elif re.fullmatch('[a-z]',t):n=Node('symbol',(t,))
            else:raise Unsupported('EXPECTED_OPERAND')
        self.depth-=1
        return n
    def power(self):
        n=self.atom()
        if self.peek() in ('^','**'):self.take();n=Node('pow',(n,self.exponent()))
        if self.peek()=='°':self.take();n=Node('degrees',(n,))
        return n
    def unary(self):
        if self.peek() in ('+','-'):
            op=self.take();n=self.unary();return Node('neg',(n,)) if op=='-' else n
        return self.power()
    def product(self):
        from solver import FUNCTIONS
        n=self.unary()
        while self.peek() is not None:
            t=self.peek()
            if t in ('*','/'):self.take();n=Node('mul' if t=='*' else 'div',(n,self.unary()))
            elif t in ('(','{','frac','pi','e') or t in FUNCTIONS or re.fullmatch(r'(?:\d+(?:\.\d+)?|[a-z])',t):n=Node('mul',(n,self.unary()))
            else:break
        return n
    def sum(self):
        n=self.product()
        while self.peek() in ('+','-'):
            t=self.take();n=Node('add' if t=='+' else 'sub',(n,self.product()))
        return n

def parse_document(source,equation=False,log_base=None,maximum_symbols=1):
    from solver import tokenize,FUNCTIONS,Unsupported
    # Explicit TeX log bases are syntax, never arbitrary identifiers or code.
    original_source=source
    source=re.sub(r'\\log_\{(\d+)\}\s*\(([^()]*)\)',r'log(\2,\1)',source) if isinstance(source,str) else source
    tokens=tokenize(source);parser=SyntaxParser(tokens);left=parser.sum();nodes=(left,)
    if parser.peek()=='=' and equation:parser.take();nodes+=(parser.sum(),)
    if parser.peek() is not None:raise Unsupported('UNEXPECTED_TOKEN')
    if equation and len(nodes)!=2:raise Unsupported('EQUATION_REQUIRED')
    constraints=[];symbols=set()
    def ledger(kind,v):
        constraints.append((kind,v))
        if not v.free_symbols:
            doc=Document(source,left,(),((kind,v),),frozenset())
            if not doc.valid({}):raise Unsupported('REAL_DOMAIN_REQUIRED' if kind!='nonzero' else 'DIVISION_BY_ZERO')
    def evaluate(n):
        k=n.kind;a=n.args
        if k=='number':return s.Rational(a[0])
        if k=='constant':return s.pi if a[0]=='pi' else s.E
        if k=='symbol':v=s.Symbol(a[0],real=True);symbols.add(v);return v
        if k=='neg':return -evaluate(a[0])
        if k=='degrees':return evaluate(a[0])*s.pi/180
        if k=='function':
            name=a[0];v=evaluate(a[1])
            if name=='sqrt':ledger('nonnegative',v)
            if name in ('asin','acos','arcsin','arccos'):ledger('unit',v)
            if name in ('log','ln'):
                ledger('positive',v)
                # ln is unambiguous; bare log requires an explicit task convention.
                base=evaluate(a[2]) if len(a)==3 else (s.E if name=='ln' else log_base)
                if base is None:raise Unsupported('LOG_BASE_REQUIRED')
                ledger('positive',base);ledger('nonzero',base-1)
                return s.log(v,base)
            result=FUNCTIONS[name](v)
            if name in ('tan','sec'):ledger('nonzero',s.cos(v))
            if name in ('cot','csc'):ledger('nonzero',s.sin(v))
            return result
        x=evaluate(a[0]);y=evaluate(a[1])
        if k=='add':return x+y
        if k=='sub':return x-y
        if k=='mul':return x*y
        if k=='div':ledger('nonzero',y);return x/y
        if k=='pow':
            if not y.is_Rational:raise Unsupported('RATIONAL_EXPONENT_REQUIRED')
            if y<=0:ledger('nonzero',x)
            if y.q%2==0:ledger('nonnegative',x)
            if y.q>1 and y.q%2==1:return s.real_root(x,int(y.q))**int(y.p)
            return x**y
        raise Unsupported('UNSUPPORTED_AST')
    values=tuple(evaluate(n) for n in nodes)
    if len(symbols)>maximum_symbols:raise Unsupported('ONE_VARIABLE_ONLY')
    for value in values:
        if s.count_ops(value)>180 or value.has(s.zoo,s.nan,s.oo,-s.oo,s.I):raise Unsupported('UNDEFINED_OR_COMPLEX')
        for number in value.atoms(s.Rational):
            if len(str(abs(number.p)))>120 or len(str(number.q))>120:raise Unsupported('NUMBER_SIZE')
    return Document(original_source,Node('equation',nodes) if equation else left,values,tuple(constraints),frozenset(symbols))
