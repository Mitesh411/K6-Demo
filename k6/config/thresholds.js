// Threshold-based SLO gates. k6 exits with a non-zero code (99) when any
// threshold is breached, which fails the CI job.
//
// Gates are scoped to the `endpoint:items` tag on purpose:
//  - `/api/flaky` fails ~60% of the time by design (it exists to demo failure
//    tracing), so it must not count against the SLO.
//  - Trace writes to InfluxDB are telemetry, not the system under test.

const NORMAL = {
  'http_req_failed{endpoint:items}': ['rate<0.01'],
  'http_req_duration{endpoint:items}': ['p(95)<300', 'p(99)<500'],
  'checks{endpoint:items}': ['rate>0.99'],
};

// Heavier profiles intentionally push the system, so they allow more latency.
const UNDER_PRESSURE = {
  'http_req_failed{endpoint:items}': ['rate<0.05'],
  'http_req_duration{endpoint:items}': ['p(95)<1000', 'p(99)<2000'],
  'checks{endpoint:items}': ['rate>0.95'],
};

export const THRESHOLDS = {
  smoke: {
    ...NORMAL,
    // Stop at once if the target is broken. There is no point continuing.
    'http_req_failed{endpoint:items}': [{ threshold: 'rate<0.01', abortOnFail: true }],
  },
  load: NORMAL,
  soak: NORMAL,
  stress: UNDER_PRESSURE,
  spike: UNDER_PRESSURE,
  breakpoint: {
    'http_req_failed{endpoint:items}': [
      { threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '30s' },
    ],
    'http_req_duration{endpoint:items}': [
      { threshold: 'p(95)<2000', abortOnFail: true, delayAbortEval: '30s' },
    ],
  },
};
