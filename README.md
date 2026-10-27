# KUBLA KHAN · 2.1.13

[Download Chrome extension + optional local helper](https://github.com/PandaExpress15/KUBLA-KHAN/raw/refs/heads/main/downloads/KUBLA-KHAN-Chrome-v2.1.13.zip)

Survey first, then run a local plan. The survey visits every captured To-do assignment in one preview tab without starting exercises, selecting answers, typing, checking, advancing questions or playing videos. It reports only the first visible question. Later questions remain unknown; an intro page stays unknown until you authorize Run plan. Articles require manual reading.

Extract the ZIP into a permanent folder. Open chrome://extensions → Developer mode → remove the old runner → Load unpacked → extension. Confirm2.1.13 and refresh Khan. Open your classroom All assignments / To-do / All activities list. Click Survey all assignments, review the classifications, then Run plan. Export plan JSON saves a private local summary with assignment links; it is declarative data, not generated code. Every actual question is re-read during execution. Run without survey remains a secondary compatibility option.

New multiple-choice support selects only one independently verified formal answer in one supported single-answer group. Native radios, ARIA radios and Khan's public Perseus toggle-button markup are supported. Ambiguous equivalent choices, unparsed text, graphs, multiple answers, disabled/review controls and existing selections require review. Factor-choice support remains conservative; do not assume every factor question is supported.

One exercise runs alongside one discovered video. Accepted finished work advances to the next planned assignment. The integer10–30-second pause remains before each answer. Needs-review work never counts as completed. Stop cancels future actions; uncertain submissions are retained and never blindly retried. A completed plan remains available for export after Stop.

Optional Linux exact helper: `sh helper/start.sh YOUR_EXTENSION_ID 9000`. Pair its local token in the popup and use the same available port in both places. Do not terminate another service;8765/8766 are not defaults. See helper/README.md for the separate optional Ollama setup. Model runtime/weights are not included; real inference remains unverified here because weight downloads returned403. Unverified model suggestions are review-only. Signed-in owner Chrome is not attached.

See [verification](docs/VERIFICATION.md) for actual Chrome evidence, supported scope and failed-test history. Project Sovereign, RADAR, MasterChess and frozen releases are untouched.
