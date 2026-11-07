// Smoke test for GET /api/flaky: every response is either a 200 success or a
// well-formed JSON error with a message, and no more than 75% of requests fail.
// Generated with /new-k6-test from: "a smoke test for /api/flaky that accepts its
// designed failures: every response is either 200 or a JSON error with a message,
// and no more than 75% of requests fail".
//
// /api/flaky fails ~60% of the time by design, so this test gates the error
// *contract* (shape of failures) and a ceiling on the failure rate, not < 1% errors.
//
// Default profile: smoke (override with -e LOAD_PROFILE=<name>).
// Run:  k6 run -e TARGET_HOST=http://localhost:8080 k6/tests/flaky-error-contract-smoke.js

import http from 'k6/http';
import { sleep } from 'k6';
import { TARGET_HOST } from '../lib/env.js';
import { buildOptions } from '../lib/options.js';
import { tracedRequest, checkEndpoint, parseJson, reportFailure } from '../lib/http.js';

export const options = buildOptions({
  defaultProfile: 'smoke',
  endpoints: ['flaky'],
  // 100 samples, so a 60% failure rate does not randomly exceed the 75% ceiling
  // (with 5 samples, that would happen about a third of the time).
  scenario: {
    vus: 5,
    iterations: 100,
  },
  // Replaces the smoke default (< 1% errors, abort on fail), which this endpoint fails by design.
  thresholds: {
    'http_req_failed{endpoint:flaky}': ['rate<0.75'],
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
  const request = tracedRequest('GET', '/api/flaky', { endpoint: 'flaky' });
  const { res } = request;
  const body = parseJson(res);

  checkEndpoint(res, 'flaky', {
    'flaky returns 200 or a known error status': (r) => [200, 500, 502, 503].includes(r.status),
    'flaky body is JSON': () => body !== null,
    'flaky success has status "success"': (r) =>
      r.status !== 200 || (body !== null && body.status === 'success'),
    'flaky error has error flag and message': (r) =>
      r.status === 200 ||
      (body !== null && body.error === true && typeof body.message === 'string' && body.message !== ''),
  });

  // Designed failures still go to Grafana's failure-trace panels.
  if (res.status !== 200) {
    reportFailure(request, { error: body && body.message ? body.message : undefined });
  }

  sleep(0.2);
}
