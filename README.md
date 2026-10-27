# KUBLA KHAN · 2.1.14

[Download Chrome extension + optional local helper](https://github.com/PandaExpress15/KUBLA-KHAN/raw/refs/heads/main/downloads/KUBLA-KHAN-Chrome-v2.1.14.zip)

Fixes survey rejecting a visibly selected To-do filter before it reaches any assignments or mathematics. Custom status controls now support associated labels and aria-labelledby, including compound label/current-value references. Unknown or conflicting controls still stop safely and explain the actual reason. Run without survey also fixes its startup scope error.

Extract the ZIP into a permanent folder. Open chrome://extensions → Developer mode → remove the old runner → Load unpacked → extension. Confirm2.1.14 and refresh Khan. On All assignments / To-do, click Survey all assignments. Review the local plan, then Run plan. Run without survey remains available. If a survey fails, Copy diagnostics now refreshes the current status-reader probe before copying.

The reported failure happened before queue discovery, so no math solver or model had been reached. The normal solver order remains built-in exact mathematics, optional local SymPy, then review-only model suggestions. This update does not install or start Ollama, and unverified model output still cannot automatically Check an answer. Runtime/model weights are not bundled.

The optional Linux helper still uses a configurable local port, default9000: `sh helper/start.sh YOUR_EXTENSION_ID 9000`. If loading a new folder changes the extension ID, restart the helper with that ID and pair its token again. See helper/README.md.

One exercise plus one video, integer10–30-second answer pauses, existing-work protection, durable once-only Check, needs-review counts and Stop remain. See [verification](docs/VERIFICATION.md) for actual Chrome verification and limits. Owner's signed-in Chrome remains unattached. Project Sovereign, RADAR, MasterChess, unrelated services and frozen releases remain untouched.
