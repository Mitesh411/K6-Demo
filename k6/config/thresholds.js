// Threshold-based SLO gates. k6 exits with a non-zero code (99) when any
// threshold is breached, which fails the CI job.
//
// Gates are scoped to an `endpoint` tag (set by lib/http.js) on purpose:
//  - only the endpoints a test names are gated, so deliberately failing
//    endpoints (such as /api/flaky) and InfluxDB telemetry writes never count;
//  - one test can gate several endpoints independently.

// SLO templates. Each returns thresholds for one endpoint tag value.
function normal(endpoint) {
  return {
    [`http_req_failed{endpoint:${endpoint}}`]: ['rate<0.01'],
    [`http_req_duration{endpoint:${endpoint}}`]: ['p(95)<300', 'p(99)<500'],
    [`checks{endpoint:${endpoint}}`]: ['rate>0.99'],
  };
}

// Heavier profiles intentionally push the system, so they allow more latency.
function underPressure(endpoint) {
  return {
    [`http_req_failed{endpoint:${endpoint}}`]: ['rate<0.05'],
    [`http_req_duration{endpoint:${endpoint}}`]: ['p(95)<1000', 'p(99)<2000'],
    [`checks{endpoint:${endpoint}}`]: ['rate>0.95'],
  };
}

// Stop at once if the target is broken. There is no point continuing.
function smoke(endpoint) {
  return {
    ...normal(endpoint),
    [`http_req_failed{endpoint:${endpoint}}`]: [{ threshold: 'rate<0.01', abortOnFail: true }],
  };
}

// Abort as soon as the system breaks; the request rate at that moment is the breaking point.
function breakpoint(endpoint) {
  return {
    [`http_req_failed{endpoint:${endpoint}}`]: [
      { threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '30s' },
    ],
    [`http_req_duration{endpoint:${endpoint}}`]: [
      { threshold: 'p(95)<2000', abortOnFail: true, delayAbortEval: '30s' },
    ],
  };
}

const SLO_BY_PROFILE = {
  smoke,
  load: normal,
  soak: normal,
  stress: underPressure,
  spike: underPressure,
  breakpoint,
};

// Default SLO thresholds for a load profile, for each gated endpoint tag.
export function thresholdsFor(profile, endpoints) {
  const build = SLO_BY_PROFILE[profile];
  if (!build) throw new Error(`No SLO defined for load profile "${profile}".`);
  return Object.assign({}, ...endpoints.map((endpoint) => build(endpoint)));
}
