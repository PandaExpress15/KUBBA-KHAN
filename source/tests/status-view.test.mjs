import test from 'node:test';import assert from 'node:assert/strict';import {statusView} from '../extension/status-view.js';
test('idle connection does not claim an active runner',()=>{const v=statusView({state:'IDLE',running:false},true,true);assert.equal(v.title,'Not started');assert.match(v.detail,/Press the green Start both tabs/);});
test('startup error stays visible even when the page connection is healthy',()=>{const v=statusView({state:'ERROR',running:false,errors:[{code:'NO_SUPPORTED_ASSIGNMENT_ROWS'}]},true,true);assert.equal(v.title,'Start failed');assert.equal(v.tone,'error');assert.match(v.detail,/assignment rows/);});
test('discovery displays actual queue counts',()=>{const v=statusView({state:'DISCOVERING',running:true,startup:{pages:2},queued:{video:4,exercise:5}},true,true);assert.match(v.title,/Scanning/);assert.match(v.detail,/2 page/);assert.match(v.detail,/4 videos/);});
test('request-level error is visible before a run exists',()=>assert.equal(statusView(null,true,true,'STARTUP_INJECTION_FAILED').tone,'error'));

test('a paused lane is an error at the top even while the other lane runs',()=>{const v=statusView({state:'RUNNING',running:true,lanes:{video:{state:'PLAYING'},exercise:{state:'PAUSED',error:'UNSUPPORTED_MATH_FORMAT'}}},true,true);assert.match(v.title,/paused/);assert.equal(v.tone,'error');assert.match(v.detail,/needs manual work/);});
