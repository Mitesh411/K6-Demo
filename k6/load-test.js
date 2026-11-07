// Backend API load test for the bundled sample app.
//
//   LOAD_PROFILE  smoke | load | stress | spike | soak | breakpoint (default: smoke)
//   TARGET_HOST   base URL of the system under test (default: http://sample-app:8080)
//   INFLUXDB_HOST InfluxDB for failed-request traces (empty disables tracing)
//   TEST_RUN_ID   tag used by the Grafana dashboard to compare runs
//
// Thresholds act as SLO gates: k6 exits non-zero when one is breached.

import http from 'k6/http';
import { sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { TARGET_HOST } from './lib/env.js';
import { buildOptions } from './lib/options.js';
import { tracedRequest, checkEndpoint, parseJson, reportFailure } from './lib/http.js';

// Custom metrics for enhanced visibility
const failedReqCounter = new Counter('custom_failed_requests');
const ttfbTrend = new Trend('custom_ttfb');
const errorRate = new Rate('custom_error_rate');

// Only /api/items is gated. /api/flaky fails ~60% of the time by design.
export const options = buildOptions({ defaultProfile: 'smoke', endpoints: ['items'] });

// Fail fast if the target is not the expected, healthy system.
export function setup() {
  const res = http.get(`${TARGET_HOST}/health`, { tags: { name: 'GET /health' } });
  const body = parseJson(res);
  if (res.status !== 200 || !body || body.status !== 'healthy') {
    throw new Error(
      `Target ${TARGET_HOST} is not healthy (GET /health returned ${res.status}). ` +
        'Start the sample app or set TARGET_HOST.',
    );
  }
}

export default function () {
  // Scenario 1: normal API request. This is the endpoint the SLOs gate on.
  {
    const request = tracedRequest('GET', '/api/items', { endpoint: 'items' });
    const { res, traceId } = request;
    const body = parseJson(res);

    const isSuccess = checkEndpoint(res, 'items', {
      'items status is 200': (r) => r.status === 200,
      'items body reports success': () => body !== null && body.status === 'success',
      'items list is not empty': () =>
        body !== null && Array.isArray(body.items) && body.items.length > 0,
      'items echoes the trace id': (r) => r.headers['X-Trace-Id'] === traceId,
    });

    ttfbTrend.add(res.timings.waiting);
    errorRate.add(!isSuccess);

    if (!isSuccess) {
      failedReqCounter.add(1);
      reportFailure(request);
    }
  }

  // Scenario 2: deliberately flaky endpoint, used to demo failure tracing.
  // Not gated by thresholds: it fails ~60% of the time by design.
  if (Math.random() < 0.3) {
    const request = tracedRequest('GET', '/api/flaky', { endpoint: 'flaky' });
    const { res } = request;

    const isSuccess = checkEndpoint(res, 'flaky', { 'flaky status is 200': (r) => r.status === 200 });
    errorRate.add(!isSuccess);

    if (!isSuccess) {
      failedReqCounter.add(1);
      const body = parseJson(res);
      reportFailure(request, {
        category: res.status === 500 ? 'InternalServerError' : 'ServiceUnavailable',
        error: body && body.message ? body.message : 'Flaky Service Internal Error',
      });
    }
  }

  sleep(0.5);
}
