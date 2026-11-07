// __ONE_SENTENCE_DESCRIPTION_OF_THE_REQUEST__
//
// Default profile: __PROFILE__ (override with -e LOAD_PROFILE=<name>).
// Run:  k6 run -e TARGET_HOST=http://localhost:8080 k6/tests/__FILE_NAME__.js

import http from 'k6/http';
import { sleep } from 'k6';
import { TARGET_HOST } from '../lib/env.js';
import { buildOptions } from '../lib/options.js';
import { tracedRequest, checkEndpoint, parseJson, reportFailure } from '../lib/http.js';

export const options = buildOptions({
  defaultProfile: '__PROFILE__',
  endpoints: ['__ENDPOINT_TAG__'],
  // Only what differs from k6/config/scenarios.js. Remove if the library profile fits as is.
  scenario: {
    // e.g. stages: [{ duration: '30s', target: 200 }],
  },
  // Only limits the request states. Profile defaults apply to everything else.
  thresholds: {
    // e.g. 'http_req_duration{endpoint:__ENDPOINT_TAG__}': ['p(95)<800'],
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
  const request = tracedRequest('__METHOD__', '__PATH__', { endpoint: '__ENDPOINT_TAG__' });
  const { res } = request;
  const body = parseJson(res);

  const ok = checkEndpoint(res, '__ENDPOINT_TAG__', {
    '__ENDPOINT_TAG__ status is 200': (r) => r.status === 200,
    // At least one assertion on the body or headers, e.g.:
    // '__ENDPOINT_TAG__ body reports success': () => body !== null && body.status === 'success',
  });

  if (!ok) reportFailure(request);

  // Think time for VU-based profiles. Remove or shorten for arrival-rate profiles.
  sleep(0.5);
}
