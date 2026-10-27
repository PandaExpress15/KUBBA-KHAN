import {spawnSync} from 'node:child_process';
const allScripts=['browser-local-cas.mjs','browser-polynomial-factor.mjs','browser-install.mjs','browser-assignment-handoff.mjs','browser-lane-isolation.mjs','browser-split-feedback.mjs','browser-feedback-safety.mjs','browser-progression.mjs','browser-readable-math.mjs','browser-manual.mjs','browser-popup.mjs','browser-pacing.mjs','browser-boundaries.mjs','browser-exercise-panels.mjs','browser-pagination-controls.mjs','browser-pagination.mjs','browser-document-navigation.mjs','browser-mathquill.mjs','browser.mjs','browser-recovery.mjs','browser-reload.mjs'];
const requested=process.argv.slice(2);
if(requested.some(s=>!allScripts.includes(s)))throw Error('Unknown browser test target');
const scripts=requested.length?requested:allScripts;
for(const script of scripts){
 console.log('\nRUN node tests/'+script);
 const result=spawnSync(process.execPath,['tests/'+script],{stdio:'inherit',env:process.env});
 if(result.error)throw result.error;
 console.log('EXIT',result.status);
 if(result.status!==0)process.exit(result.status||1);
}
