import test from 'node:test';import assert from 'node:assert/strict';import {isKhan,scope,inScope,validMedia,safeRate} from '../extension/policy.js';
for(const url of ['https://classroom.khanacademy.org/learner/class/A/assignment/1','https://www.khanacademy.org/math'])test(`allow ${url}`,()=>assert.ok(isKhan(url)));
for(const url of ['http://www.khanacademy.org/','https://khanacademy.org.evil.com/','https://www.khanacademy.org@evil.com/','javascript:alert(1)','not-url','https://evil.com/'])test(`deny ${url}`,()=>assert.ok(!isKhan(url)));
test('class-specific scope',()=>assert.equal(scope('https://classroom.khanacademy.org/learner/class/ABC/assignment/1'),'https://classroom.khanacademy.org/learner/class/ABC'));
test('class boundary rejects prefix collisions',()=>assert.ok(!inScope('https://classroom.khanacademy.org/learner/class/ABCX/assignment/1','https://classroom.khanacademy.org/learner/class/ABC')));
test('same class assignment allowed',()=>assert.ok(inScope('https://classroom.khanacademy.org/learner/class/ABC/assignment/2','https://classroom.khanacademy.org/learner/class/ABC')));
test('youtube embed only',()=>{assert.ok(validMedia('https://www.youtube.com/embed/abc'));assert.ok(validMedia('https://www.youtube-nocookie.com/embed/abc'));assert.ok(!validMedia('https://www.youtube.com/watch?v=abc'));assert.ok(!validMedia('https://evil.com/embed/abc'));});
test('rate clamps',()=>{assert.equal(safeRate(1000),2);assert.equal(safeRate('1.5'),1.5);assert.equal(safeRate(NaN),2);});
