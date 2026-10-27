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

A small free local model example is `qwen3:0.6b`. Download it through your installed runtime if you choose:

```sh
ollama pull qwen3:0.6b
```

Model size and speed depend on your hardware. A small model can make mathematical mistakes. No model is presented as solving all mathematics or guaranteeing correctness. Ollama is MIT-licensed; Qwen3 model weights use the Apache 2.0 license. Review the particular model's official card and license if you choose a different one.

Restart this helper with the installed local model enabled:

```sh
KUBLA_REASONING_MODEL=qwen3:0.6b sh helper/start.sh YOUR_32_LETTER_EXTENSION_ID 9000
```

Then use the extension's explicit local-reasoning control. The model receives only the supplied expression, selected operation and bounded problem instruction. It returns a mathematical proposal and brief explanation, not browser actions. A free-form word problem with no independently verified formal interpretation remains review-only. Stop cancels the extension's pending reasoning job and prevents any later page action from that result; a runtime may finish an already received computation independently.

**Local-only protection:** a localhost API alone is not proof of local inference, because Ollama can support cloud aliases. This helper rejects cloud-tagged names, active `remote_host`/`remote_model` metadata, missing local size/digest/GGUF metadata, and unverifiable `/api/show` model architecture. It checks metadata before each proposed inference and never follows redirects or accepts an arbitrary model URL. If you manage your own Ollama server, its documented `OLLAMA_NO_CLOUD=1` setting provides additional protection; configure your own service rather than replacing an existing one. The helper never silently falls back to a hosted model.

**Actual verification limit:** in this cloud environment, official model-registry/weight downloads returned HTTP 403. Tests exercise the real HTTP helper and exact verifier against a clearly labelled scripted Ollama-shaped protocol fixture. They do not prove that a real reasoning model ran, nor establish its answer quality. Owner-side Ollama inference remains unverified until the owner connects an installed local model.

## Exact solver scope

The exact engine supports bounded arithmetic, rational/surd simplification, single-variable rational polynomial factoring/expansion, common exact trigonometric and inverse-trigonometric expressions, and equations with exactly one verified real solution. It rejects multiple/no roots when a one-box answer format cannot be established. Input limits, explicit real-domain checks, degree/search bounds and resource limits remain in force. See the verification report and exact-trig tests for the precise tested formats. Graph-only, image-only, multi-field and ambiguous word problems remain unsupported by automatic exact entry.

The dedicated whitelist parser constructs symbolic math directly. It never calls `eval`, `sympify(string)` or `parse_expr` on input. Every computation runs in a separate bounded child. `/v1/verify` recomputes the original requested operation, then checks returned answer and actual editor contents; factoring also requires irreducible rational factors, not merely equivalent expansion.

## Protocol and security

The helper binds IPv4 loopback only. It requires an exact Host header, the configured Chrome extension Origin, and a random 256-bit bearer token. Other websites and unpaired extensions are rejected. The token config has mode 0600. Authenticated `POST /v1/health` with `{}` retains Chrome's Origin header; GET health also requires the correct Origin.

Requests are at most 4096 bytes. At most two exact operations and one reasoning job run concurrently. Exact operations have a four-second wall clock, three-second CPU and 768 MiB memory limit. Reasoning HTTP/model work runs in a separate child with an absolute 34-second parent deadline, followed by at most four seconds of independent exact verification. Health/model availability has an absolute deadline under one second. A slow-drip response cannot keep a child alive past its parent deadline. These limits return unavailable/review status; they do not authorize an unverified answer. The model job does not hold the extension's serialized automation queue, so video and Stop remain responsive.

No owner screenshots, passwords, cookies, browser profiles, private Khan APIs or grade APIs are used by this helper. Temporary deferred jobs are not marked complete. Pairing tokens, virtual environments and bytecode caches are excluded from release packages.

## Reproduce checks

From the full source folder, with pinned requirements installed:

```sh
python3 tests/helper_test.py
python3 tests/exact_trig_test.py
python3 tests/helper_reasoning_test.py
```

The reasoning protocol tests explicitly use scripted model replies and real local HTTP/SymPy verification. They check that wrong or unformalized proposals cannot become verified answers, cloud models are rejected, opt-in/authentication are enforced, and an occupied helper port is reported without stopping its process. Browser integration tests are separate; none establishes signed-in Khan acceptance.

Dependencies are SymPy 1.14.0 and mpmath 1.3.0, both BSD-licensed. Their exact pure-Python wheel hashes are in `requirements.txt`; no source build or lifecycle script is run. The package contains no virtual environment, model weights or pairing token.
