#!/bin/bash
set -e

# Default parameters
TEST_RUN_ID="${TEST_RUN_ID:-run_$(date +%s)}"
VUS="${VUS:-5}"
DURATION="${DURATION:-20s}"
TARGET_HOST="${TARGET_HOST:-http://sample-app:8080}"
INFLUXDB_HOST="${INFLUXDB_HOST:-http://influxdb:8086}"

echo "=========================================="
echo "Starting k6 Backend Performance Test"
echo "Run ID:      $TEST_RUN_ID"
echo "VUs:         $VUS"
echo "Duration:    $DURATION"
echo "Target Host: $TARGET_HOST"
echo "InfluxDB:    $INFLUXDB_HOST"
echo "=========================================="

docker compose run --rm \
  -e TEST_RUN_ID="$TEST_RUN_ID" \
  -e TARGET_HOST="$TARGET_HOST" \
  -e INFLUXDB_HOST="$INFLUXDB_HOST" \
  -e K6_OUT="influxdb=$INFLUXDB_HOST/k6" \
  k6 run --vus "$VUS" --duration "$DURATION" /scripts/k6/load-test.js

echo "k6 load test run '$TEST_RUN_ID' finished successfully."
