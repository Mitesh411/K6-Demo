// Failed-request tracing: writes one InfluxDB line per failed request to the
// `failed_requests_trace` measurement used by the Grafana dashboard.

import http from 'k6/http';
import { INFLUXDB_HOST } from './env.js';

export function generateTraceId() {
  return `trace-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
}

function escapeInfluxTag(val) {
  if (val === undefined || val === null) return 'unknown';
  return String(val).replace(/[, =]/g, '\\$&');
}

function escapeInfluxField(val) {
  if (val === undefined || val === null) return '""';
  return `"${String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function numberOrZero(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

export function emitFailedTrace(trace) {
  if (!INFLUXDB_HOST) return; // tracing disabled

  const line =
    `failed_requests_trace,test_run_id=${escapeInfluxTag(trace.test_run_id)},` +
    `endpoint=${escapeInfluxTag(trace.endpoint)},status=${numberOrZero(trace.status)},` +
    `error_category=${escapeInfluxTag(trace.error_category)} ` +
    `trace_id=${escapeInfluxField(trace.trace_id)},` +
    `url=${escapeInfluxField(trace.url)},` +
    `method=${escapeInfluxField(trace.method)},` +
    `error=${escapeInfluxField(trace.error)},` +
    `duration_ms=${numberOrZero(trace.duration_ms)},` +
    `ttfb_ms=${numberOrZero(trace.ttfb_ms)},` +
    `connecting_ms=${numberOrZero(trace.connecting_ms)},` +
    `receiving_ms=${numberOrZero(trace.receiving_ms)}`;

  try {
    http.post(`${INFLUXDB_HOST}/write?db=k6`, line, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: '2s',
      tags: { name: 'influxdb trace write', purpose: 'telemetry' },
    });
  } catch (e) {
    // Telemetry must never interrupt the test.
  }
}

// Builds a trace record from a k6 response.
export function traceFromResponse(res, { testRunId, traceId, endpoint, url, method, category, error }) {
  return {
    test_run_id: testRunId,
    trace_id: traceId,
    endpoint,
    url,
    method,
    status: res.status,
    error_category: category,
    error,
    duration_ms: res.timings.duration,
    ttfb_ms: res.timings.waiting,
    connecting_ms: res.timings.connecting,
    receiving_ms: res.timings.receiving,
  };
}
