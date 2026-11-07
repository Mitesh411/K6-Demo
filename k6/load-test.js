// Backend API load test for the bundled sample app.
//
//   LOAD_PROFILE  smoke | load | stress | spike | soak | breakpoint (default: smoke)
//   TARGET_HOST   base URL of the system under test (default: http://sample-app:8080)
//   INFLUXDB_HOST InfluxDB for failed-request traces (empty disables tracing)
//   TEST_RUN_ID   tag used by the Grafana dashboard to compare runs
//
// Thresholds act as SLO gates: k6 exits non-zero when one is breached.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { SCENARIOS } from './config/scenarios.js';
import { THRESHOLDS } from './config/thresholds.js';
import { TARGET_HOST, TEST_RUN_ID, LOAD_PROFILE, assertValidProfile } from './lib/env.js';
import { generateTraceId, emitFailedTrace, traceFromResponse } from './lib/tracing.js';

assertValidProfile();

// Custom metrics for enhanced visibility
const failedReqCounter = new Counter('custom_failed_requests');
const ttfbTrend = new Trend('custom_ttfb');
const errorRate = new Rate('custom_error_rate');

export const options = {
  scenarios: { [LOAD_PROFILE]: SCENARIOS[LOAD_PROFILE] },
  thresholds: THRESHOLDS[LOAD_PROFILE],
  tags: {
    test_run_id: TEST_RUN_ID,
    load_profile: LOAD_PROFILE,
  },
};

// Fail fast if the target is not the expected, healthy system.
export function setup() {
  const res = http.get(`${TARGET_HOST}/health`, { tags: { name: 'GET /health' } });
  let healthy = false;
  try {
    healthy = res.status === 200 && res.json('status') === 'healthy';
  } catch (e) {
    healthy = false;
  }
  if (!healthy) {
    throw new Error(
      `Target ${TARGET_HOST} is not healthy (GET /health returned ${res.status}). ` +
        'Start the sample app or set TARGET_HOST.',
    );
  }
}

function parseJson(res) {
  try {
    return res.json();
  } catch (e) {
    return null;
  }
}

export default function () {
  const headers = { 'X-Test-Run': TEST_RUN_ID };

  // Scenario 1: normal API request. This is the endpoint the SLOs gate on.
  {
    const traceId = generateTraceId();
    const url = `${TARGET_HOST}/api/items`;
    const res = http.get(url, {
      headers: { ...headers, 'X-Trace-ID': traceId },
      tags: { name: 'GET /api/items', endpoint: 'items' },
    });
    const body = parseJson(res);

    const isSuccess = check(
      res,
      {
        'items status is 200': (r) => r.status === 200,
        'items body reports success': () => body !== null && body.status === 'success',
        'items list is not empty': () =>
          body !== null && Array.isArray(body.items) && body.items.length > 0,
        'items echoes the trace id': (r) => r.headers['X-Trace-Id'] === traceId,
      },
      { endpoint: 'items' },
    );

    ttfbTrend.add(res.timings.waiting);
    errorRate.add(!isSuccess);

    if (!isSuccess) {
      failedReqCounter.add(1);
      emitFailedTrace(
        traceFromResponse(res, {
          testRunId: TEST_RUN_ID,
          traceId,
          endpoint: '/api/items',
          url,
          method: 'GET',
          category: res.status >= 500 ? 'ServerError' : 'ClientError',
          error: res.body ? String(res.body).substring(0, 100) : 'HTTP Error',
        }),
      );
    }
  }

  // Scenario 2: deliberately flaky endpoint, used to demo failure tracing.
  // Not gated by thresholds: it fails ~60% of the time by design.
  if (Math.random() < 0.3) {
    const traceId = generateTraceId();
    const url = `${TARGET_HOST}/api/flaky`;
    const res = http.get(url, {
      headers: { ...headers, 'X-Trace-ID': traceId },
      tags: { name: 'GET /api/flaky', endpoint: 'flaky' },
    });

    const isSuccess = check(res, { 'flaky status is 200': (r) => r.status === 200 }, { endpoint: 'flaky' });
    errorRate.add(!isSuccess);

    if (!isSuccess) {
      failedReqCounter.add(1);
      const body = parseJson(res);
      emitFailedTrace(
        traceFromResponse(res, {
          testRunId: TEST_RUN_ID,
          traceId,
          endpoint: '/api/flaky',
          url,
          method: 'GET',
          category: res.status === 500 ? 'InternalServerError' : 'ServiceUnavailable',
          error: body && body.message ? body.message : 'Flaky Service Internal Error',
        }),
      );
    }
  }

  sleep(0.5);
}
