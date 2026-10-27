# Optional local exact-math helper

This helper runs **on the same Linux computer as Chrome**. Starting it in the cloud workspace does not make it available to your desktop browser. The extension's built-in solver and deferred-assignment queue work without it.

The helper is a free local computer algebra system using SymPy, rather than a language model. It computes exact results and verifies them before entry, then recomputes the original problem and verifies the actual editor readback before Check. It makes no universal-math or guaranteed-correctness claim.

## Start on your Linux computer

Requirements: Python 3 with its `venv`/`ensurepip` support, an internet connection for the first pinned package installation, and the extracted distribution in a permanent writable folder. No system-wide Python package or administrator access is used. If your Linux Python lacks venv support, install your distribution's Python venv package yourself, then rerun the command.

1. Install the extension using **Load unpacked → extension** and note its 32-letter ID on `chrome://extensions`.
2. Open a terminal in the extracted distribution folder and run:

   ```sh
   sh helper/start.sh YOUR_32_LETTER_EXTENSION_ID
   ```

   Replace the final argument with the actual extension ID. The script creates `helper/.venv` and installs two exact pinned pure-Python wheels from PyPI with SHA-256 verification. Repeating the command repairs a partial installation and reuses the same private token.
3. Keep that terminal running. In an interactive terminal, startup displays the local pairing token. Copy it into the extension's optional local-solver settings, then enable/connect the helper. When output is redirected, the token is withheld from logs; startup gives the private config path instead (normally `~/.config/kubla-khan/helper.json`), where you can copy only its token string. Do not paste the token into this chat, a bug report or GitHub. It is a local pairing secret, not a Khan password or session cookie.
4. Stop the helper with Ctrl+C in its terminal. Start it again with the same command whenever you want the extra solver. If the unpacked extension's ID changes after an update, restart the helper with the new ID and pair the extension again.

A helper unavailable, busy, timed out, or unable to verify a problem is not permission to guess or overwrite work. The extension retains the problem for review and continues other permitted assignments according to its recovery settings.

## Supported scope

- Exact arithmetic and real radicals; examples include `sqrt(8) → 2*sqrt(2)`.
- Exact trigonometric values where SymPy can establish symbolic equality; for example `sin(pi/5)`.
- Single-variable rational expressions and polynomial expansion/factoring over rational coefficients, with a polynomial degree bound of 24. Every nonconstant factor must be irreducible over the rational numbers before a factor answer is accepted.
- Equations with exactly one verified real solution, degree at most four. Multiple/no solutions are rejected because an arbitrary answer list cannot safely be inferred for one box.

The parser accepts a restricted math grammar, one variable, numbers, `+ - * / ^`, grouping, `frac`, `sqrt`, `sin`, `cos`, `tan`, `log`/`ln`, `exp`, `pi` and `e`. It also reads the corresponding supported TeX notation from the rendered editor. Input is at most 300 characters, 200 tokens, nesting depth 24 and whole-number exponents from −12 through 12. Huge, ambiguous, graph-only, image-only, multi-field and unsupported word problems remain unsupported. Models/OCR, browser credentials, private Khan APIs and grade APIs are not used.

The extension checks availability with authenticated `POST /v1/health` and an empty JSON object. This keeps Chrome’s Origin header on the cross-origin request; ordinary GET health remains available to clients that supply the same required Origin.

Browser requests go only to `http://127.0.0.1:8765`. The server binds IPv4 loopback only, requires an exact Host header, the configured Chrome extension Origin, and a random 256-bit bearer token. Other website origins and unpaired extensions are rejected. The token file has mode 0600. Requests are at most 4096 bytes, at most two operations run at once, and each computation has a four-second wall-clock limit plus a three-second CPU and 768 MiB memory limit. Limits return an unsupported result; the helper remains available for later work.

Expressions are parsed with a dedicated whitelist grammar into symbolic constructors. The helper never calls `eval`, `sympify(string)` or `parse_expr` on input. Each computation runs in a fresh bounded child process. `/v1/verify` recomputes the original requested operation and checks both the returned answer and the actual editor contents; for factoring, algebraic equivalence alone is insufficient and the observed factors must also be irreducible.

## Reproduce helper checks

From the full source folder, using Python with the pinned requirements installed:

```sh
python3 tests/helper_test.py
```

These checks include actual loopback HTTP, authentication/origin/Host rejection, safe parsing, exact answers, TeX readback verification, rejected multiple roots, a killed over-time child and successful later recovery. The actual Chrome integration checks are separate; neither establishes acceptance in an owner's signed-in Khan classroom.

Dependencies: SymPy 1.14.0 and mpmath 1.3.0, both BSD-licensed. Their exact pure-Python wheel hashes are in `requirements.txt`; no source build or lifecycle script is run. For an offline repeat installation, retain the already installed `.venv`; the package itself does not contain a virtual environment or a pairing token.
