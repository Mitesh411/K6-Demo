# Local Performance Testing Framework

A centralized, containerized performance testing framework for local and CI/CD environments. It covers three kinds of test:

- **Backend API load tests** with **k6**, using a library of load profiles and SLO thresholds that pass or fail the run.
- **Frontend performance tests** with the **k6 browser** module (Core Web Vitals gates).
- **Frontend audits** with **sitespeed.io**.

Metrics and request traces are aggregated in real time in **Grafana** via **InfluxDB**. Runs are automated through **Jenkins** or **GitHub Actions**.

---

## Architecture Overview

```
                      +-------------------+
                      |      Jenkins      |
                      |  (CI Automation)  |
                      +---------+---------+
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
     +---------------+                     +----------------+
     |   k6 Runner   |                     | sitespeed.io   |
     | (Backend API) |                     | (Frontend Web) |
     +-------+-------+                     +-------+--------+
             |                                     |
             |  Metrics & Traces                   |  Web Vitals
             +------------------+------------------+
                                |
                                v
                      +-------------------+
                      |     InfluxDB      |
                      |   (k6/sitespeed)  |
                      +---------+---------+
                                |
                                v
                      +-------------------+
                      |      Grafana      |
                      | Unified Dashboard |
                      +-------------------+
```

### Services Included in Docker Compose

*   **Grafana** (`http://localhost:3000`): Pre-provisioned dashboards and InfluxDB datasources. Anonymous viewer access is enabled by default; the admin credentials are `admin`/`admin`.
*   **InfluxDB 1.8** (`http://localhost:8086`): Time-series database storing k6 metrics, custom traces and sitespeed.io performance metrics.
*   **Jenkins** (`http://localhost:8081`): CI/CD orchestration server running the pipeline defined in `Jenkinsfile`.
*   **Sample App** (`http://localhost:8080`): The system under test. It serves a frontend web page, a fast API endpoint (`/api/items`), a deliberately flaky endpoint (`/api/flaky`, about 60% failures) for error tracking demos, and `/health`.
*   **k6 Runner** (`k6`, k6 2.3.0): Runs API load tests and streams metrics and failed-request traces to InfluxDB.
*   **k6 Browser Runner** (`k6-browser`, k6 2.3.0 with Chromium): Runs the browser Web Vitals test.
*   **sitespeed.io Runner**: Measures Core Web Vitals (TTFB, FCP, LCP, CLS, Speed Index) and streams them to InfluxDB.

---

## Project Structure

```
k6/
  load-test.js         Backend API load test (SLO-gated)
  browser-test.js      Frontend Web Vitals test (k6 browser)
  config/
    scenarios.js       Load profile library (smoke, load, stress, spike, soak, breakpoint)
    thresholds.js      SLO thresholds per load profile
  lib/
    env.js             Run-time settings (TARGET_HOST, LOAD_PROFILE, ...)
    tracing.js         Failed-request traces written to InfluxDB
sample-app/            System under test (Node.js)
scripts/               Helper scripts for Docker Compose runs
grafana/, influxdb/    Dashboard and database provisioning
.github/workflows/     GitHub Actions pipeline (manual trigger)
Jenkinsfile            Jenkins pipeline
```

---

## Quick Start

### 1. Start Core Services

Start Grafana, InfluxDB, Jenkins and the sample application in the background:

```bash
docker compose up -d influxdb grafana sample-app jenkins
```

Verify service status:
```bash
docker compose ps
```

*   **Grafana**: [http://localhost:3000](http://localhost:3000)
*   **InfluxDB**: [http://localhost:8086](http://localhost:8086)
*   **Jenkins**: [http://localhost:8081](http://localhost:8081)
*   **Sample App**: [http://localhost:8080](http://localhost:8080)

---

## Running Performance Tests

### Settings

All k6 tests read these settings from `-e NAME=value` or environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `LOAD_PROFILE` | `smoke` | Load profile from `k6/config/scenarios.js` |
| `TARGET_HOST` | `http://sample-app:8080` | Base URL of the system under test. Use `http://localhost:8080` outside Docker Compose. |
| `INFLUXDB_HOST` | *(empty)* | InfluxDB for failed-request traces. Empty disables trace writes. |
| `TEST_RUN_ID` | `run_<timestamp>` | Tag used by Grafana to compare runs |

### Load profiles

| Profile | Executor | Shape | Duration | Use it to |
|---|---|---|---|---|
| `smoke` | shared-iterations | 1 VU, 5 iterations | under 1 min | Check that the script and the system work at all |
| `load` | ramping-vus | ramp to 10 VUs, hold, ramp down | ~5 min | Measure behaviour under typical traffic |
| `stress` | ramping-arrival-rate | 20 then 40 requests/s | ~12 min | Find degradation above normal traffic |
| `spike` | ramping-arrival-rate | 2 to 100 requests/s burst, then recovery | ~3 min | Check behaviour during and after a sudden burst |
| `soak` | constant-vus | 10 VUs | 1 h | Expose leaks and slow degradation |
| `breakpoint` | ramping-arrival-rate | ramp to 500 requests/s | up to 20 min | Find the breaking point (the run aborts when the SLO breaks) |

### SLO thresholds

Thresholds are defined per profile in `k6/config/thresholds.js`. **k6 exits with a non-zero code when any threshold is breached**, which fails the CI job.

| Profile | `/api/items` error rate | `/api/items` latency | Checks passing |
|---|---|---|---|
| smoke, load, soak | < 1% (smoke aborts at once on breach) | p95 < 300 ms, p99 < 500 ms | > 99% |
| stress, spike | < 5% | p95 < 1000 ms, p99 < 2000 ms | > 95% |
| breakpoint | aborts at ≥ 10% | aborts at p95 ≥ 2000 ms | n/a |

Gates apply only to `/api/items`. `/api/flaky` fails by design and is used to demo failure tracing, so it is reported but never gated.

### 1. Backend API Load Testing (k6)

Run a named load profile:

```bash
LOAD_PROFILE=smoke ./scripts/run-k6.sh
TEST_RUN_ID="load_v1" LOAD_PROFILE=load ./scripts/run-k6.sh
```

Run an ad-hoc constant load. When `LOAD_PROFILE` is not set, `VUS` and `DURATION` are used and the smoke thresholds still apply:

```bash
# Baseline run
TEST_RUN_ID="baseline_v1" VUS=5 DURATION=20s ./scripts/run-k6.sh

# Higher-load run (to compare against baseline)
TEST_RUN_ID="stress_v2" VUS=15 DURATION=20s ./scripts/run-k6.sh
```

Or run via Docker Compose directly:
```bash
docker compose run --rm \
  -e TEST_RUN_ID="custom_run_1" \
  -e LOAD_PROFILE="spike" \
  k6 run /scripts/k6/load-test.js
```

### 2. Frontend Performance Testing (k6 browser)

`k6/browser-test.js` loads the sample app's page in headless Chromium. It checks that the page renders the items fetched from the API, and gates on Core Web Vitals (75th percentile, Google's "good" targets):

| Metric | Threshold |
|---|---|
| Largest Contentful Paint (LCP) | < 2.5 s |
| First Contentful Paint (FCP) | < 1.8 s |
| Cumulative Layout Shift (CLS) | < 0.1 |
| Time to First Byte (TTFB) | < 800 ms |

```bash
docker compose run --rm k6-browser run /scripts/k6/browser-test.js
```

The test saves a screenshot to `reports/browser-test.png`.

### 3. Frontend Web Performance Audits (sitespeed.io)

Run sitespeed.io against your frontend:

```bash
./scripts/run-sitespeed.sh http://sample-app:8080/
```

This runs headless Chrome audits and exports Google Web Vitals (TTFB, First Paint, DOMContentLoaded, Speed Index, Coach Score) to InfluxDB.

### 4. Running without Docker

You need [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) (v2.3.0) and Node.js. The browser test also needs Chrome or Chromium installed.

```bash
node sample-app/app.js &                                         # start the system under test
k6 run -e TARGET_HOST=http://localhost:8080 k6/load-test.js      # smoke profile
k6 run -e TARGET_HOST=http://localhost:8080 -e LOAD_PROFILE=load k6/load-test.js
k6 run -e TARGET_HOST=http://localhost:8080 k6/browser-test.js   # Web Vitals
```

To save an HTML report, add `K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=reports/report.html`. For runs shorter than about a minute, also add `K6_WEB_DASHBOARD_PERIOD=1s`; otherwise k6 skips the report.

### 5. Verify Entire Stack & Ingested Data

To run automated end-to-end verification across all containers, databases and metrics:

```bash
./scripts/verify-all.sh
```

---

## Grafana Dashboard: Features & Walkthrough

Open the pre-provisioned **Unified Performance & Load Testing Dashboard** at:
**`http://localhost:3000/d/unified-perf-dashboard/unified-performance-load-testing-dashboard`**

### 1. Real-Time Metrics
*   **Throughput / RPS by Endpoint**: Real-time request rate grouped by HTTP route.
*   **Latency Percentiles (p90, p95, p99)**: Millisecond latency distribution over time.
*   **Error Rate (% Failed Requests)**: Live tracking of failing requests.
*   **Frontend Core Web Vitals**: TTFB, First Paint, DOMContentLoaded and Speed Index from sitespeed.io.

### 2. Test Run Comparison
The dashboard includes **Test Run Comparison** panels:
*   **Backend Test Run Comparison Table**: Compares total requests, average latency, p95 latency, p99 latency and failed request counts across test runs (`test_run_id`).
*   **Side-by-Side Run Latency Comparison**: Dropdown filters (`Compare Run 1` and `Compare Run 2`) plot two specific runs on the same chart, to evaluate improvements or regressions.

### 3. Detailed Request Failure Tracing & Debugging
When requests fail during backend tests (for example, from `/api/flaky`), the dashboard shows:
*   **Detailed Failed Request Traces**: A table of each failed request's unique `trace_id`, timestamp, URL, HTTP method, HTTP status code (such as 500, 502 or 503), error message and total duration.
*   **Latency Breakdown**: Connection handshake, Time-To-First-Byte (`ttfb`) and data transfer time for failed requests.
*   **Failure Distribution by Error Category**: A donut chart classifying failure types (such as `InternalServerError` and `ServiceUnavailable`).

Traces are written only when `INFLUXDB_HOST` is set. `run-k6.sh`, Jenkins and the Compose `k6` service set it for you.

---

## CI/CD Automation

### GitHub Actions (manual trigger)

`.github/workflows/basic.yml` runs only when started manually: **Actions → Basic Workflow → Run workflow**.

| Input | Default | Description |
|---|---|---|
| `load_profile` | `smoke` | Load profile for the API test |
| `target_host` | *(empty)* | Target URL. When empty, the workflow starts the bundled sample app and tests it. |
| `run_browser_test` | `true` | Also run the browser Web Vitals test |

The job fails when an SLO threshold is breached. HTML reports (and the browser screenshot) are uploaded as artifacts even when a run fails.

### Jenkins

The included `Jenkinsfile` provides a parameterized pipeline:

1.  Open Jenkins at `http://localhost:8081`.
2.  Create a **Pipeline** job pointing to this repository.
3.  Trigger **Build with Parameters**:
    *   `TEST_TYPE`: Choose `all`, `backend_k6` or `frontend_sitespeed`.
    *   `LOAD_PROFILE`: Choose a k6 load profile, or `custom` to use `K6_VUS` and `K6_DURATION`.
    *   `TEST_RUN_ID`: An identifier for run comparison. Leave blank for timestamp-based tagging.
    *   `TARGET_API_URL`: Backend endpoint (default: `http://sample-app:8080`).
    *   `TARGET_WEB_URL`: Frontend URL (default: `http://sample-app:8080/`).
    *   `K6_VUS`: Concurrent virtual users (`custom` only).
    *   `K6_DURATION`: Test duration, such as `30s` or `1m` (`custom` only).

The k6 stage fails when an SLO threshold is breached.

---

## Stopping the Framework

To stop all running services and clean up containers:

```bash
docker compose down
```

To remove all data volumes (resets InfluxDB, Grafana and Jenkins):

```bash
docker compose down -v
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

HTML reports generated by k6's web dashboard embed Grafana Labs assets licensed under AGPL-3.0. They are build artifacts and are not committed to this repository.
