// Scenario library: one load profile per test type.
// Select a profile with `-e LOAD_PROFILE=<name>` (default: smoke).
//
// Arrival-rate executors (stress, spike, breakpoint) drive a fixed number of
// iterations per second, independent of response time. VU-based executors
// (smoke, load, soak) model a fixed number of concurrent users.
//
// Passing `--vus` and `--duration` on the command line overrides the profile
// (k6 behaviour), which keeps ad-hoc runs from run-k6.sh and Jenkins working.

export const SCENARIOS = {
  // Minimal load. Verifies that the script and the target work at all.
  smoke: {
    executor: 'shared-iterations',
    vus: 1,
    iterations: 5,
    maxDuration: '1m',
  },

  // Typical expected traffic: ramp up, hold, ramp down.
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },
      { duration: '3m', target: 10 },
      { duration: '1m', target: 0 },
    ],
    gracefulRampDown: '30s',
  },

  // Above-normal traffic in steps, to find degradation before failure.
  stress: {
    executor: 'ramping-arrival-rate',
    startRate: 5,
    timeUnit: '1s',
    preAllocatedVUs: 20,
    maxVUs: 100,
    stages: [
      { duration: '2m', target: 20 },
      { duration: '3m', target: 20 },
      { duration: '2m', target: 40 },
      { duration: '3m', target: 40 },
      { duration: '2m', target: 0 },
    ],
  },

  // Sudden burst of traffic, then recovery.
  spike: {
    executor: 'ramping-arrival-rate',
    startRate: 2,
    timeUnit: '1s',
    preAllocatedVUs: 20,
    maxVUs: 200,
    stages: [
      { duration: '30s', target: 2 },
      { duration: '10s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '10s', target: 2 },
      { duration: '1m', target: 2 },
    ],
  },

  // Normal load held for a long time, to expose leaks and slow degradation.
  soak: {
    executor: 'constant-vus',
    vus: 10,
    duration: '1h',
  },

  // Keeps increasing load until a threshold aborts the test (see thresholds.js).
  // The request rate at the moment of abort is the breaking point.
  breakpoint: {
    executor: 'ramping-arrival-rate',
    startRate: 5,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 500,
    stages: [{ duration: '20m', target: 500 }],
  },
};

export const LOAD_PROFILES = Object.keys(SCENARIOS);
