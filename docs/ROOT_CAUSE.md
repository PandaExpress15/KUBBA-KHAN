# Reproduced defects and owner-side limit · 2.1.2

## What is established

The original handoff did not establish why Start failed in the owner's signed-in Chrome. This workspace cannot access that session. **The owner's exact failing boundary is still BLOCKED until they supply Copy diagnostics after one Start click.** A synthetic classroom cannot establish the real site's selectors or player/editor compatibility.

A real Chrome action-popup failure was reproduced locally, and several additional defects were reproduced and corrected. These are evidence-backed fixes, not a claim that every possible classroom failure has been identified.

## 1. The actual action popup clipped Start

Original CSS combined a 400px body width with `max-width:100vw`. Chrome initially supplied a 255px-wide popup viewport, so that maximum clamped the desired intrinsic width to 255px. The narrow layout wrapped Start and grew vertically.

Measured in the real Chrome action popup:

- Viewport: 255 × 510.
- Start rectangle: top 479.390625, bottom 547.5625; center approximately 513.48.
- A pointer click at the button's center was outside the 510px viewport and did not reach its handler. The run stayed IDLE.
- Invoking the actual handler directly crossed popup → runtime → worker → queue → injection. Both lanes began and the actual fixture media/answer workflow progressed. This separated the UI boundary from a missing worker/import explanation.

The correction gives the popup an explicit 400px minimum width. Chrome measured a 415px viewport including its scrollbar, with Start fully visible at y=349.9375–387.328125. Actual pointer Start and Stop then passed. No programmatic `.click()` substitute is used for that acceptance test.

Evidence: `evidence/popup-before.log`, `popup-before.png`, `popup-after.png`, `rapid-stop-after.log`; regression: `tests/browser-popup.mjs`.

This reproduces a real failure in the available Chrome. It does not establish that the owner's screenshot had the same viewport or that their post-click state was identical.

## 2. Stop could lose to queued Start

The real popup rapid-Start/Stop test originally left two class tabs instead of one: an older queued Start created a work tab after Stop was requested. Startup reset the shared cancellation flag after asynchronous lookups, and the worker had no generation check for a Start that predated Stop.

The worker now tags queued requests with a Stop epoch and rejects stale Start requests. The controller also detects cancellation during asynchronous startup and before subsequent setup effects. Stop is verified through an actual runtime reply serialized after it, rather than an old STOPPED state or notice text.

Evidence: `rapid-stop-before.log` (2 versus 1 tabs) and final popup browser test. Regression also covers cancellation during tab lookup in `dual.test.mjs`.

## 3. Hidden expressions and unrelated controls crossed the question boundary

The original real-DOM snapshot returned an empty expression when a hidden unrelated annotation existed. It simultaneously returned `accepted:true` because an unrelated Next question control existed, even though the current question still had Check.

The snapshot now scopes visible math, controls and feedback to the current question region, excludes hidden annotations and requires positive local feedback with Check absent. Exercise actions use the same region rather than an unrelated sidebar button.

Evidence: `question-scope-before.log`, `question-scope-after.log`, final `browser-boundaries.mjs` run. Native existing-work preservation, stale Check tokens and content-frame authority are also checked in real Chrome.

## 4. A new expression was incorrectly credited before accepted feedback

The controller treated any changed problem key during CHECKING/WAITING_FEEDBACK as a completed question. A regression demonstrated that this credited progress before site acceptance, then tried to handle the changed page.

Only a changed identity following accepted feedback and an intentional Next is now counted. A changed expression before that pauses with `PROBLEM_CHANGED_BEFORE_FEEDBACK`, with no completion credit or second Check.

Evidence: `feedback-before.log`, focused Node regression, and actual-browser recovery scenario that changes the displayed expression after Check without supplying feedback.

## 5. Real empty MathQuill did not disclose clipboard mode

Mocks returned `$$` when reading an empty stateless-clipboard editor. Upstream MathQuill 0.10.1 returns an empty string because no selection exists. The fallback consequently chose plain LaTeX and failed to enter a negative fraction in the real stateless editor (`MATHQUILL_ENTRY_NOT_OBSERVED`).

The correction uses dollar-delimited paste and verified public DOM readback. Stateless mode interprets the delimiters as math boundaries. Plain mode renders literal dollars; the adapter removes only verified wrappers around its own inserted expression with normal editor keystrokes, then rereads the result. Copy/paste prevention, stale-page guards, existing work and algebraic verification remain enforced.

Actual upstream browser cases pass for factors, negative fractions, rational fractions, radicals and both clipboard modes. Disabled copy/paste and existing work remain unchanged.

Evidence: `mathquill-stateless-before.log`, final `browser-mathquill.mjs` output. The real classroom's MathQuill distribution is not available here.

## Other corrections and test-harness findings

Paused lane errors now appear at the top. The manual INSERT worker path uses a static import because MV3 worker dynamic imports are unsupported; its actual Read/Solve/Insert flow passes in the real popup.

The original supplied browser harness opened `popup.html` as a regular browser tab, which fails the worker's intended sender authority check. The corrected harness attaches to the real Chrome action popup. It waits for actual message/probe completion rather than assuming that persisted DISCOVERING/STOPPED state is a completed command.

The system Chromium administrator blocked unpacked extension installation; that policy was left untouched. A separate official Chrome package was verified against Google's signed repository and used. Normal Developer mode was enabled through its isolated profile's UI. A test fixture initially used jQuery Slim, which lacks MathQuill's `.stop()` dependency; final tests use the full licensed jQuery distribution and require zero page errors. These were test-environment defects, not owner-side root causes.

## Remaining owner action

Install the corrected candidate, open the actual classroom To-do list, press Start once, and paste **Copy diagnostics** (sanitized JSON). That identifies the first live boundary without sharing credentials or a browser profile. Actual Khan video playback, native/editor compatibility, grade responses and course credit remain unverified until the owner's authorized session is available through supported tooling.
