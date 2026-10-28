# KUBLA KHAN · 2.2.0

[Download Chrome extension + optional local helper](https://github.com/PandaExpress15/KUBLA-KHAN/raw/refs/heads/main/downloads/KUBLA-KHAN-Chrome-v2.2.0.zip) · [Complete source](https://github.com/PandaExpress15/KUBLA-KHAN/raw/refs/heads/main/downloads/KUBLA-KHAN-Source-v2.2.0.zip)

This rebuild reads a structured question before choosing its solver and response adapter. It fixes incidental application widgets being classified as graphs, supports named multi-field answers and verified semantic multiple choice, and preserves original mathematical domain restrictions.

Extract into a permanent folder. In chrome://extensions, remove the old runner, enable Developer mode, Load unpacked and choose extension. Confirm2.2.0 and refresh Khan. On All assignments / To-do, choose Survey all assignments, inspect the local plan, then Run plan. Survey reads only visible first questions and never submits answers; later questions are inspected during execution.

Broader mathematics requires the bundled2.2.0 helper: open a terminal in the extracted folder and run the exact command shown in the popup, equivalent to `sh helper/start.sh YOUR_EXTENSION_ID 9000`. It creates a private Python environment with hash-pinned free dependencies. Pair its printed token, enable localhost permission, then Refresh helper health. A new extension folder can change its ID; restart this helper with the new ID. Do not stop unrelated services to free a port—choose an unused port instead.

| Supported bounded family | Required visible evidence |
| --- | --- |
| Exact algebra, factorization, equations, powers, logs and trig | Unambiguous original expression, domain, angle/precision requirements and supported response |
| Completing square | Signed blank template, including fixed nonmonic coefficient |
| Polynomial division | Original dividend/divisor and named quotient/remainder slots |
| Slope, rate, average rate and point-slope | Exact table/points, explicit interval or slope as required |
| Inverse tables/affine functions; rational features | Explicit target and original function/table |
| First invalid algebraic step | Captured ordered steps and original expression/domain |
| Multiple choice | Every choice interpretable, exactly one independently verified match |

Interactive graph drawing, arbitrary word interpretation and ambiguous/unsupported widgets remain needs-review. Generic fields cannot safely represent every solution-set format. Existing answers are preserved. Continue past blocked assignments defers them without marking them complete. One exercise and one independent video can run together; answers retain integer10–30-second spacing. Stop cancels pending extension actions, including helper/model results; already entered text is not undone.

Ollama and model weights are optional and not bundled or installed. A configured local model can propose structured interpretations, but exact original-task binding and verification must authorize entry. Actual model inference could not be tested here because model downloads returned403; scripted protocol tests are labelled separately. The tiny0.6b example is a runtime smoke test, not a general math guarantee. See helper/README.md.

Copy question sample exports bounded question text/math/options and widget inventory without class URLs or entered answers. Review it locally before sharing. Optional PNG transcription uses local Tesseract when installed; OCR is explicitly unverified and never automatically supplies an answer.

See TEST_REPORT.md for actual Chrome, helper and independent math results. The owner's signed-in Chrome and27 assignment questions remain unverified; the uploaded metadata-only plan cannot establish their before/after coverage. Project Sovereign, RADAR, MasterChess and prior frozen releases remain untouched.
