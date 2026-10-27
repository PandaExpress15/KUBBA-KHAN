# KUBLA KHAN 2.1.7 · consecutive-question verification

The owner reports one answer succeeds but progression stops. Actual signed-in owner DOM remains unavailable. The canonical2.1.6 reader was reproduced in actual Chrome after a correct first Check: the detached footer visibly showed Correct and Next, but snapshot returned accepted:false and controls:[]. Its footer classifier recognized Next question but omitted Next and Continue, so the footer's accepted feedback disappeared from scope.

Version2.1.7 aligns the associated-footer classifier with supported Next/Continue/Go to next question and finish labels. Accepted feedback remains required before progression. Next/Finish fallback is restricted to a single associated footer or toolbar, excluding unrelated navigation. Explicit Question N of M headers now identify repeated expressions at different question ordinals.

Final checks: npm test exited0 with296 passed, zero failed/skipped; node tests/browser-install.mjs, node tests/browser-boundaries.mjs and node tests/browser-progression.mjs each exited0. The final actual Chrome flow completed THREE consecutive questions, including identical firsttwo expressions at different ordinals and a different third expression. It observed exactly3 correct once-only Checks,2 Next/Continue actions,1 Done,3 fresh persisted10–30-second deadlines, and finalcounts3answers/1exercise. Unrelated Next lesson was never clicked. This is multiple-question coverage, not the previous single-question test.

Chrome156.0.8078.47, Playwright1.62.1 and Node24.19.0 were used with isolated profiles and Chrome sandbox enabled. Pages and grading responses are synthetic; Chrome APIs, extension loading and elapsed-time pacing are real. Actual Khan exercise acceptance and course credit remain unverified. Historical previous-version evidence is not a current-release run.

Loaded extension tree SHA-256: 8d4fc5793aaba1246df8e34bcde030cfe2844b8f7f9f094f976f43004b88985b. All21 loaded production files match this release. Evidence/v2.1.7 contains progression-before.log (genuine2.1.6 failure), progression-candidate.log (superseded partial run), progression-final.log and progression.json (final three-question success), browser-support.log and node-final.log.

One exercise lane, independent videos, random10–30-second pacing, Stop, existing-work protection, readback and once-only submission intent are preserved. No private API, model service, paid dependency or permission expansion is added. Unsupported/image-only formats still pause. Project Sovereign and RADAR remain untouched.
