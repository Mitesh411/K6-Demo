// Spike test for GET /api/items at 200 requests/s, with p95 < 800 ms.
// Generated with /new-k6-test from: "a spike test for /api/items at 200 requests/s with p95 < 800 ms".
//
// Default profile: spike (override with -e LOAD_PROFILE=<name>).
// Run:  k6 run -e TARGET_HOST=http://localhost:8080 k6/tests/items-spike-200rps.js

import http from 'k6/http';
import { TARGET_HOST } from '../lib/env.js';
import { buildOptions } from '../lib/options.js';
import { tracedRequest, checkEndpoint, parseJson, reportFailure } from '../lib/http.js';

export const options = buildOptions({
  defaultProfile: 'spike',
  endpoints: ['items'],
  // Library spike peaks at 100 requests/s; this test peaks at 200.
  scenario: {
    startRate: 10,
    // Headroom for the steep 10 s ramp. On a laptop running k6 and the sample app
    // together, ~1-2% of iterations were still dropped with VUs to spare (load
    // generator limit). Confirm dropped_iterations is 0 on a dedicated runner.
    preAllocatedVUs: 60,
    maxVUs: 150,
    stages: [
      { duration: '30s', target: 10 }, // baseline
      { duration: '10s', target: 200 }, // spike
      { duration: '1m', target: 200 }, // hold the spike
      { duration: '10s', target: 10 }, // drop
      { duration: '1m', target: 10 }, // recovery
    ],
  },
  // p95 tightened from the spike default (1000 ms); p99 default kept.
  thresholds: {
    'http_req_duration{endpoint:items}': ['p(95)<800', 'p(99)<2000'],
  },
});

// Fail fast if the target is not the expected, healthy system.
export function setup() {
  const res = http.get(`${TARGET_HOST}/health`, { tags: { name: 'GET /health' } });
  const body = parseJson(res);
  if (res.status !== 200 || !body || body.status !== 'healthy') {
    throw new Error(`Target ${TARGET_HOST} is not healthy (GET /health returned ${res.status}).`);
  }
}

export default function () {
  const request = tracedRequest('GET', '/api/items', { endpoint: 'items' });
  const { res } = request;
  const body = parseJson(res);

  const ok = checkEndpoint(res, 'items', {
    'items status is 200': (r) => r.status === 200,
    'items body reports success': () => body !== null && body.status === 'success',
    'items list is not empty': () => body !== null && Array.isArray(body.items) && body.items.length > 0,
  });

  if (!ok) reportFailure(request);
  // No think time: the arrival-rate executor controls the request rate.
}
