#!/bin/bash

# sharkd daemon fails to start if the socket already exists
rm "$SHARKD_SOCKET"

exec npm start
