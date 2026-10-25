# Verification report · Khan Runner 2.1.2 · 2026-10-25

**Result: corrected source is verified in actual Chrome on isolated synthetic classroom pages. The owner's signed-in Khan workflow is BLOCKED, not live-verified.** No access to the owner's desktop Chrome or authorized classroom session was available. One Start → Copy diagnostics result is still required to identify their exact live failure. No course credit, grades or live exercise acceptance are claimed.

## Exact inputs and runtime

- Input ZIP SHA-256: `c46c1c92b7d1df6948a63de1e54e6aace02b610ff343404345a0ce68acd9fbaf`.
- Original source 2.1.1; all 54 handoff manifest entries independently matched before edits. Original baseline: 275 Node checks, exit 0.
- Final extension: 2.1.2. Chrome actually loaded all 20 extension files and every SHA-256 matched the corrected source.
- Loaded extension tree SHA-256: `ec32e714dc8605dd35d97fe2008bf28c0e930afd8ca406c5f86342d2a9035d71`. Definition: SHA-256 of UTF-8 `JSON.stringify` of the sorted relative extension-file → SHA-256 map in `evidence/installed-source.json`.
- Loaded source: `/workspace/khan-runner-isolated/Khan-Runner-Codex-Handoff/source/extension`; test-profile extension ID `ecdnidnngfffbfcnkbmbbccogalodlif` (path-dependent; another installation may have a different ID).
- Google Chrome 156.0.8078.47, Playwright 1.62.1, Node v24.19.0, npm 11.9.0, Linux. Python 3.12.14 was used for archive verification/packaging.
- Chrome package checksum `6c92cd22e90c6e3e255d782991543fa2091db8614e8536a971a7433a5c4d7ac8` matched Google's signed repository. Browser sandbox and TLS/package verification remained enabled. A new disposable browser profile was used for every script.
- Normal unpacked developer installation, correct version/path, enabled extension, manifest without errors, and all required host permissions were verified. No policy, credential store or existing Chrome profile was modified.

## Commands and actual results

| Executed command | Exit | Result |
|---|---:|---|
| `bash run_checks.sh` before implementation | 0 | 275 passed, 0 failed |
| `node --test tests/*.test.mjs` on final production code | 0 | 278 passed, 0 failed, 0 skipped/cancelled |
| `node tests/browser-install.mjs` | 0 | Fresh MV3 installation, exact loaded bytes, version/source binding, host permissions |
| `node tests/browser-popup.mjs` | 0 | Actual action popup; real pointer Start/Stop; queue probe; rapid cancellation |
| `node tests/browser-boundaries.mjs` | 0 | Actual DOM expression/feedback/navigation scope, stale Check, native existing work, sender authority |
| `node tests/browser-mathquill.mjs` | 0 | Seven actual upstream-editor cases; plain/stateless clipboard; fractions/radical; restrictions preserved |
| `node tests/browser.mjs` | 0 | Full concurrent two-lane run, real media, native and MathQuill exercise workflows, Stop and pauses |
| `node tests/browser-recovery.mjs` | 0 | Already-open attachment; actual worker stop/restart; delayed/unknown feedback; navigation/closure; identity ambiguity; reload |
| `node tests/browser-reload.mjs` | 0 | Actual extension reload and content pulses on an already-open multipage class list |
| `node tests/browser-manual.mjs` | 0 | Actual popup Read/Solve/Insert through MV3 worker; controlled input; no Check |

The six central browser scripts ran in the captured `npm run test:browser` suite, each with EXIT 0. Installation and manual-insertion scripts were additionally executed separately and passed. The saved browser runner now includes all eight scripts. These are existing process outcomes, not inferred from the npm command's name or from mock test counts.

## Browser observations

1. **Start:** A single actual pointer click crossed popup → runtime message → persisted run → immediate DOM queue probe. The original popup clipping regression fails before the CSS correction and passes afterward. A rapid Stop cancels queued startup without creating a work tab.
2. **Queue:** Started on page 3, returned through pages 2/1, then scanned 1/2/3, including an article-only page. Duplicate video and foreign-class jobs were excluded. SPA rerenders and full document navigation passed.
3. **Tabs and concurrency:** Exactly two assignment work tabs existed for a mixed queue. Both lanes progressed; a Check occurred during genuine media playback. Two queued video items and two exercise assignments completed in the fixture.
4. **Real video:** Two generated 16-second HTML5 videos played to their actual ends at 2×, one top-level and one in a permitted cross-origin iframe. Measured effective rates were approximately **1.99962×** and **2.00046×** from media time versus wall time. End events were browser-trusted, current time equaled duration, and zero seeked events occurred. This is real decoded media, not a mocked video object or synthetic ended event. The iframe is a synthetic HTML5 player at an allowed embed origin, not a validation of the proprietary YouTube player.
5. **Answers:** The first exercise used a native controlled field that replaced its input after entry. The second used actual upstream MathQuill without `window.MathQuill`. Four answers survived readback, four Check clicks occurred exactly once, four positive feedback responses were observed, Next occurred twice, and Done twice. The next queued assignment opened. A separate full exercise passed with the public MathQuill API.
6. **Editor coverage:** Actual upstream MathQuill 0.10.1 passed factors, negative fractions, a rational fraction and a radical in plain/stateless clipboard modes. Copy/paste cancellation and existing answers were preserved. No private controller/React objects or system clipboard access were used.
7. **Stop:** Pointer Stop during real playback and READY_TO_CHECK paused/restored the media. Over 8.5 seconds (two content pulse intervals), no future Check, Next/Done or assignment navigation occurred. Already-delivered actions are not described as reversible.
8. **Worker recovery:** DevTools observed running → stopping → stopped → starting → running, and the worker's global context marker was replaced. Persisted Check intent survived. Unknown feedback paused after the actual timeout; Resume did not submit again. Delayed accepted feedback resulted in exactly one Check and observed completion.
9. **Other recovery:** User navigation to a different class paused without Check. Closing the exercise tab was detected by the actual Chrome heartbeat without Check. A changed expression before feedback received no progress credit. Identical consecutive questions without ordinals paused rather than guessing. Actual extension reload retained its ID/source binding and reattached the existing list.
10. **Failure UI:** Unsupported and rejected answers paused without false completion. The top popup showed the pause/error even while another lane could run. The selftest completed 15/15 in the browser. The final full workflow had **zero page errors**.
11. **Manual insertion:** Read/Solve/Insert crossed the actual popup and MV3 worker with the static import, entered the native controlled field, and did not click Check.

`evidence/browser-events.json` contains the synthetic real-media and exercise UI event trace; `installed-source.json` records all loaded file hashes. Screenshots show the actual popup before/after correction and its visible paused state.

## Remaining required live acceptance

| Boundary | Status | Required next action |
|---|---|---|
| Owner's post-Start popup/worker state | BLOCKED | On the actual To-do page, press Start once and paste Copy diagnostics |
| Current classroom row controls, custom filters and navigation | UNVERIFIED | Observe the authorized real DOM once the live boundary is available |
| Real classroom HTML5/YouTube player, autoplay and course credit | UNVERIFIED | Run an authorized actual assignment; report media and course-credit observations separately |
| Actual Khan editor, accepted answer, Check/Next/Done | UNVERIFIED | Use authorized practice/test material and observe the actual response |
| Other installed Chrome versions / Firefox / Web Store | NOT TESTED / NOT PUBLISHED | Outside this verification |

No Chrome session, student records or credentials were supplied or copied. The corrected build is not described as universally working or live-certified. Solver capabilities and unsupported formats are listed in `README.md`; graphs, multiple choice, multiple fields, systems and general word problems still pause.

Project Sovereign, RADAR and the selected KUBBA-KHAN checkout were left unchanged. No external messages, paid services or publication were performed.
