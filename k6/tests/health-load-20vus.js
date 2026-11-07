// Load test for GET /health with 20 VUs for 2 minutes, with p99 < 100 ms.
// Generated with /new-k6-test from: "a load test for /health with 20 VUs for 2 minutes and p99 under 100 ms".
//
// Default profile: load (override with -e LOAD_PROFILE=<name>).
// Run:  k6 run -e TARGET_HOST=http://localhost:8080 k6/tests/health-load-20vus.js

import http from 'k6/http';
import { sleep } from 'k6';
import { TARGET_HOST } from '../lib/env.js';
import { buildOptions } from '../lib/options.js';
import { tracedRequest, checkEndpoint, parseJson, reportFailure } from '../lib/http.js';

export const options = buildOptions({
  defaultProfile: 'load',
  endpoints: ['health'],
  // Library load holds 10 VUs; this test holds 20 VUs for 2 minutes, with short ramps.
  scenario: {
    stages: [
      { duration: '10s', target: 20 },
      { duration: '2m', target: 20 },
      { duration: '10s', target: 0 },
    ],
  },
  // p99 tightened to 100 ms. p95 default (300 ms) is implied by p99 < 100 ms, so it is not repeated.
  thresholds: {
    'http_req_duration{endpoint:health}': ['p(99)<100'],
  },
});

// Fail fast if the target is not the expected, healthy system.
export function setup() {
  const res = http.get(`${TARGET_HOST}/health`, { tags: { name: 'GET /health (setup)' } });
  const body = parseJson(res);
  if (res.status !== 200 || !body || body.status !== 'healthy') {
    throw new Error(`Target ${TARGET_HOST} is not healthy (GET /health returned ${res.status}).`);
  }
}

export default function () {
  const request = tracedRequest('GET', '/health', { endpoint: 'health' });
  const { res } = request;
  const body = parseJson(res);

  const ok = checkEndpoint(res, 'health', {
    'health status is 200': (r) => r.status === 200,
    'health reports healthy': () => body !== null && body.status === 'healthy',
    'health reports a numeric uptime': () => body !== null && typeof body.uptime === 'number',
  });

  if (!ok) reportFailure(request);

  sleep(0.5);
}
