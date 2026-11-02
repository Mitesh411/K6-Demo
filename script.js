import http from 'k6/http';
import { check, sleep } from 'k6';

const TEST_RUN_ID = __ENV.TEST_RUN_ID || `run_${Date.now()}`;
const TARGET_HOST = __ENV.TARGET_HOST || 'http://sample-app:8080';
const INFLUXDB_HOST = __ENV.INFLUXDB_HOST || 'http://influxdb:8086';

export const options = {
  iterations: 10,
  vus: 2,
  tags: {
    test_run_id: TEST_RUN_ID,
  },
};

function generateTraceId() {
  return 'trace-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
}

function escapeInfluxTag(val) {
  if (val === undefined || val === null) return 'unknown';
  return String(val).replace(/[, =]/g, '\\$&');
}

function escapeInfluxField(val) {
  if (val === undefined || val === null) return '""';
  return '"' + String(val).replace(/"/g, '\\"') + '"';
}

function emitFailedTrace(traceData) {
  const line = `failed_requests_trace,test_run_id=${escapeInfluxTag(traceData.test_run_id)},endpoint=${escapeInfluxTag(traceData.endpoint)},status=${traceData.status},error_category=${escapeInfluxTag(traceData.error_category)} ` +
    `trace_id=${escapeInfluxField(traceData.trace_id)},` +
    `url=${escapeInfluxField(traceData.url)},` +
    `method=${escapeInfluxField(traceData.method)},` +
    `error=${escapeInfluxField(traceData.error)},` +
    `duration_ms=${traceData.duration_ms},` +
    `ttfb_ms=${traceData.ttfb_ms},` +
    `connecting_ms=${traceData.connecting_ms},` +
    `receiving_ms=${traceData.receiving_ms}`;

  try {
    http.post(`${INFLUXDB_HOST}/write?db=k6`, line, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: '2s',
      tags: { skip_metrics: 'true' },
    });
  } catch (e) {
    // Suppress secondary telemetry errors
  }
}

export default function () {
  const traceId = generateTraceId();
  const headers = {
    'X-Trace-ID': traceId,
    'X-Test-Run': TEST_RUN_ID,
  };

  const res = http.get(`${TARGET_HOST}/api/items`, {
    headers: headers,
    tags: { name: 'GET /api/items', test_run_id: TEST_RUN_ID },
  });

  const isSuccess = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  if (!isSuccess) {
    emitFailedTrace({
      test_run_id: TEST_RUN_ID,
      trace_id: traceId,
      endpoint: '/api/items',
      url: `${TARGET_HOST}/api/items`,
      method: 'GET',
      status: res.status,
      error_category: res.status >= 500 ? 'ServerError' : 'ClientError',
      error: res.body ? res.body.substring(0, 100) : 'HTTP Error',
      duration_ms: res.timings.duration,
      ttfb_ms: res.timings.waiting,
      connecting_ms: res.timings.connecting,
      receiving_ms: res.timings.receiving,
    });
  }

  // Also exercise flaky endpoint
  const failTraceId = generateTraceId();
  const resFail = http.get(`${TARGET_HOST}/api/flaky`, {
    headers: { 'X-Trace-ID': failTraceId, 'X-Test-Run': TEST_RUN_ID },
    tags: { name: 'GET /api/flaky', test_run_id: TEST_RUN_ID },
  });

  if (resFail.status !== 200) {
    emitFailedTrace({
      test_run_id: TEST_RUN_ID,
      trace_id: failTraceId,
      endpoint: '/api/flaky',
      url: `${TARGET_HOST}/api/flaky`,
      method: 'GET',
      status: resFail.status,
      error_category: 'InternalServerError',
      error: 'Simulated failure on /api/flaky',
      duration_ms: resFail.timings.duration,
      ttfb_ms: resFail.timings.waiting,
      connecting_ms: resFail.timings.connecting,
      receiving_ms: resFail.timings.receiving,
    });
  }

  sleep(0.5);
}
