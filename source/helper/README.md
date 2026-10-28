# Optional local exact solver and reasoning assistant

Both services run **on the same Linux computer as Chrome**. A helper or model started in this cloud workspace does not attach to your desktop Chrome. The extension's built-in solver and deferred-assignment queue work without either optional service.

The exact solver uses free SymPy. The optional reasoning feature uses an already installed local Ollama model to propose an answer and a short explanation. A proposal becomes a verified mathematical result only when the deterministic solver independently recomputes the original requested operation and checks the proposed answer. Unverified word-problem interpretations and other unsupported proposals stay **for review**; the model cannot type, click Check, execute commands, access files or use browser tools.

## Start the exact helper on your Linux computer

Requirements: Python **3.9 or newer**, its `venv`/`ensurepip` support, internet for the first pinned package installation, and the extracted distribution in a permanent writable folder. No system-wide Python package or administrator access is used. If Python lacks venv support, install your distribution's Python venv package yourself, then rerun the command.

1. Install the extension with **Load unpacked → extension** and note its 32-letter ID on `chrome://extensions`.
2. Open a terminal in the extracted distribution folder:

   ```sh
   sh helper/start.sh YOUR_32_LETTER_EXTENSION_ID
   ```

   The default helper port is **9000**. To choose another port:

   ```sh
   sh helper/start.sh YOUR_32_LETTER_EXTENSION_ID 9001
   ```

   Set the same port in the extension. The script creates `helper/.venv` and installs two exact pinned pure-Python wheels from PyPI with SHA-256 verification. Repeating it repairs a partial install and reuses the private pairing token. It never stops another process or starts a second Ollama server. If a port is occupied, it exits with a clear message; leave the existing process running and choose another port. A service already occupying 8765/8766 is not necessarily this helper.
3. Keep the terminal running. In an interactive terminal, startup displays a local pairing token. Copy it into the extension's optional local-solver settings and connect. When output is redirected, the token is withheld from logs; startup gives its private config path instead, normally `~/.config/kubla-khan/helper.json`. Copy only that file's token string. Do not paste the token into chat, bug reports or GitHub. It is a local pairing secret, not a Khan password or cookie.
4. Stop this helper with Ctrl+C. Restart with the same command when wanted. If an update changes the unpacked extension ID, restart with the new ID and pair again.

## Optional free local reasoning model

This mode is **off by default** and requires a separately installed Ollama runtime and locally downloaded model weights. The helper does not install Ollama, download models, alter system services, add GPU repositories, or start/kill a runtime on your behalf.

Use [Ollama's official download and documentation](https://ollama.com/download) for your operating system. If you already run Ollama, reuse that server; do not run another `ollama serve` on its occupied port. Its standard API must be reachable at `127.0.0.1:11434`.

Check existing models:

```sh
ollama list
```

A small free runtime smoke-test model is `qwen3:0.6b`; it is not a reliable general math reasoner. Run the bundled diagnosis first and choose a larger model only if your hardware supports it. Download it through your installed runtime if you choose:

```sh
ollama pull qwen3:0.6b
```

Model size and speed depend on your hardware. A small model can make mathematical mistakes. No model is presented as solving all mathematics or guaranteeing correctness. Ollama is MIT-licensed; Qwen3 model weights use the Apache 2.0 license. Review the particular model's official card and license if you choose a different one.

Restart this helper with the installed local model enabled:

```sh
KUBLA_REASONING_MODEL=qwen3:0.6b sh helper/start.sh YOUR_32_LETTER_EXTENSION_ID 9000
```

Enable the local helper in the extension, then refresh helper health. When the helper was launched with KUBLA_REASONING_MODEL, the structured pipeline can request local interpretation automatically; the separate reasoning controls also allow explicit review requests. The structured interpreter receives the scoped question stem, original ordered math, named response slots, every captured choice, and table/graph evidence. It excludes the class URL, DOM selectors, existing answers and current selections. The model returns a bounded typed task/answer proposal and brief explanation, never browser actions. An independently extracted task, original-evidence binding, exact domain-aware solver and actual editor readback must all agree before automatic Check. A model cannot authorize its own interpretation. A narrow recovery path supports previously unrecognized complete formal directives, such as “Express the expression in simplest form,” only when an independent directive binder, the exact captured expression, one enabled empty named slot and domain checks prove the mapping. Additional conditions, invented units/precision/slots, ambiguous words and diagram data prevent recovery. Unknown captures produce review proposals and precise reasons while other permitted work continues. A free-form word problem with no independently verified formal interpretation remains review-only. Stop cancels the extension's pending reasoning job and prevents any later page action from that result. The helper detects a disconnected HTTP caller and kills its waiting child promptly; an Ollama runtime may finish already received computation independently.

**Local-only protection:** a localhost API alone is not proof of local inference, because Ollama can support cloud aliases. This helper rejects cloud-tagged names, active `remote_host`/`remote_model` metadata, missing local size/digest/GGUF metadata, and unverifiable `/api/show` model architecture. It checks metadata before each proposed inference and never follows redirects or accepts an arbitrary model URL. If you manage your own Ollama server, its documented `OLLAMA_NO_CLOUD=1` setting provides additional protection; configure your own service rather than replacing an existing one. The helper never silently falls back to a hosted model.

**Actual verification limit:** in this cloud environment, official model-registry/weight downloads returned HTTP 403. Tests exercise the real HTTP helper and exact verifier against a clearly labelled scripted Ollama-shaped protocol fixture. They do not prove that a real reasoning model ran, nor establish its answer quality. Owner-side Ollama inference remains unverified until the owner connects an installed local model.

## Optional local OCR of a question crop

The helper can reuse an **already installed Tesseract with English (`eng`) data**. It does not install a system package or require Pillow at runtime. See [Tesseract's official installation documentation](https://tesseract-ocr.github.io/tessdoc/Installation.html) if you choose to install it with your own distribution's package manager. Its code is Apache-2.0 licensed. The inspected cloud binary is Tesseract 5.5.0; owner availability is reported separately.

Use the extension's explicit PNG file chooser and **Transcribe locally** control. Select a crop containing only the current question/diagram, excluding names and classroom sidebars. The extension does not capture your desktop or silently photograph background tabs. A PNG must be noninterlaced, 8-bit, at most **2048 × 2048** pixels and **2 MiB**. The fixed loopback helper receives only the explicitly selected image and question fingerprint.

The engine reads printed text and labels; it does **not** prove mathematical meaning, graph coordinates or an answer. Every result is labelled **OCR UNVERIFIED**, includes transcription and word boxes/confidence, and remains outside automatic entry/Check. Check exponents, minus signs, fractions and axis labels yourself. In the actual synthetic smoke test, printed `x^2` became `x*2` and adjacent axis labels merged. High OCR confidence does not establish mathematical correctness. No vision-language model or reliable universal equation OCR is claimed.

`POST /v2/transcribe` accepts `{image:{mime:"image/png",data:BASE64},fingerprint,source:"question-crop"}`. It rejects URLs, alternate languages, command/config arguments, malformed/oversized PNGs and decompression-size mismatches. Ancillary PNG metadata is stripped. The request body limit is 3 MiB to allow base64 overhead. Processing runs in one separate bounded worker: five-second parent wall deadline, four-second engine limit, 768 MiB address-space limit and bounded TSV output. The parent owns a private temporary directory and removes the image/TSV on success, failure or client cancellation. Only that worker's process group is killed; existing services are left alone. Transcription is capped at 8000 characters and 200 word boxes, with an explicit truncation flag.

## Privacy-limited owner diagnostics

Run this on the same Linux computer as Chrome, not in a remote cloud terminal:

```sh
python3 helper/diagnose.py
```

It prints Python/OS, RAM, logical CPU count, free disk, installed SymPy version, NVIDIA GPU memory when `nvidia-smi` is already available, the local Ollama version/model names/sizes/cloud-metadata flags, and optional Tesseract/English-data availability. It reads no browser profile, cookies, class pages, usernames, environment variables or pairing-token config. Review model names before sharing the report. It does not benchmark model accuracy or prove that inference ran. Choose a model only after checking available RAM and its official model card; a tiny smoke-test model is not reliable reasoning evidence.

## Exact solver scope

The typed exact engine supports bounded arithmetic, rational/surd simplification, polynomial factoring/expansion, exact trig/inverse trig, complete real finite solution sets (including no solutions), labelled completing-square fields, polynomial quotient/remainder, and slopes/rates/point-slope equations from exact public points or tables. The immutable original syntax preserves denominator exclusions, radical/log conditions and rational-power branches. Raw helper `log` needs an explicit base. On a verified Khan HTTPS question document, captured `notation.logConvention=khan-kas-common` can establish common-log base 10, matching the inspected official KAS parser; `ln` means natural log. An arbitrary website or model claim cannot establish that convention. Graph points are exact only when public accessible labels establish them; approximate pixels do not become exact coordinates. Unsupported graph interaction, missing diagram data, ambiguous words and unknown response forms stay review-only. Legacy scalar APIs continue to reject no/multiple roots. See the support matrix for actual tested constraints.

The dedicated whitelist parser constructs symbolic math directly. It never calls `eval`, `sympify(string)` or `parse_expr` on input. Every computation runs in a separate bounded child. `/v1/verify` recomputes the original requested operation, then checks returned answer and actual editor contents; factoring also requires irreducible rational factors, not merely equivalent expansion.

## Protocol and security

The helper binds IPv4 loopback only. It requires an exact Host header, the configured Chrome extension Origin, and a random 256-bit bearer token. Other websites and unpaired extensions are rejected. The token config has mode 0600. Authenticated `POST /v1/health` with `{}` retains Chrome's Origin header; GET health also requires the correct Origin.

Legacy requests are at most 4096 bytes; structured requests are at most 32768 bytes with bounded text, nesting, arrays and field counts. `/v2/task/solve` takes `{document}`; `/v2/task/verify` takes `{document, answer, observed:{fields:{slotId:text}}}`. `/v2/interpret` takes `{document}`. The versioned document is `kubla-problem-v1`, its task is `kubla-task-v1`, and replies echo the original question fingerprint. Typed solving and verification require deterministic public-evidence binding; the local model cannot substitute a new task. Optional preinstalled Tesseract provides unverified transcription only; no OCR binary or vision model is bundled. `/v2/task/compare-option` independently interprets each captured option and returns `interpreted:false,equivalent:null` when comparison is unknown; an unknown option is never a proved false option. At most two exact operations, one reasoning job and one independent OCR job run concurrently. Exact operations have a four-second wall clock, three-second CPU and 768 MiB memory limit. Reasoning HTTP/model work runs in a separate child with an absolute 34-second parent deadline, followed by at most four seconds of independent exact verification. Model availability has a subprocess deadline under one second; optional OCR availability has a separate half-second metadata limit. A slow-drip response cannot keep a child alive past its parent deadline. These limits return unavailable/review status; they do not authorize an unverified answer. The model job does not hold the extension's serialized automation queue, so video and Stop remain responsive.

No owner screenshots, passwords, cookies, browser profiles, private Khan APIs or grade APIs are used by this helper. Temporary deferred jobs are not marked complete. Pairing tokens, virtual environments and bytecode caches are excluded from release packages.

## Reproduce checks

From the full source folder, with pinned requirements installed:

```sh
python3 tests/helper_test.py
python3 tests/exact_trig_test.py
python3 tests/helper_reasoning_test.py
python3 tests/helper_structured_test.py
python3 tests/helper_ocr_test.py
```

The OCR tests use the actual installed Tesseract on synthetic printed fixtures; they skip if the optional engine/English data is unavailable. OCR mistakes and absence of mathematical verification are recorded in `evidence/actual-ocr.json`. The reasoning protocol tests explicitly use scripted model replies and real local HTTP/SymPy verification. They check that wrong or unformalized proposals cannot become verified answers, cloud models are rejected, opt-in/authentication are enforced, and an occupied helper port is reported without stopping its process. Browser integration tests are separate; none establishes signed-in Khan acceptance.

Dependencies are SymPy 1.14.0 and mpmath 1.3.0, both BSD-licensed. Their exact pure-Python wheel hashes are in `requirements.txt`; no source build or lifecycle script is run. The package contains no virtual environment, model weights or pairing token.
