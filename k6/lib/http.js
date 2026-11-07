// HTTP helpers that apply the framework's conventions to every request:
//  - `name` and `endpoint` tags (Grafana panels and SLO thresholds rely on them)
//  - `X-Trace-ID` and `X-Test-Run` headers, so server logs can be correlated
//  - checks tagged with the endpoint, so they count towards that endpoint's SLO
//  - failed requests traced to InfluxDB (when INFLUXDB_HOST is set)

import http from 'k6/http';
import { check } from 'k6';
import { TARGET_HOST, TEST_RUN_ID } from './env.js';
import { generateTraceId, emitFailedTrace, traceFromResponse } from './tracing.js';

// Sends one request to TARGET_HOST + path.
//   endpoint  short tag used for SLO gates, e.g. 'items' (required)
//   name      Grafana grouping name; defaults to "METHOD /path". Set it for
//             paths with IDs or query strings, e.g. 'GET /api/items/:id'.
// Returns { res, traceId, url, method }.
export function tracedRequest(method, path, { endpoint, name, body = null, params = {} } = {}) {
  if (!endpoint) throw new Error(`tracedRequest(${method} ${path}): "endpoint" tag is required.`);
  const upperMethod = method.toUpperCase();
  const traceId = generateTraceId();
  const url = `${TARGET_HOST}${path}`;
  const res = http.request(upperMethod, url, body, {
    ...params,
    headers: { 'X-Test-Run': TEST_RUN_ID, 'X-Trace-ID': traceId, ...(params.headers || {}) },
    tags: { name: name || `${upperMethod} ${path}`, endpoint, ...(params.tags || {}) },
  });
  return { res, traceId, url, method: upperMethod };
}

// Runs named checks against a response, tagged with the endpoint. Returns true if all passed.
export function checkEndpoint(res, endpoint, checks) {
  return check(res, checks, { endpoint });
}

// Parses a JSON body, or returns null when the body is not valid JSON.
export function parseJson(res) {
  try {
    return res.json();
  } catch (e) {
    return null;
  }
}

// Default failure category from the HTTP status.
export function categorize(status) {
  if (status === 0) return 'NetworkError';
  return status >= 500 ? 'ServerError' : 'ClientError';
}

// Records a failed request in the `failed_requests_trace` measurement.
export function reportFailure(request, { endpointPath, category, error } = {}) {
  const { res, traceId, url, method } = request;
  emitFailedTrace(
    traceFromResponse(res, {
      testRunId: TEST_RUN_ID,
      traceId,
      endpoint: endpointPath || url.replace(TARGET_HOST, '').split('?')[0],
      url,
      method,
      category: category || categorize(res.status),
      error: error || (res.body ? String(res.body).substring(0, 100) : 'HTTP Error'),
    }),
  );
}
