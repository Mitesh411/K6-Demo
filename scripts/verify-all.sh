#!/bin/bash

echo "1. Checking container health and ports..."
curl -sf http://localhost:8080/health > /dev/null || { echo "sample-app failed"; return 1 2>/dev/null || exit 1; }
curl -sf http://localhost:8086/ping > /dev/null || { echo "influxdb failed"; return 1 2>/dev/null || exit 1; }
curl -sf -u admin:admin http://localhost:3000/api/health > /dev/null || { echo "grafana failed"; return 1 2>/dev/null || exit 1; }
curl -sf http://localhost:8081/login > /dev/null || { echo "jenkins failed"; return 1 2>/dev/null || exit 1; }
echo "   All service healthchecks passed!"

echo "2. Verifying Grafana datasources..."
curl -sf -u admin:admin http://localhost:3000/api/datasources | grep -q "InfluxDB-k6"
curl -sf -u admin:admin http://localhost:3000/api/datasources | grep -q "InfluxDB-sitespeed"
echo "   Grafana datasources verified!"

echo "3. Verifying InfluxDB test data..."
K6_COUNT=$(curl -s "http://localhost:8086/query?db=k6&q=SELECT+count(value)+FROM+http_reqs" | grep -o '[0-9]\+' | tail -n 1)
TRACE_COUNT=$(curl -s "http://localhost:8086/query?db=k6&q=SELECT+count(duration_ms)+FROM+failed_requests_trace" | grep -o '[0-9]\+' | tail -n 1)
SITESPEED_COUNT=$(curl -s "http://localhost:8086/query?db=sitespeed&q=SELECT+count(median)+FROM+ttfb" | grep -o '[0-9]\+' | tail -n 1)

echo "   k6 total requests: $K6_COUNT"
echo "   k6 failed request traces: $TRACE_COUNT"
echo "   sitespeed metrics count: $SITESPEED_COUNT"

if [ "$K6_COUNT" -gt 0 ] && [ "$TRACE_COUNT" -gt 0 ] && [ "$SITESPEED_COUNT" -gt 0 ]; then
  echo "All end-to-end framework verification checks passed successfully!"
else
  echo "Verification metrics count mismatch!"
fi
