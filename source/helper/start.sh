#!/bin/sh
set -eu
HELPER_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "$#" -ne 1 ]; then
    printf '%s\n' 'Usage: sh helper/start.sh EXTENSION_ID_FROM_CHROME'
    exit 2
fi
if [ ! -x "$HELPER_DIR/.venv/bin/python" ]; then
    python3 -m venv "$HELPER_DIR/.venv"
fi
# Repeat the pinned install to recover safely from a partial previous install.
"$HELPER_DIR/.venv/bin/python" -m pip install --disable-pip-version-check --no-input --index-url https://pypi.org/simple --only-binary=:all: --require-hashes -r "$HELPER_DIR/requirements.txt"
exec "$HELPER_DIR/.venv/bin/python" "$HELPER_DIR/server.py" --extension-origin "chrome-extension://$1" --port "${KUBLA_HELPER_PORT:-8765}"
