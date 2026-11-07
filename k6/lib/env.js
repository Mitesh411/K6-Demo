// Shared run-time settings, read from `-e NAME=value` or environment variables.
// The load profile is resolved in lib/options.js.

// Target system. Defaults to the bundled sample app on the Docker Compose network.
// Outside Compose (local runs, GitHub Actions) use http://localhost:8080.
export const TARGET_HOST = (__ENV.TARGET_HOST || 'http://sample-app:8080').replace(/\/+$/, '');

// InfluxDB for failed-request traces. Empty disables trace writes, so the test
// also runs where no InfluxDB exists (for example GitHub Actions).
export const INFLUXDB_HOST = (__ENV.INFLUXDB_HOST || '').replace(/\/+$/, '');

export const TEST_RUN_ID = __ENV.TEST_RUN_ID || `run_${Date.now()}`;
