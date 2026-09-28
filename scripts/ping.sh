#!/usr/bin/env bash
# Pings the deployed backend every 10s and logs status/latency.
# Useful for: confirming the Render free-tier instance is awake,
# watching it recover from a cold start, and catching intermittent outages.
#
# Usage: ./scripts/ping.sh [url] [interval_seconds]

URL="${1:-https://agrochain-app-8qre.onrender.com/auth/login}"
INTERVAL="${2:-10}"

echo "Pinging $URL every ${INTERVAL}s (Ctrl+C to stop)"
echo

while true; do
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  result=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" --max-time 30 \
    -X POST "$URL" -H "Content-Type: application/json" -d '{"email":"ping@example.com","password":"ping"}')
  status="${result%% *}"
  latency="${result##* }"

  if [ "$status" = "000" ]; then
    echo "[$timestamp] UNREACHABLE (no response within timeout)"
  elif [ "$status" -ge 200 ] && [ "$status" -lt 500 ]; then
    echo "[$timestamp] UP   status=$status  latency=${latency}s"
  else
    echo "[$timestamp] DOWN status=$status  latency=${latency}s"
  fi

  sleep "$INTERVAL"
done
