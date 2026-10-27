# Khan Runner 2.1.5 · actual verification

The final release passed **293 Node checks** and **five targeted actual-Chrome test programs**. These exercise actual Chrome APIs, media and editors with synthetic classroom responses; actual Khan exercise acceptance remains unverified.

## Source and runtime

- Extension: 2.1.5, 21 production files; no new dependency or permission.
- Official verified Google Chrome 156.0.8078.47; Playwright 1.62.1; Node v24.19.0.
- Chrome-loaded extension tree SHA-256: `7f4544f5d61b9b49bc687d22cfbe0cf18cb6d0b3f4c6c7515ae5fe6f60288291`.
- Every loaded file matched the final source. Digest: SHA-256 of JSON.stringify of the sorted relative-file/SHA-256 map.
- Isolated disposable profiles, ordinary Developer mode and unpacked loading, with Chrome sandbox and TLS verification retained. No owner profile, credential store, system policy or unrelated project was changed.

## Commands that ran on this source

| Command | Exit | Observation |
|---|---:|---|
| `npm test` | 0 | 293 passed; zero failures/skips/cancellations |
| `node tests/browser-install.mjs` | 0 | Fresh enabled MV3; final version/path, all 21 loaded file hashes and host grants |
| `node tests/browser-popup.mjs` | 0 | Actual pointer Start/Stop and rapid startup cancellation |
| `node tests/browser-pacing.mjs` | 0 | Real-time integer delays on two questions, countdown, real worker restart, entry/Check/Next/Done, Stop past deadline, user-work preservation |
| `node tests/browser.mjs` | 0 | Both work tabs; two real videos at 2×; native and real MathQuill entry; accepted fixture feedback; Next/Done; Stop and pause paths |
| `node tests/browser-reload.mjs` | 0 | Actual extension reload and content reattachment for multipage discovery |

Final-results.json identifies each passed program's log. The full 13-program browser catalog was not rerun for this pacing change. The older 2.1.4 results remain explicitly historical. Regression-harness corrections and their failed intermediate attempts are retained and explained in the evidence README.

## Actual elapsed-time observations

The real Chrome pacing test uses the production RNG and actual wall clock, without changing its timer, selected duration, storage deadline or entered values. Every duration is a whole number in the requested inclusive range. The exact deadline survived an actual worker stop/restart, and the popup displayed its remaining seconds.

| Consecutive question | Chosen pause (seconds) | Entry after saved deadline (ms) |
|---|---:|---:|
| 1 | 24 | 5 |
| 2 | 23 | 5 |

Both entries occurred after the saved deadline, followed by exactly one Check each, accepted fixture feedback, one Next and Done. A separate pointer Stop was acknowledged, and the test waited beyond the cancelled deadline: no entry, Check or navigation followed. Work typed by the user during another countdown remained intact and was not checked automatically.

Node tests cover all 21 possible whole-second choices, minimum/maximum boundaries, no entry one millisecond before the deadline, later readback before Check, fresh choices for following questions, Stop, changed-problem pause, and restart without another random draw. Existing broader submission/recovery safeguards remain in the full Node suite.

The two-tab browser program observes actual video progress while the exercise countdown is active, then two browser-trusted video ended events at effective 2× without seeking. Two exercise assignments produce four once-only Checks with accepted fixture feedback, Next and Done through a controlled native field and actual upstream no-global MathQuill. The public MathQuill path, Stop, unsupported/wrong pauses and 15/15 in-browser selfchecks also pass.

## Practical limits

The wait starts when a supported question and its Check control are readable. The selected deadline persists across worker suspension/restart; regular observations do not reroll it. Browser scheduling, a backgrounded/sleeping device or delayed page readiness can make entry late. Stop cancels future actions without waiting for the countdown. A changed problem pauses, existing work stays protected, and uncertain Check outcomes remain nonretryable until observed.

The owner's signed-in Chrome is not attached to this workspace. No current live Khan exercise or course-credit claim is made. The restricted solver and its unsupported-format pauses are unchanged. Project Sovereign and RADAR remain untouched.
