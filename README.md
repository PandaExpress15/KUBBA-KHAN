# KUBLA KHAN · 2.1.12

[Download extension + local helper](https://github.com/PandaExpress15/KUBLA-KHAN/raw/refs/heads/main/downloads/KUBLA-KHAN-Chrome-v2.1.12.zip)

Adds broader exact trigonometry, configurable local helper port and optional LOCAL model suggestions. This is not a universal solver. Unverified word-problem/model answers are review-only and never automatically entered or checked. Actual model inference could not be tested here because model downloads returned403; protocol/security/Stop tests use clearly labelled scripted responses.

Extract the ZIP into a permanent folder. Open chrome://extensions → Developer mode → remove the old runner → Load unpacked → extension. Confirm2.1.12 and refresh Khan.

For the free exact helper on Linux, run `sh helper/start.sh YOUR_EXTENSION_ID 9000` from the extracted folder. It installs hash-pinned SymPy dependencies in a private venv. Keep its terminal running, copy its local pairing token into Optional local math helper, set Helper port9000 and Enable. If9000 is occupied, choose another unused port in BOTH the command and popup. Never stop an unrelated service to make room;8765/8766 are not used by default.

For optional reasoning, first use `ollama list` to check an existing local Ollama installation. Do not replace or kill a service already listening on11434. Install/run Ollama privately or through its official desktop application if needed; this package does not run the system-changing install script. With a downloaded LOCAL model, run `KUBLA_REASONING_MODEL=qwen3:0.6b sh helper/start.sh YOUR_EXTENSION_ID 9000`. The small0.6b model is a minimal smoke-test choice with limited quality; larger models need appropriate memory. See helper/README.md before downloading weights. Cloud aliases are rejected. Refresh helper status shows exact solver connected separately from model disabled/missing/ready.

Readable unsupported expressions can queue one background model review while the assignment is marked needs review and the queue continues. You can also type a short problem and extra context in Local reasoning assistant. Stop cancels pending review and prevents late proposals. Model explanations remain unverified even when an exact formal answer can be checked independently. Suggestions never click Check.

One exercise and one video run independently; accepted finished assignments advance. Each answer retains its integer10–30-second pause. Needs-review assignments never count as completed; uncertain submissions remain guarded across starts. See [verification](docs/VERIFICATION.md) for actual verification, failed-test history and limits. Signed-in owner Chrome is not attached. Project Sovereign, RADAR and frozen releases remain untouched.
