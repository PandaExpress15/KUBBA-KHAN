# Khan Runner for Chrome · 2.1.5

A standalone, local MV3 extension for two coordinated classroom tabs. Runtime dependencies: none. No helper server, account transfer, paid API, remote solver, cookie access or grade/progress API is used.

**The owner confirmed video playback works in 2.1.3. Exercise changes in 2.1.4 are browser-tested on synthetic classroom UI; actual Khan exercise acceptance remains unverified pending owner diagnostics.** The actual user's Chrome session is not connected to the cloud workspace. Real browser execution is distinct from a real classroom acceptance test. See `TEST_REPORT.md` and `ROOT_CAUSE.md` for evidence and limitations.

## Install or update

1. Stop and remove the previous Khan Runner in `chrome://extensions` so two versions cannot compete. Removal clears its temporary run state.
2. Extract `Khan-Runner-Chrome-v2.1.5.zip` to a permanent folder.
3. In `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted `extension` folder containing `manifest.json`.
4. Confirm the extension card says **2.1.5**, pin its icon, and refresh your classroom tab once.
5. On your classroom **All assignments / To-do** list, open the extension and press **Start both tabs**. This authorizes supported automatic answer entry, Check and progression in that class.
6. The list returns to page one and scans its queue. Where both types exist, the list tab becomes the video tab and one additional exercise tab opens. Keep both tabs in the selected class.
7. **Stop all** cancels pending startup and future automatic actions and pauses runner-started media. An already-delivered action cannot be undone.

The ZIP is an unpacked extension distribution, not a Chrome Web Store publication or a signed CRX. Keep the extracted folder. Chrome 120+ is targeted by the manifest; the browser verification used Chrome 156.0.8078.47 on Linux. Other Chrome versions have not independently passed these checks.

## Answer pacing in 2.1.5

Each supported question gets a fresh, uniformly selected whole-number pause from **10 through 30 seconds**, inclusive, before automatic answer entry. The pause begins when the question and its Check control are readable. The popup displays the remaining seconds. The chosen deadline stays in session storage across worker suspension/restart; ordinary polling does not draw again or restart the wait.

The content ticker requests a wakeup near the deadline while continuing regular observations. Stop invalidates pending wakeups and prevents future entry/Check. The current question is read again before insertion; a changed problem pauses, and work you enter during the pause stays protected. Entry readback and the later once-only Check retain their existing verification. The video lane continues independently.

Browser scheduling or a sleeping/backgrounded device can make a wakeup late. The extension never intentionally enters an answer before its saved deadline. Existing grading, readback and feedback checks are retained. Actual Khan exercise acceptance remains unverified.

## Exercise reading correction in 2.1.4

A reproduced Chrome failure selected the deepest response renderer. It found the answer box but missed the problem statement and sibling Check/feedback controls. The reader now keeps the enclosing main question region, excludes sidebar/navigation content, recognizes the actual instruction instead of an unrelated heading, and ignores an answer prefix such as `=`, `x =` or `f(x) =`. Several independent problem expressions or conflicting instructions still pause.

A question or Check button that is still loading gets a bounded 12-second observation window before an explicit pause. No answer is entered before a single enabled Check control is identified. Copy diagnostics now includes sanitized exercise counts, operation, scope, reading state, solver status and submission phase; it contains no math text, answers or class URL.

A new actual-extension Chrome program follows eight mixed-format questions through real upstream MathQuill with no global API and alternating clipboard modes: the screenshot-style quadratic, difference of squares, higher-degree common factors, rational reduction, a linear equation, exact trig, expansion and numeric fraction evaluation. It verifies eight correct fixture responses, eight once-only Checks, seven Next and one Done. It also checks delayed question loading, answer labels, conflicting directions and ambiguous expressions. This is evidence for those supported paths, not a promise to solve every Khan exercise.

## Retained pagination correction from 2.1.3

The owner’s screenshot confirmed that Start failed at assignment-list pagination while a Next button was visible. The old action matcher discarded the visible button text whenever an aria-label existed, and only accepted the exact name Next. A real Chrome regression reproduced the same error for a visible Next button named Next page.

The dedicated pagination adapter recognizes visible text, standard accessible labels, labelled-by references, titles and next/previous link relationships. It prefers an explicit pagination region, rejects disabled/ambiguous controls and links outside the current class, and waits up to 20 seconds for controls still loading. Diagnostics report control-state counts and match categories rather than student data. Later list pages get their own loading timeout.

The popup now says **Scanning your assignment list**. That means collecting Video and Exercise rows across the pages; articles are skipped. It does not require a Reading assignment.

## Corrections in this build

- Explicit popup minimum width prevents Chrome's initial 255px viewport from clipping Start. Pointer clicks on Start and Stop are tested in the actual action popup.
- Stop invalidates queued/in-flight startup instead of permitting a late Start to create work tabs.
- Current question math, feedback and exercise buttons are scoped to the active question region. Hidden math and unrelated Next/Correct UI are excluded.
- A changed expression before accepted feedback pauses instead of being credited as a completed question.
- Actual MathQuill empty fields cannot reveal clipboard mode. The fallback now handles plain and dollar-delimited clipboard modes using normal editor events and verified readback. It removes only verified literal wrappers from its own insertion; copy/paste prevention and existing work remain protected.
- Paused lane reasons appear in the top status panel while other lanes can continue.
- Manual insertion uses a static module import compatible with MV3 service workers.

## Behavior and limits

The video lane calls real media playback at 2× by default, observes advancing media time and a real ended state, and then opens the next queued video. Background video is muted by default to permit Chrome autoplay. No seeking or fabricated completion events are used. An autoplay refusal pauses with `AUTOPLAY_BLOCKED_CLICK_PLAY`. **A video end is not proof of recorded course credit.** Tests use real HTML5 media, including one permitted cross-origin iframe fixture; the actual Khan/YouTube player remains unverified.

The exercise lane reads one unambiguous expression and recognized operation, solves locally, enters an empty field, checks readback on a later observation, persists Check intent, clicks once, and waits for accepted feedback before Next/Done. Unknown outcomes are not automatically retried. Identical questions without a reliable ordinal pause rather than guessing identity. Do not navigate or edit a managed lane while it is running.

| Format | Restricted solver | Browser evidence | Actual Khan |
|---|---|---|---|
| One-variable polynomial factor/expand/simplify | Exact arithmetic; degree ≤8; bounded coefficients/search | Factoring through native controlled input and actual MathQuill | Unverified |
| One-variable linear equations | Exact solution; nonlinear equations unsupported | Full real-MathQuill equation entry/Check/feedback fixture | Unverified |
| Single polynomial rational fraction | Exact GCD cancellation; original denominator exclusions still apply | Full real-MathQuill reduction entry/Check/feedback fixture; solver tests | Unverified |
| Standard sin/cos/tan values | Exact common unit-circle angles and supported numeric degrees | Full real-MathQuill exact-value entry/Check/feedback fixture; solver tests | Unverified |
| One empty native text field | Setter + input/change + later persisted readback | Full Check/Next/Done with controlled rerender | Unverified |
| Public MathQuill API / no-global DOM fallback | Public methods or ordinary editor events only | Actual upstream 0.10.1, plain/stateless modes, factors/fractions/radical, restrictions | Unverified |
| Graphs, multiple choice/fields, systems, general word problems, arbitrary trig | Unsupported; explicit pause | Unsupported/rejected paths tested | Unsupported |

Queue capture is bounded to ten pages and 100 items; articles and foreign-class jobs are excluded. A run has a four-hour limit. Temporary queue URLs, tab IDs, hashed problem identities and submission intent stay in Chrome session storage. Browser/extension reload may clear that state; start a new run from the To-do list. Worker suspension alone preserves intent.

## Diagnosing your actual classroom

If Start fails in your Chrome, press Start once and then **Copy diagnostics**. Supply the sanitized JSON with the first failure code. It contains build/browser, startup stage, queue probe counts and lane error codes, without student names, class URLs, problem text, answers or cookies. Do not send passwords, profiles or session cookies. The cloud chat cannot attach to the owner's desktop Chrome directly.

## Reproduce the checks

Node 20+:

```sh
npm test
```

The browser tools are development-only and are kept outside the extension. Install pinned Playwright with lifecycle scripts disabled, then install its official browser:

```sh
npm install --prefix ../khan-browser-tools --ignore-scripts --no-audit --no-fund playwright@1.62.1
node ../khan-browser-tools/node_modules/playwright/cli.js install chromium
export PLAYWRIGHT_MODULE="$(cd ../khan-browser-tools && pwd)/node_modules/playwright"
npm run test:browser
```

A recent official Chrome can be selected with `CHROMIUM_PATH=/absolute/path/to/chrome`. Tests require Chromium's sandbox to function and a current Chrome developer protocol (unpacked loading API). No `--no-sandbox`, web-security bypass, TLS bypass or autoplay bypass is used. Do not change administrator policies to make these tests pass. In the cloud machine, the filesystem sandbox prevented the setuid helper from starting; the browser commands ran through the approved execution path with Chromium's own sandbox enabled. The managed system Chromium blocked extension loading, so a separate official Chrome package was verified against Google's signed repository and used with a disposable profile. No system browser policy was changed.

The browser harness enables Developer mode in that disposable profile, loads the actual extension, attaches CDP to its actual action popup, serves isolated synthetic HTML and real generated WebM, and uses actual upstream MathQuill. It does not mock Chrome APIs, media playback or the editor. Fixtures do not certify current Khan markup, authentication, grading, or course credit.

`tests/vendor/UPSTREAM.md` records upstream sources, licenses, build steps and dependency integrity. Third-party files are test fixtures only; none are shipped as executable extension dependencies.

Project Sovereign and RADAR are untouched. Changes and downloadable releases are published only to the owner-authorized KUBBA-KHAN repository.
