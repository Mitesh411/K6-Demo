#!/bin/bash
set -e

# Usage:
#   LOAD_PROFILE=load ./scripts/run-k6.sh          # named profile from k6/config/scenarios.js
#   VUS=5 DURATION=20s ./scripts/run-k6.sh          # ad-hoc constant load (no LOAD_PROFILE)
#
# k6 exits non-zero when an SLO threshold is breached, which fails this script.

TEST_RUN_ID="${TEST_RUN_ID:-run_$(date +%s)}"
LOAD_PROFILE="${LOAD_PROFILE:-}"
VUS="${VUS:-5}"
DURATION="${DURATION:-20s}"
TARGET_HOST="${TARGET_HOST:-http://sample-app:8080}"
INFLUXDB_HOST="${INFLUXDB_HOST:-http://influxdb:8086}"

if [ -n "$LOAD_PROFILE" ]; then
  # Named profile: the scenario defines VUs and duration.
  K6_LOAD_ARGS=()
  PROFILE_FOR_K6="$LOAD_PROFILE"
  LOAD_DESCRIPTION="profile '$LOAD_PROFILE'"
else
  # Ad-hoc run: --vus/--duration override the scenario; smoke thresholds still apply.
  K6_LOAD_ARGS=(--vus "$VUS" --duration "$DURATION")
  PROFILE_FOR_K6="smoke"
  LOAD_DESCRIPTION="$VUS VUs for $DURATION"
fi

echo "=========================================="
echo "Starting k6 Backend Performance Test"
echo "Run ID:      $TEST_RUN_ID"
echo "Load:        $LOAD_DESCRIPTION"
echo "Target Host: $TARGET_HOST"
echo "InfluxDB:    $INFLUXDB_HOST"
echo "=========================================="

docker compose run --rm \
  -e TEST_RUN_ID="$TEST_RUN_ID" \
  -e LOAD_PROFILE="$PROFILE_FOR_K6" \
  -e TARGET_HOST="$TARGET_HOST" \
  -e INFLUXDB_HOST="$INFLUXDB_HOST" \
  -e K6_OUT="influxdb=$INFLUXDB_HOST/k6" \
  k6 run "${K6_LOAD_ARGS[@]}" /scripts/k6/load-test.js

echo "k6 load test run '$TEST_RUN_ID' finished successfully."
