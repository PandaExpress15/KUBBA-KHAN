# Classroom pagination failure · 2.1.3

## Confirmed owner-side boundary

The owner’s screenshot shows extension 2.1.2 reporting **Start failed: The assignment-list Next control was not found**. The class list is visibly on page 1 of 5 with a Next control. The failing boundary is assignment-list pagination, before the two work lanes begin. This is new live evidence; the earlier popup-size defect did not explain this screenshot.

The screenshot does not expose the actual DOM tag, accessible name or click handler. No signed-in owner browser connection is available, and the image/class identifier is not redistributed in this release.

## Reproduced implementation defect

The old action selector used `aria-label || visible text` and required the resulting name to equal `Next` exactly. In actual Chrome, the 2.1.2 extension reproduced `LIST_NEXT_UNAVAILABLE` on a five-page list with a visible Next button whose accessible name is Next page. That is a standard accessible control, and the old matcher wrongly rejected it.

This demonstrates a concrete selector defect consistent with the observed live boundary. It is not a claim that the screenshot proves the owner’s exact aria-label.

## Correction

`extension/pagination.js` centralizes list navigation. It recognizes visible text, aria-label, aria-labelledby, title, input-button labels and next/previous link relationships. An accessible label no longer hides a valid visible Next label. It prefers a specifically labelled pagination region when unrelated Next controls exist.

Before clicking, it checks the exact expected list URL and page, visibility, disabled ancestors, disabled fieldsets, pointer-event restrictions, and link destinations. Other classes, external origins and exercise-Next controls are excluded. Ambiguous controls stop rather than receiving arbitrary clicks. No authentication, editor or browser restriction is bypassed.

`dual.js` uses the same adapter for list inspection and Next/Previous actions, so the readiness probe and action selector cannot disagree about name variants. Temporarily missing or disabled controls get a bounded wait rather than an immediate startup failure. Briefly empty later pages get their own loading deadline. Successful clicks still require observed page change; unknown outcomes are not blindly retried. Full-document tests also reproduced loss of a script reply when navigation removed its frame. The controller preserves the saved click intent and waits for the new document; three actual runs completed, including two interrupted replies, without repeated navigation.

The top popup says **Scanning your assignment list** and reports when it is waiting for a Next/Previous page control. Its diagnostics include sanitized control-state counts, matching categories and action error codes. No class URL, student name, assignment text or answer is added to diagnostic exports.

## Verification and limits

See `TEST_REPORT.md` for final command outcomes. Regression files are `browser-pagination-controls.mjs` and `browser-pagination.mjs`; before/after evidence is under `evidence/v2.1.3/` in the complete-source archive. Fixtures use made-up class IDs and ordinary DOM UI; they do not inspect Khan private APIs or application code.

The restricted local solver and its unsupported-format pauses are retained. A broader solver, image/graph understanding and current real-site player/editor compatibility cannot be established from an assignment-list screenshot. Current signed-in Khan acceptance still requires the owner to run the updated build in their session.

The 2.1.2 popup layout, Stop cancellation, question/feedback scoping, actual MathQuill clipboard-mode and durable Check-intent corrections remain in place. Project Sovereign and RADAR remain untouched. GitHub publication to KUBBA-KHAN was explicitly authorized by the owner.
