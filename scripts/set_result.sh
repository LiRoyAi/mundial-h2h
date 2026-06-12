#!/bin/bash
# Usage: bash scripts/set_result.sh <matchId> <result>
# Example: bash scripts/set_result.sh can-bih 2:0
# Requires: ADMIN_KEY env var set

if [[ -z "$1" || -z "$2" ]]; then
  echo "Usage: $0 <matchId> <result>"
  echo "Example: $0 can-bih 2:0"
  exit 1
fi

if [[ -z "$ADMIN_KEY" ]]; then
  echo "Error: ADMIN_KEY env var not set"
  exit 1
fi

curl -X POST https://mundial.liroy.pl/api/mundial/result \
  -H "Content-Type: application/json" \
  -d "{\"matchId\":\"$1\",\"result\":\"$2\",\"adminKey\":\"$ADMIN_KEY\"}" \
  | python3 -m json.tool
