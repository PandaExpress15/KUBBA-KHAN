# KUBLA KHAN · 2.1.9

[Download KUBLA KHAN for Chrome](https://github.com/PandaExpress15/KUBLA-KHAN/raw/refs/heads/main/downloads/KUBLA-KHAN-Chrome-v2.1.9.zip)

Automatically opens the next queued exercise after observed completion, including an accepted last Next leading to explicit practice results. Queued videos play independently at2×. A real Chrome workflow completed2exerciseassignments/4questions and2actualvideos, with automatic assignment handoff and no seeking. See TEST_REPORT.md for exact evidence and limits.

Stop/remove the old extension, extract the ZIP into a permanent folder, and use chrome://extensions → Developer mode → Load unpacked → extension. Confirm KUBLA KHAN2.1.9 and refresh Khan. Start from All assignments / To-do. Show All activities if videos should be included. One exercise runs at a time alongside one video; after completion each lane opens its own next queued item. The10–30-second pause applies before answers, not assignment navigation.

Queue counts show exercises/videos discovered, assignments completed and remaining. If no videos appear in the scanned list, the popup says so. Stop cancels future automatic actions; already delivered actions cannot be undone. Existing answers, readback, once-only Check and unsupported-format pauses remain protected.

This release passed300 Node checks and4 targeted actual-Chrome commands on synthetic classroom pages. Its two-assignment/two-video component passed; a later same-profile restart test timed out without captured state and remains unclassified. The independent fresh-profile Stop check passed; see TEST_REPORT.md for this limitation. The owner's signed-in Chrome is not attached; actual Khan exercise acceptance and course credit remain unverified. The local restricted solver is unchanged, with no helper service, paid API, private app state or expanded permission. Project Sovereign and RADAR are untouched.
