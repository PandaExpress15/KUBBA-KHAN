# Khan Runner 2.1.4 · actual verification

286 Node checks and 12 actual-browser test programs passed on the final extension source. Tests use actual isolated Chrome, MV3 APIs, native inputs, upstream MathQuill and decoded WebM. Classroom pages and grading responses are synthetic. The owner confirms 2.1.3 watched videos; actual Khan exercise acceptance remains unverified.

## Exact released source

- Extension version: 2.1.4; 21 production files; no new runtime dependency or host permission.
- Official verified Google Chrome: 156.0.8078.47; Playwright 1.62.1; Node v24.19.0.
- Chrome-loaded extension tree SHA-256: `03543817edc022becbfe7c615f751335c947ab8969855ed03bbc854c2ab86ba1`.
- The digest is SHA-256 of JSON.stringify of the sorted relative-file/SHA-256 map. Every Chrome-loaded production file matched source; packaging validates the same map.
- Disposable profiles, ordinary Developer mode and unpacked loading, Chrome sandbox, TLS and package verification remained enabled. No owner profile, credential store or system policy was changed.

## Actual commands and exits

| Command | Exit | Result |
|---|---:|---|
| `node --test tests/*.test.mjs` | 0 | 286 passed; zero failures/skips/cancellations |
| `node tests/browser-install.mjs` | 0 | Fresh enabled MV3; final version and all 21 loaded file hashes; host grants |
| `node tests/browser-manual.mjs` | 0 | Actual popup Read/Solve/Insert; controlled native input; no Check |
| `node tests/browser-popup.mjs` | 0 | Pointer Start/Stop; visible controls; cancellation during startup |
| `node tests/browser-boundaries.mjs` | 0 | Question/feedback scope; sidebar/title/completion exclusions; existing work; stale actions; sender authority |
| `node tests/browser-exercise-panels.mjs` | 0 | Eight mixed-format no-global MathQuill questions; delayed stem; labels/conflicts; once-only Check; seven Next and Done |
| `node tests/browser-pagination-controls.mjs` | 0 | 23 actual DOM pagination control/label/disabled/safe-target cases |
| `node tests/browser-pagination.mjs` | 0 | Five pages; return from page five; delayed controls; Stop while waiting |
| `node tests/browser-document-navigation.mjs` | 0 | Three full-document scans; exact queues; interrupted replies without repeated navigation |
| `node tests/browser-mathquill.mjs` | 0 | Seven actual upstream editor cases; fractions/radicals; restrictions; existing-work preservation |
| `node tests/browser.mjs` | 0 | Both actual tabs; two real videos at 2×; native and MathQuill entry; four Check/feedback; Next/Done; Stop; rejected/unsupported pauses |
| `node tests/browser-recovery.mjs` | 0 | Real worker stop/restart; no duplicate Check; delayed/unknown feedback; class departure; tab closure; identical questions; reload |
| `node tests/browser-reload.mjs` | 0 | Actual extension reload and content reattachment for multipage discovery |

The final source was verified in targeted batches; final-results.json indexes each passed program and its raw log. The evidence README distinguishes final successes from regression history and a corrected test-only locator error. Do not describe intermediate runs as final passing commands.

## Exercise observations

The 2.1.3 browser regression failed because its deepest renderer contained the box but omitted the visible question stem and sibling Check/feedback. The fixed reader finds all three and excludes printed answer labels, sidebar math, unrelated titles and completion text. A six-second delayed stem was observed without premature entry or Check.

The final mixed-format flow entered the screenshot-style 10x²+13x+4 quadratic, difference of squares, a higher-degree common-factor expression, rational reduction, a linear equation, an exact trig value, polynomial expansion and numeric fraction evaluation. It used real upstream MathQuill 0.10.1 with no global API, alternating plain/stateless clipboard modes. All eight entered values were read back, all eight fixture responses were correct, each question had exactly one Check, and seven Next actions plus Done completed the assignment.

The separate full two-lane flow again observed two actual 16-second videos reaching browser-trusted ended events at effective 2× without seeking, while two exercise assignments produced four once-only Checks and accepted fixture feedback. Native input survived controlled rerendering, public and no-global MathQuill passed, Stop prevented future actions and restored runner-started media, and worker restart preserved uncertain submission intent without a duplicate Check.

## Remaining live boundary

The owner's signed-in Chrome is not connected to this workspace. The exact owner-side exercise pause was not supplied in this turn. The reproduced nested-renderer defect is proven in Chrome, but its presence in the owner's page is unconfirmed. Load 2.1.4 and run from All assignments / To-do; if the exercise lane pauses, Copy diagnostics from that tab supplies sanitized reading/control counts and phase without names, class URLs, question text or answers. This is the precise remaining owner action; do not transfer passwords, cookies or browser profiles.

The solver remains restricted to validated polynomial algebra, one-variable linear equations, a single rational polynomial fraction, numeric fractions and common exact trig values. Graphs, multiple choice/fields, systems, general word problems and unsupported notation pause. No claim is made that every Khan exercise is supported or that a media end proves course credit.

Project Sovereign and RADAR were untouched. Publishing this update and its complete source to KUBBA-KHAN follows the owner's existing authorization.
