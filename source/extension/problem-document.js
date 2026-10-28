// Versioned, bounded data contract. No selectors, model code or answer actions.
export const PROBLEM_SCHEMA='kubla-problem-v1';
const tasks=new Set(['factor','simplify','expand','evaluate','equation','complete-square','divide','slope','rate','average-rate','point-slope','inverse-table','inverse-affine','rational-analysis','error-analysis']);
export function validateProblemDocument(d){
 const fail=()=>{throw Error('INVALID_PROBLEM_DOCUMENT');};
 let nodes=0;const bounded=(v,depth=0)=>{if(++nodes>4000||depth>14)fail();if(v===null||typeof v==='boolean')return;if(typeof v==='number'){if(!Number.isFinite(v))fail();return;}if(typeof v==='string'){if(v.length>12000)fail();return;}if(Array.isArray(v)){if(v.length>200)fail();for(const n of v)bounded(n,depth+1);return;}if(!v||typeof v!=='object'||!['[object Object]'].includes(Object.prototype.toString.call(v)))fail();for(const [k,n]of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))fail();bounded(n,depth+1);}};bounded(d);
 if(!d||d.schema!==PROBLEM_SCHEMA||typeof d.url!=='string'||d.url.length>2048||!/^https:\/\/classroom\.khanacademy\.org\/learner\/class\/[^/]+\/assignment\//.test(d.url)||typeof d.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(d.fingerprint))fail();
 if(!d.original||typeof d.original.instruction!=='string'||d.original.instruction.length>3000||typeof d.original.text!=='string'||d.original.text.length>7000||!Array.isArray(d.original.expressions)||d.original.expressions.length>24||d.original.expressions.some(e=>typeof e.text!=='string'||e.text.length>600||typeof e.source!=='string'))fail();
 if(!d.response||!['native','mathquill','fields','choice','graph','unknown'].includes(d.response.kind)||!Array.isArray(d.response.slots)||d.response.slots.length>8||!Array.isArray(d.response.choices)||d.response.choices.length>12)fail();
 const ids=new Set();for(const s of d.response.slots){if(!/^s[0-7]$/.test(s.id)||ids.has(s.id)||typeof s.role!=='string'||s.role.length>40||typeof s.label!=='string'||s.label.length>300||!['native','mathquill'].includes(s.kind)||!Array.isArray(s.path)||s.path.length>40||s.path.some(n=>!Number.isInteger(n)||n<0||n>10000)||typeof s.value!=='string'||s.value.length>4000||typeof s.disabled!=='boolean')fail();ids.add(s.id);}
 if(!d.evidence||!Array.isArray(d.evidence.tables)||d.evidence.tables.length>5||!d.evidence.graph||!d.notation)fail();
 if(d.task!==null){const t=d.task;if(!t||t.schema!=='kubla-task-v1'||!tasks.has(t.task)||typeof t.expression!=='string'||t.expression.length>4000||!t.givens||typeof t.givens!=='object'||!Array.isArray(t.slots)||t.slots.length>8||t.slots.some(s=>!ids.has(s.id)||typeof s.role!=='string')||!t.output||typeof t.output!=='object'||!['real','rational','complex'].includes(t.domain))fail();}
 if(JSON.stringify(d).length>60000)fail();return d;
}
export function immutableProblemDocument(document){const d=structuredClone(validateProblemDocument(document));const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};return freeze(d);}
export function classifyProblemDocument(d){
 validateProblemDocument(d);
 if(d.response.readerError)return {status:'review',stage:'response',reason:d.response.readerError};
 if(d.response.slots.some(s=>s.disabled))return {status:'review',stage:'response',reason:'RESPONSE_DISABLED'};
 if(d.response.slots.some(s=>s.value.trim())||d.response.choices.some(c=>c.selected))return {status:'review',stage:'response',reason:'EXISTING_ANSWER_PRESERVED'};
 if(d.notation.mixedNumber)return {status:'review',stage:'interpretation',reason:'MIXED_NUMBER_REQUIRES_INTERPRETATION'};
 if(d.response.kind==='graph')return {status:'review',stage:'response',reason:'INTERACTIVE_GRAPH_RESPONSE_UNSUPPORTED'};
 if(d.response.kind==='unknown')return {status:'unknown',stage:'response',reason:'RESPONSE_WIDGET_UNRECOGNIZED'};
 if(d.response.slots.length>1&&d.response.slots.some(s=>s.role==='unknown'))return {status:'review',stage:'response',reason:'UNLABELLED_RESPONSE_SLOTS'};
 if(!d.task)return {status:'review',stage:'interpretation',reason:'TASK_NOT_UNAMBIGUOUS'};
 if(d.response.slots.length>1&&d.task.slots.some(s=>s.role==='unknown'))return {status:'review',stage:'response',reason:'UNLABELLED_RESPONSE_SLOTS'};
 return {status:'candidate',stage:'verification',reason:'TYPED_TASK_REQUIRES_EXACT_VERIFICATION'};
}
