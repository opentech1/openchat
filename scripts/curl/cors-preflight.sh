#!/usr/bin/env bash
set -euo pipefail

API_URL=${1:-https://api.osschat.dev/api/electric/v1/shape?scope=chats&offset=-1}
ORIGIN=${ORIGIN:-https://osschat.dev}
REQUEST_METHOD=${REQUEST_METHOD:-GET}
REQUEST_HEADERS=${REQUEST_HEADERS:-content-type, authorization}

curl -i -X OPTIONS "$API_URL" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: $REQUEST_METHOD" \
  -H "Access-Control-Request-Headers: $REQUEST_HEADERS"
