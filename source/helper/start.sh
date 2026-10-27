#!/bin/sh
set -eu
HELPER_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    printf '%s\n' 'Usage: sh helper/start.sh EXTENSION_ID_FROM_CHROME [PORT]'
    printf '%s\n' 'Default port: 9000. Optional model: KUBLA_REASONING_MODEL=qwen3:0.6b sh helper/start.sh EXTENSION_ID 9000'
    exit 2
fi
HELPER_PORT=${2:-${KUBLA_HELPER_PORT:-9000}}
if [ ! -x "$HELPER_DIR/.venv/bin/python" ]; then
    python3 -m venv "$HELPER_DIR/.venv"
fi
# Only exact pinned wheels; reuse the environment and repair partial installs.
"$HELPER_DIR/.venv/bin/python" -m pip install --disable-pip-version-check --no-input --index-url https://pypi.org/simple --only-binary=:all: --require-hashes -r "$HELPER_DIR/requirements.txt"
# This starts only our helper. It never starts/replaces Ollama or stops another process.
exec "$HELPER_DIR/.venv/bin/python" "$HELPER_DIR/server.py" --extension-origin "chrome-extension://$1" --port "$HELPER_PORT" --reasoning-model "${KUBLA_REASONING_MODEL:-}"
