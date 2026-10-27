# KUBLA KHAN · 2.1.11

[Download Chrome extension + optional local helper](https://github.com/PandaExpress15/KUBLA-KHAN/raw/refs/heads/main/downloads/KUBLA-KHAN-Chrome-v2.1.11.zip)

Extract the ZIP into a permanent folder. Open chrome://extensions, enable Developer mode, remove the old runner and Load unpacked → extension. Confirm2.1.11 and refresh Khan. Start from All assignments / To-do / All activities.

Built-in exact math works without a helper. For broader exact math on Linux, install Python3 with venv support, then run `sh helper/start.sh YOUR_EXTENSION_ID` from the extracted folder. Copy the extension ID from chrome://extensions. This installs pinned free SymPy dependencies into helper/.venv, starts a localhost-only service and creates a private token configuration. Keep that terminal running. Open the extension's Optional local math helper panel, paste the token and click Enable local helper. Chrome asks for loopback permission. No question goes to a remote AI service. See helper/README.md for setup, security and supported formats.

One exercise runs alongside one discovered video. Blocked assignments now default to needs review and the next assignment opens; completion and review counts remain separate. Uncheck Continue to pause instead. An uncertain submission is retained across Start and never blindly retried. Stop cancels future actions. Review deferred work yourself; this cannot solve every question or guarantee Khan credit.

See [verification](docs/VERIFICATION.md) for actual Chrome, real MathQuill, HTTP helper and queue recovery results. Signed-in owner Chrome is not attached. The prior2.1.9 same-profile restart timeout remains separately documented unless explicitly resolved by current evidence. Project Sovereign, RADAR and frozen releases are untouched.
