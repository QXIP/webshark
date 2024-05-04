#!/bin/bash

# sharkd daemon fails to start if the socket already exists
rm "$SHARKD_SOCKET"

dir_owner=$(stat -c "%U:%G" "${CAPTURES_PATH}")

if [ "x${dir_owner}" = "xroot:root" ]; then
    # assume CAPTURES_PATH owned by root:root is unintentional
    # (probably created by docker-compose)
    chown node: "${CAPTURES_PATH}"
fi

exec su node -c "npm start"
