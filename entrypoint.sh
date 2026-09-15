#!/bin/bash

dir_owner=$(stat -c "%U:%G" "${CAPTURES_PATH}")

if [ "x${dir_owner}" = "xroot:root" ]; then
    chown node: "${CAPTURES_PATH}"
fi

exec su node -c "npm start"
