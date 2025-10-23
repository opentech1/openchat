#!/usr/bin/env bash
set -euo pipefail

API_URL=${1:-https://api.osschat.dev/api/electric/v1/shape?scope=chats&offset=-1}
ORIGIN=${ORIGIN:-https://osschat.dev}

curlArgs=("-i" "$API_URL" "-H" "Origin: $ORIGIN")

if [[ -n "${X_USER_ID:-}" ]]; then
  curlArgs+=("-H" "x-user-id: $X_USER_ID")
fi

if [[ -n "${AUTHORIZATION:-}" ]]; then
  curlArgs+=("-H" "Authorization: $AUTHORIZATION")
fi

if [[ -n "${COOKIE:-}" ]]; then
  curlArgs+=("-H" "Cookie: $COOKIE")
fi

curl "${curlArgs[@]}"
