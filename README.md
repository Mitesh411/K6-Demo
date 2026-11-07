# Performance Testing Framework

A containerized performance engineering framework for local and CI/CD use. It answers three questions with evidence:

- **Does the backend meet its SLOs under realistic and extreme load?** k6 API tests use a library of load profiles, and endpoint-scoped SLO thresholds pass or fail each run.
- **How fast does the frontend render for a user?** A k6 browser test gates on Core Web Vitals, and sitespeed.io runs frontend audits.
- **Did this change make things better or worse?** Every run is tagged and streamed to InfluxDB, and Grafana compares runs side by side and traces individual failed requests.

Runs are automated through **GitHub Actions** (manual trigger) or **Jenkins**, and new tests can be authored from plain-English requests with an AI-assisted workflow.

## Contents

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Testing methodology](#testing-methodology)
- [Running tests](#running-tests)
- [Analysing results](#analysing-results)
- [CI/CD](#cicd)
- [AI-assisted test authoring](#ai-assisted-test-authoring)
- [Project structure](#project-structure)
- [Known limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)

---

## Quick start

**With Docker Compose** (full stack: system under test, InfluxDB, Grafana, Jenkins):

```bash
docker compose up -d influxdb grafana sample-app jenkins
LOAD_PROFILE=smoke ./scripts/run-k6.sh
```

Then open Grafana at [http://localhost:3000](http://localhost:3000) (anonymous viewer access; admin credentials `admin`/`admin`).

**Without Docker** (requires [k6 v2.3.0](https://grafana.com/docs/k6/latest/set-up/install-k6/) and Node.js):

```bash
node sample-app/app.js &
k6 run -e TARGET_HOST=http://localhost:8080 k6/load-test.js
```

A passing run exits with code `0` and shows every threshold with a ✓.

---

## Architecture

```
  GitHub Actions (manual)        Jenkins (parameterized)
            |                            |
            +-------------+--------------+
                          |
          +---------------+----------------+-------------------+
          |                                |                   |
          v                                v                   v
  +---------------+               +----------------+   +----------------+
  |  k6 API tests |               | k6 browser     |   | sitespeed.io   |
  |  (load-test,  |               | (Web Vitals)   |   | (frontend      |
  |   k6/tests/*) |               +-------+--------+   |  audits)       |
  +-------+-------+                       |            +-------+--------+
          |  HTTP load                    |                    |
          v                               |                    |
  +---------------+                       |                    |
  |  sample-app   |<----------------------+--------------------+
  | (system under |
  |  test, :8080) |
  +---------------+
          k6 metrics + failed-request traces    sitespeed metrics
          +-------------------------+-------------------+
                                    v
                          +-------------------+        +-------------------+
                          |   InfluxDB 1.8    |------->|  Grafana 10.4     |
                          |  (k6, sitespeed)  |        | unified dashboard |
                          +-------------------+        +-------------------+
```

| Service | Address | Role |
|---|---|---|
| `sample-app` | `http://localhost:8080` | System under test: `GET /health`, `GET /api/items` (10–50 ms simulated latency), `GET /api/flaky` (fails ~60% by design, for failure-tracing demos), `GET /` (web page that calls `/api/items`) |
| `influxdb` | `http://localhost:8086` | Time-series store for k6 metrics, failed-request traces and sitespeed.io metrics |
| `grafana` | `http://localhost:3000` | Pre-provisioned dashboard and InfluxDB datasources |
| `jenkins` | `http://localhost:8081` | CI server running `Jenkinsfile` |
| `k6` (tools profile) | none | k6 2.3.0 runner, streaming to InfluxDB |
| `k6-browser` (tools profile) | none | k6 2.3.0 with Chromium, for the Web Vitals test |
| `sitespeed` (tools profile) | none | sitespeed.io 34.2.0 frontend audits |

---

## Testing methodology

### Test types

Each load profile answers a different question. Choose the profile from the question, not the other way round.

| Profile | Question it answers | Workload model | Shape (defaults) | Duration | Pass means | When to run |
|---|---|---|---|---|---|---|
| `smoke` | Do the script and the target work? | Closed: `shared-iterations` | 1 VU, 5 iterations | < 1 min | Every check passes, zero errors (aborts on the first breach) | Before any other test; after every change |
| `load` | Do SLOs hold at expected traffic? | Closed: `ramping-vus` | 0 → 10 VUs (1 min), hold 3 min, ramp down 1 min | ~5 min | Normal SLOs hold through steady state | Before a release |
| `stress` | Where does performance start to degrade above normal traffic? | Open: `ramping-arrival-rate` | 20 req/s, then 40 req/s, each held 3 min | ~12 min | Relaxed SLOs hold. The finding is where degradation begins. | Capacity planning |
| `spike` | Does the system survive a sudden burst and recover? | Open: `ramping-arrival-rate` | 2 → 100 req/s in 10 s, hold 1 min, drop, observe recovery | ~3 min | Relaxed SLOs hold, and latency returns to baseline afterwards | Before campaigns or launches |
| `soak` | Do leaks or slow drift appear over time? | Closed: `constant-vus` | 10 VUs | 1 h | SLOs hold with no upward trend in latency or errors | Before major releases; after memory-related changes |
| `breakpoint` | What is the maximum sustainable rate? | Open: `ramping-arrival-rate` | 5 → 500 req/s over 20 min | Until abort | The request rate at the moment of abort is the result | Capacity planning |

The default durations are sized for CI and demonstrations. Against production-like environments, extend steady state: tens of minutes for `load`, and several hours for `soak`.

### Workload model

- **Open model (arrival rate).** New requests arrive at a set rate, whether or not the system keeps up. This is how real internet traffic behaves, and it is the right model for "N requests per second" objectives. Used by `stress`, `spike` and `breakpoint`.
- **Closed model (virtual users).** A fixed number of users each wait for a response and think before the next request. Right for "N concurrent users" objectives. Used by `smoke`, `load` and `soak`. A closed model sends fewer requests as the system slows down, so it can understate degradation.
- **Sizing with Little's Law.** Throughput ≈ concurrency ÷ (response time + think time). For an arrival-rate test, VUs needed ≈ target rate × iteration duration. Pre-allocate about 3 times that, so k6 can keep up during steep ramps.

### SLOs and quality gates

Thresholds are k6's quality gates: **when any threshold fails, k6 exits with code `99` and the CI job fails.** The defaults come from `k6/config/thresholds.js`:

| Profiles | Error rate | Latency (`http_req_duration`) | Checks passing | On breach |
|---|---|---|---|---|
| `smoke` | < 1% | p95 < 300 ms, p99 < 500 ms | > 99% | Abort immediately |
| `load`, `soak` | < 1% | p95 < 300 ms, p99 < 500 ms | > 99% | Fail at end of run |
| `stress`, `spike` | < 5% | p95 < 1000 ms, p99 < 2000 ms | > 95% | Fail at end of run |
| `breakpoint` | abort at ≥ 10% | abort at p95 ≥ 2000 ms | n/a | Abort (expected) |

Gating policy:

- **Percentiles, not averages.** Averages hide tail latency, and the tail is what users notice.
- **Scoped to endpoints.** Each gate applies to an `endpoint` tag, such as `http_req_duration{endpoint:items}`. That keeps intentional failures (`/api/flaky`) and telemetry writes out of the SLO, and lets one test gate several endpoints independently.
- **Correctness under load.** Checks assert the response body, not just the status code. A fast wrong answer is a failure.
- **Change control.** Thresholds are not loosened to make a run pass. A change needs evidence and a recorded reason. See the lab budgets in `k6/browser-test.js` for an example.

---

## Running tests

### Settings

Every k6 test reads these settings from `-e NAME=value` or environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `LOAD_PROFILE` | The test's own default (`smoke` for `load-test.js`) | Load profile from `k6/config/scenarios.js`. Always overrides the test's default. |
| `TARGET_HOST` | `http://sample-app:8080` | Base URL of the system under test. Use `http://localhost:8080` outside Docker Compose. |
| `INFLUXDB_HOST` | *(empty)* | InfluxDB for failed-request traces. Empty disables trace writes. |
| `TEST_RUN_ID` | `run_<timestamp>` | Tag used by Grafana to compare runs. Recommended format: `<profile>_<version>_<yyyymmdd-hhmm>`. |

### Backend API tests

With the Docker Compose stack (metrics and traces go to InfluxDB and Grafana):

```bash
LOAD_PROFILE=smoke ./scripts/run-k6.sh
TEST_RUN_ID="load_v1.4.0_20261107-1400" LOAD_PROFILE=load ./scripts/run-k6.sh

# Ad-hoc constant load: VUS and DURATION are used when LOAD_PROFILE is not set (smoke SLOs apply)
TEST_RUN_ID="adhoc_baseline" VUS=5 DURATION=20s ./scripts/run-k6.sh

# Directly through Compose
docker compose run --rm -e TEST_RUN_ID="spike_v1" -e LOAD_PROFILE=spike k6 run /scripts/k6/load-test.js
```

Without Docker:

```bash
node sample-app/app.js &
k6 run -e TARGET_HOST=http://localhost:8080 -e LOAD_PROFILE=load k6/load-test.js
```

`k6/load-test.js` gates `/api/items` and also calls `/api/flaky` on about 30% of iterations, so that Grafana's failure-tracing panels have data. `/api/flaky` is reported but never gated.

### Additional tests (`k6/tests/`)

| Test | Objective | Default profile | SLO |
|---|---|---|---|
| `items-spike-200rps.js` | Does `/api/items` absorb a burst to 200 req/s? | `spike`, peaking at 200 req/s | p95 < 800 ms, p99 < 2000 ms, errors < 5% |
| `health-load-20vus.js` | Does `/health` stay fast with 20 concurrent users? | `load`, 20 VUs for 2 min | p99 < 100 ms, errors < 1% |
| `flaky-error-contract-smoke.js` | Does `/api/flaky` fail only with well-formed errors, and at its designed rate? | `smoke`, 5 VUs × 100 requests | Errors < 75%, error-contract checks > 99% |

Run any of them with `k6 run -e TARGET_HOST=http://localhost:8080 k6/tests/<file>.js`. Add `-e LOAD_PROFILE=smoke` for a quick functional check.

### Frontend performance (k6 browser)

`k6/browser-test.js` loads the page 10 times in headless Chromium. It checks that the page renders the data fetched from `/api/items`, and gates on Core Web Vitals at the 75th percentile:

| Metric | Gate (lab budget) | Google field target |
|---|---|---|
| Largest Contentful Paint (LCP) | < 3.5 s | 2.5 s |
| First Contentful Paint (FCP) | < 3.0 s | 1.8 s |
| Cumulative Layout Shift (CLS) | < 0.1 | 0.1 |
| Time to First Byte (TTFB) | < 800 ms | 800 ms |

Google's targets apply to real-user (field) data. In a lab run, headless Chromium's own paint scheduling dominates on a fast page: a page served in 4 ms measured an FCP of 1.3–2.9 s locally. So FCP and LCP use lab budgets with headroom, to be recalibrated from the first CI baseline.

```bash
docker compose run --rm k6-browser run /scripts/k6/browser-test.js     # Compose
k6 run -e TARGET_HOST=http://localhost:8080 k6/browser-test.js          # local (needs Chrome)
```

The test saves a screenshot to `reports/browser-test.png`.

### Frontend audits (sitespeed.io)

```bash
./scripts/run-sitespeed.sh http://sample-app:8080/
```

This runs headless Chrome audits and sends TTFB, First Paint, DOMContentLoaded, Speed Index and Coach Score to InfluxDB. See [Known limitations](#known-limitations) before relying on its summary values.

### HTML reports

k6's built-in web dashboard can export a self-contained HTML report:

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=reports/report.html k6 run ...
```

For runs shorter than about a minute, add `K6_WEB_DASHBOARD_PERIOD=1s`; otherwise k6 skips the report because there is too little data.

---

## Analysing results

### Key metrics

| Metric | What it tells you |
|---|---|
| `http_req_duration{endpoint:...}` | Response time (sending + waiting + receiving) per endpoint. Gate on p95 and p99. |
| `http_req_failed{endpoint:...}` | Share of responses outside 200–399. The error rate SLO. |
| `checks{endpoint:...}` | Share of correctness assertions passing. A fall here with a flat error rate means wrong answers, not failures. |
| `http_reqs` | Achieved throughput. Compare it with the intended rate. |
| `iteration_duration` | Time per iteration including think time. Use it to size VUs (Little's Law). |
| `dropped_iterations` | Iterations an arrival-rate executor could not start. Must be 0 for the load to count as applied. |
| `vus`, `vus_max` | Active and allocated VUs. Compare `vus_max` with `maxVUs` when iterations are dropped. |
| `custom_ttfb`, `custom_error_rate`, `custom_failed_requests` | Extra visibility from `load-test.js` (time to first byte, combined error rate, failure count) |

### Is the result valid?

Check these before drawing conclusions from any load run:

1. **The load was applied.** For arrival-rate profiles, `dropped_iterations` is 0 and `http_reqs` matches the target rate. For VU profiles, the iteration rate matches VUs ÷ `iteration_duration`.
2. **The load generator was not the bottleneck.** If iterations were dropped while `vus_max` stayed below `maxVUs`, the machine running k6 is saturated. Run k6 on a separate machine or a larger runner.
3. **Errors come from the system under test.** Client-side connection refusals and timeouts point at the test environment, not the application.
4. **Comparisons are like for like.** Same profile, same environment, different `TEST_RUN_ID`s.
5. **Environment caveats are stated.** When k6 and the system under test share a laptop or CI runner, absolute numbers are indicative only. Trends between runs are still useful.

### Grafana dashboard

Open the **Unified Performance & Load Testing Dashboard** at
`http://localhost:3000/d/unified-perf-dashboard/unified-performance-load-testing-dashboard`.

- **Real-time metrics:** throughput by endpoint, latency percentiles (p90, p95, p99), error rate, and frontend metrics from sitespeed.io.
- **Run comparison:** a table comparing request count, average, p95 and p99 latency and failures per `test_run_id`, plus a side-by-side latency chart for any two runs (`Compare Run 1` and `Compare Run 2`).
- **Failure tracing:** each failed request's `trace_id`, URL, method, status, error message and duration; a latency breakdown (connect, TTFB, transfer); and failures by error category.

The `trace_id` is also sent to the system under test in the `X-Trace-ID` header, so a failed request can be matched to server logs. Traces are written only when `INFLUXDB_HOST` is set; `run-k6.sh`, Jenkins and the Compose `k6` service set it for you.

### Reporting a run

Summarize every load run in this shape (the values are illustrative):

```
Test / profile:  k6/load-test.js, load (TEST_RUN_ID=load_v1.4.0_20261107-1400)
Objective:       Confirm /api/items SLOs at expected traffic (10 VUs)
Environment:     Docker Compose on <host>; k6 and target <shared | separate>
Result:          PASS - /api/items p95 48 ms (SLO 300), p99 51 ms (SLO 500), errors 0.00% (SLO 1%)
Validity:        closed model, so no dropped iterations; ~18 iterations/s matches
                 10 VUs / ~0.55 s per iteration (Little's Law)
Observations:    <trends, anomalies, comparison with the previous run>
Next steps:      <only if supported by the data>
```

---

## CI/CD

### GitHub Actions (manual trigger)

`.github/workflows/basic.yml` runs only when started from **Actions → Basic Workflow → Run workflow**.

| Input | Default | Description |
|---|---|---|
| `test_script` | `k6/load-test.js` | API test to run: `k6/load-test.js` or a file in `k6/tests/`. The value is validated and must be an existing `.js` file under `k6/`. |
| `load_profile` | `smoke` | Load profile |
| `target_host` | *(empty)* | Target URL. When empty, the workflow starts the bundled sample app and tests it. |
| `run_browser_test` | `true` | Also run the browser Web Vitals test (separate job) |

- **Pinned toolchain:** k6 2.3.0 (`grafana/setup-k6-action@v1.2.2`), `actions/checkout@v7.0.1` and `actions/upload-artifact@v7.0.2`.
- **Security and concurrency:** the workflow token is read-only, and one run per branch executes at a time.
- **Timeouts:** 40 minutes, or 80 minutes for `soak`.
- **Failures:** a threshold breach fails the job. HTML reports and the browser screenshot are uploaded as artifacts even when a run fails.

### Jenkins

Create a **Pipeline** job pointing to this repository, then use **Build with Parameters**:

| Parameter | Purpose |
|---|---|
| `TEST_TYPE` | Suite to run: `all`, `backend_k6` or `frontend_sitespeed` |
| `LOAD_PROFILE` | k6 load profile, or `custom` to use `K6_VUS` and `K6_DURATION` (smoke SLOs apply) |
| `TEST_RUN_ID` | Run identifier for comparison. Blank means timestamp-based. |
| `TARGET_API_URL` | Backend URL (default `http://sample-app:8080`) |
| `TARGET_WEB_URL` | Frontend URL for sitespeed.io (default `http://sample-app:8080/`) |
| `K6_VUS`, `K6_DURATION` | VUs and duration for `custom` runs |

The k6 stage fails when an SLO threshold is breached.

---

## AI-assisted test authoring

The repository teaches AI coding assistants its conventions and its performance engineering standards, so a new test can be requested in plain English.

- **[CLAUDE.md](CLAUDE.md)** covers the repository map, commands and exit codes, methodology, SLO policy, result-validity rules, coding conventions and the definition of done. Claude Code loads it automatically; other assistants can be pointed at it.
- **`/new-k6-test`** (`.claude/skills/new-k6-test/`) is a Claude Code skill that works through six steps: test charter → workload model (open or closed, sized with Little's Law) → SLOs and checks → implementation from a template → layered validation (static, functional, load) → a structured report.

```text
/new-k6-test a spike test for /api/items at 200 requests/s with p95 < 800 ms
/new-k6-test a load test for /health with 20 VUs for 2 minutes and p99 under 100 ms
/new-k6-test a smoke test for /api/flaky that accepts its designed failures, with no more than 75% failing
```

These prompts produced the three tests in `k6/tests/`. Review generated tests like any other code before merging.

A generated test is built from shared helpers, so it automatically gets the framework's tags, tracing and endpoint-scoped SLOs:

```js
export const options = buildOptions({
  defaultProfile: 'spike',                 // -e LOAD_PROFILE always overrides
  endpoints: ['items'],                    // endpoint tags gated by SLOs
  scenario: { stages: [/* custom shape */] },
  thresholds: { 'http_req_duration{endpoint:items}': ['p(95)<800', 'p(99)<2000'] },
});

const request = tracedRequest('GET', '/api/items', { endpoint: 'items' });
const ok = checkEndpoint(request.res, 'items', { 'items status is 200': (r) => r.status === 200 });
if (!ok) reportFailure(request);
```

---

## Project structure

```
k6/
  load-test.js           Main API load test (SLO-gated)
  browser-test.js        Core Web Vitals test (k6 browser)
  tests/                 Additional API tests, one objective per file
  config/
    scenarios.js         Load profile library
    thresholds.js        SLO templates per profile, scoped by endpoint tag
  lib/
    options.js           buildOptions(): profile + endpoint tags -> k6 options
    http.js              tracedRequest, checkEndpoint, parseJson, reportFailure
    env.js               TARGET_HOST, INFLUXDB_HOST, TEST_RUN_ID
    tracing.js           Failed-request traces written to InfluxDB
sample-app/              System under test (Node.js)
scripts/                 run-k6.sh, run-sitespeed.sh, verify-all.sh
grafana/, influxdb/      Dashboard and database provisioning
.github/workflows/       GitHub Actions pipeline (manual trigger)
Jenkinsfile              Jenkins pipeline
.claude/skills/          /new-k6-test skill for AI-assisted authoring
CLAUDE.md                Standards and conventions for AI coding assistants
ProductRoadmap.md        Roadmap, status and change log
```

To check the whole stack and the ingested data end to end, run `./scripts/verify-all.sh`.

---

## Known limitations

| Limitation | Impact | Status |
|---|---|---|
| `scripts/run-sitespeed.sh` writes **hard-coded summary values** into InfluxDB after each audit (`sitespeed_frontend_summary`, `sitespeed_coach_score`, `sitespeed_first_visual_change`) and hides audit failures | Treat those series as placeholders, not measurements | Open (roadmap gap G9) |
| k6 and the system under test share one machine (laptop or CI runner) | Heavy profiles can saturate the load generator: a local 200 req/s spike dropped about 1–2% of iterations. Absolute numbers are indicative. | Use a dedicated load generator for capacity numbers (roadmap RM-19) |
| Browser FCP and LCP gates are lab budgets | Not comparable with Google field targets | Recalibrate from the first CI baseline (roadmap RM-12) |
| `sample-app` runs on Node.js 20, which reached end of life in April 2026 | No security fixes for the test target's runtime | Open (roadmap gap G10) |
| Default profile durations are short | Suitable for CI and demos, not for production capacity sign-off | Extend steady state for production-like environments |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Exit code `107`, "Target ... is not healthy" | `setup()` could not reach `GET /health` | Start the sample app, or set `TARGET_HOST` correctly (`http://localhost:8080` outside Compose) |
| Exit code `99` | One or more SLO thresholds failed | Read the ✗ lines in the summary; check result validity before concluding it is a regression |
| "Unknown LOAD_PROFILE" | Misspelled profile name | Use `smoke`, `load`, `stress`, `spike`, `soak` or `breakpoint` |
| "report generation was skipped (not enough data)" | Run shorter than the dashboard sampling period | Add `K6_WEB_DASHBOARD_PERIOD=1s` |
| `dropped_iterations` above 0 | Not enough VUs, or a saturated load generator | Raise `preAllocatedVUs` and `maxVUs` if `vus_max` hit the limit; otherwise move k6 to a separate machine |
| Browser test fails to launch Chromium in CI or a container | Chromium sandbox restrictions | Set `K6_BROWSER_ARGS=no-sandbox` (already set in the workflow and the `k6-browser` service) |
| No failed-request traces in Grafana | `INFLUXDB_HOST` not set | Use `run-k6.sh` or the Compose `k6` service, or pass `-e INFLUXDB_HOST=http://influxdb:8086` |

---

## Stopping the stack

```bash
docker compose down        # stop containers
docker compose down -v     # also delete InfluxDB, Grafana and Jenkins data
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the pre-PR checks and conventions, and [CLAUDE.md](CLAUDE.md) for the full engineering standards.

## License

MIT. See [LICENSE](LICENSE).

HTML reports generated by k6's web dashboard embed Grafana Labs assets licensed under AGPL-3.0. They are build artifacts and are never committed to this repository.
