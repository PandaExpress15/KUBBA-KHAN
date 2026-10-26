# Exercise correction · 2.1.4

The owner confirms the 2.1.3 extension watched the videos, but reports that it did not answer exercise boxes. No new exercise screenshot, DOM or diagnostic error was supplied for that failure, and the owner’s signed-in Chrome is not connected to this cloud workspace. Its exact exercise boundary remains unverified.

## Reproduced failure

An actual Chrome regression used a question stem and answer box in separate nested renderer panels, with Check and feedback in a sibling footer. The 2.1.3 reader chose the deepest renderer containing a field. Its result was one MathQuill field, no expression, no operation, and no Check controls. The test exited 1 at the assertion requiring the visible quadratic to be readable. See evidence/v2.1.4/panels-before.log. This is a proven source defect and a plausible explanation for the owner’s symptom, not an observation of the owner’s DOM.

## Correction

The reader and action adapter keep the enclosing main region, including the stem and footer, while excluding sidebars/navigation/hidden content. Explicit paragraph directives override unrelated assignment headings; conflicting instructions remain unsupported. Printed answer prefixes (=, x = and f(x) =) no longer become competing expressions. All other distinct expressions remain ambiguous.

Delayed question content and unavailable Check controls are observed for up to 12 seconds before pausing. A single enabled Check is required before entry. Existing work, algebraic readback, durable Check intent, accepted-feedback progression, class scope and Stop remain protected. Exercise diagnostics expose counts and stable categories without problem text or answers.

## Verification and limits

The new Chrome test completes eight supported formats through real no-global upstream MathQuill, alternating clipboard modes, once-only Check, correct fixture feedback and Next/Done. Tests also cover delayed content, labels, ambiguity, unrelated headings/completion, both actual work tabs, media, Stop and restart recovery. Exact final commands, exits and loaded source hashes are in TEST_REPORT.md and evidence/v2.1.4/.

The engine already supported the shown quadratic. This release fixes reading and control association, rather than claiming a universal solver. Graphs, multiple choice/fields, systems, general word problems and unsupported expressions still pause. Actual Khan exercise acceptance is unverified; Copy diagnostics on the paused exercise tab identifies the next owner-side boundary without transferring credentials.

The prior video/pagination fixes are retained. No host permissions, paid dependency, helper server, remote solver, credential access, grade API, browser security setting or unrelated project is added or changed. Project Sovereign and RADAR remain untouched.
