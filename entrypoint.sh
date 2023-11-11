#!/bin/bash

# sharkd daemon fails to start if the socket already exists
[ -f "$SHARKD_SOCKET" ] && rm "$SHARKD_SOCKET"

exec npm start
