import test from 'node:test';import assert from 'node:assert/strict';
import {isAmbiguousMixedNumber,solve} from '../extension/math.js';
import {solveSupported} from '../extension/advanced-math.js';
import {formalChoice} from '../extension/choice.js';
for(const source of ['1 1/2','1\\frac{1}{2}','1 \\frac{ 1 }{ 2 }','1\\,\\frac{1}{2}'])test('ambiguous mixed notation is rejected before normalization: '+source,()=>{assert.equal(isAmbiguousMixedNumber(source),true);assert.equal(solve(source,'simplify').status,'unsupported');assert.equal(formalChoice(source),false);});
for(const source of ['2*\\frac{1}{2}','2\\cdot \\frac{1}{2}','2(1/2)'])test('explicit multiplication remains supported: '+source,()=>{assert.equal(isAmbiguousMixedNumber(source),false);assert.equal(solve(source,'simplify').answer,'1');});

test('trig shortcut also rejects raw mixed angle before removing spaces',()=>assert.equal(solveSupported('sin(1 1/3*pi)','evaluate').status,'unsupported'));
