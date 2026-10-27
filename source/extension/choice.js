import {isAmbiguousMixedNumber} from './math.js';
import {equivalent} from './advanced-math.js';
// Only formal, wholly readable choices qualify. Unreadable distractors cannot
// be treated as evidence that a different answer is uniquely correct.
export function formalChoice(expression){
 if(typeof expression!=='string'||!expression.trim()||expression.length>300||isAmbiguousMixedNumber(expression))return false;
 if(/[^\w\s\\{}()+\-*/^.=π°−–²³·×,]/u.test(expression)||/[=_]/.test(expression))return false;
 const names=expression.match(/[A-Za-z]+/g)||[];
 return names.every(n=>/^[a-z]$/.test(n)||/^(sqrt|sin|cos|tan|sec|csc|cot|asin|acos|atan|arcsin|arccos|arctan|pi|frac|dfrac|left|right|cdot|times|circ)$/.test(n));
}
export async function uniqueChoice(p,answer,choices,verify){
 const local=answer?.source==='local-sympy';
 if(p?.operation==='factor'&&!local)return {ok:false,error:'CHOICE_FACTOR_FORM_UNSUPPORTED'};
 if(!Array.isArray(choices)||choices.length<2||choices.length>10||choices.some((c,i)=>c.index!==i||!formalChoice(c.expression)))return {ok:false,error:'CHOICE_UNREADABLE_OPTION'};
 // Comparison must establish readability of every choice before uniqueness.
 // The built-in route accepts only options it can independently solve/canonicalize.
 const matches=[];
 for(const c of choices){
  if(!local&&!equivalent(c.expression,c.expression))return {ok:false,error:'CHOICE_UNVERIFIED_OPTION'};
  const result=verify?await verify(c.expression):equivalent(c.expression,answer.answer);
  if(typeof result!=='boolean')return {ok:false,error:'CHOICE_UNVERIFIED_OPTION'};
  if(result===true)matches.push(c);
 }
 return matches.length===1?{ok:true,index:matches[0].index,expression:matches[0].expression}: {ok:false,error:matches.length?'CHOICE_AMBIGUOUS_MATCH':'CHOICE_NO_VERIFIED_MATCH'};
}
