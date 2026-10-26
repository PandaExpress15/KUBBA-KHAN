# Khan Runner 2.1.3 · actual verification

## Result

All **283 Node checks** and **11 actual-browser test programs** passed on the corrected source. Browser tests use isolated synthetic classroom pages, actual extension APIs, real decoded media and actual upstream MathQuill. They do not establish signed-in Khan acceptance or recorded course credit.

The owner's screenshot confirms that 2.1.2 failed at assignment-list Next navigation while Next was visibly available on page 1 of 5. The exact owner DOM attributes remain unavailable. A real Chrome regression reproduced LIST_NEXT_UNAVAILABLE for a visible Next control named Next page; the corrected navigation adapter passes this case.

## Exact source and runtime

- Extension: **2.1.3**, **21 files**.
- Browser: **156.0.8078.47**, official verified Google Chrome package; Playwright 1.62.1; Node v24.19.0.
- Chrome-loaded extension tree SHA-256: `ebc57cd717c8ee11f31531052c7b497bbf8f36237226ba37aa44788215f9ead7`. All loaded file hashes match source; see evidence/v2.1.3/installed-source.json.
- The tree digest is SHA-256 of JSON.stringify of the sorted relative extension-file to SHA-256 map, as implemented in browser-install.mjs.
- Fresh isolated profiles, normal Developer mode and unpacked extension loading were used. Browser sandbox, TLS and package verification remained enabled. No system browser policy, credential store or owner profile was changed.
- Production adds no runtime dependency, helper server, paid API or expanded host permission.

## Checks that ran

| Actual command | Exit | Verified boundary |
|---|---:|---|
| node --test tests/*.test.mjs | 0 | 283 passed; zero failed/skipped/cancelled |
| node tests/browser-install.mjs | 0 | Enabled MV3 installation, source/version binding, all 21 loaded file hashes and host permissions |
| node tests/browser-manual.mjs | 0 | Actual popup Read/Solve/Insert through worker and controlled native input |
| node tests/browser-popup.mjs | 0 | Pointer Start/Stop, visible primary controls, rapid cancellation |
| node tests/browser-boundaries.mjs | 0 | Visible question scope, hidden math, feedback boundaries, stale input and sender authority |
| node tests/browser-pagination-controls.mjs | 0 | 23 actual DOM label/role/relationship, disambiguation, disabled, stale and foreign-target cases |
| node tests/browser-pagination.mjs | 0 | Five-page scan, reset from page five, article-only page, two work tabs, delayed Next and Stop while waiting |
| node tests/browser-document-navigation.mjs | 0 | Three full-document runs, exact page sequence, complete queues; two actual interrupted replies recovered without repeated clicks |
| node tests/browser-mathquill.mjs | 0 | Seven real upstream editor cases, plain/stateless modes, fractions/radical, copy/paste restrictions and existing work |
| node tests/browser.mjs | 0 | Two real videos at 2×, two exercise assignments, four once-only Checks, Next/Done, actual native/MathQuill entry, concurrency, Stop and pauses |
| node tests/browser-recovery.mjs | 0 | Real worker stop/restart, delayed/unknown feedback, closure/navigation, identical questions and extension reload |
| node tests/browser-reload.mjs | 0 | Actual extension reload and continued multipage content pulses |

The browser programs were executed in targeted batches. Final outcomes are indexed in evidence/v2.1.3/final-results.json. Earlier failed candidate runs are retained as regression history, not described as passing commands. A timing assertion in the new pagination test initially checked tab URLs before initial navigation completed; the corrected test waits for both actual assignment tabs and retains its exact count and queue assertions.

## Important actual observations

The five-page accessible-label fixture failed before the fix with the same error shown in the owner's screenshot. After correction it scanned 1/2/3/4/5, and a second run starting on page five visited 5/4/3/2/1/2/3/4/5. Article-only pages were passed. Controls that appeared after six seconds were handled, and Stop prevented later Next even after the control appeared.

A full-document navigation test exposed an additional Chrome transport boundary: navigation can remove the injected frame before its reply is delivered. The controller now preserves intent and observes the next document without blindly clicking again. Three actual Chrome runs completed with exact page sequences; two interrupted replies were observed and recovered.

In the full workflow, two 16-second videos played at effective 2× to browser-trusted ended events without seeking. One was top-level and one in a permitted cross-origin fixture iframe. Two fixture exercise assignments produced four correct feedback observations, four once-only Checks, two Next and two Done actions. Native entry survived controlled rerendering; actual public and no-global MathQuill paths passed. The final workflow had zero page errors and 15/15 in-browser selfchecks.

Stop paused/restored runner-started media and prevented later Check/navigation. Actual worker state transitions running → stopping → stopped → starting → running and replacement of its global context were observed. Durable Check intent survived; unknown feedback and Resume did not duplicate a submission. Wrong/unsupported answers, ambiguous identity, class departure and closed tabs paused without false completion.

## Live boundary and supported formats

Your actual classroom must still be tested by loading 2.1.3, pressing Start once and observing the real players/editors and feedback. If it pauses, Copy diagnostics now includes sanitized pagination states and match categories. No private screenshot, class identifier, student record, credential or browser profile is included in the evidence.

The solver remains restricted to validated local polynomial algebra, linear equations, single rational polynomial fractions and supported exact unit-circle values. Graphs, multiple choice/fields, systems, general word problems and unreadable questions pause. This release is not a general guarantee to solve every Khan activity or earn course credit.

Project Sovereign and RADAR were untouched. Publishing the corrected package and source to KUBBA-KHAN was authorized by the owner.
