#!/bin/bash

# sharkd fails to start if a stale socket path already exists.
# Use -f: path may be missing on first boot, and unix sockets are not regular files.
if [ -n "${SHARKD_SOCKET}" ]; then
  rm -f "${SHARKD_SOCKET}"
fi

dir_owner=$(stat -c "%U:%G" "${CAPTURES_PATH}")

if [ "x${dir_owner}" = "xroot:root" ]; then
    # assume CAPTURES_PATH owned by root:root is unintentional
    # (probably created by docker-compose)
    chown node: "${CAPTURES_PATH}"
fi

exec su node -c "npm start"
