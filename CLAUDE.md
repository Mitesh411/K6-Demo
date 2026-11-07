# CLAUDE.md

Guidance for AI coding assistants working in this repository: a k6 performance testing framework with a bundled system under test, InfluxDB and Grafana, Jenkins, and a GitHub Actions workflow.

## Layout

- `k6/load-test.js`: main API load test. `k6/browser-test.js`: Core Web Vitals test (k6 browser).
- `k6/tests/`: additional API tests, one file per scenario. New tests go here.
- `k6/config/scenarios.js`: load profiles (`smoke`, `load`, `stress`, `spike`, `soak`, `breakpoint`).
- `k6/config/thresholds.js`: SLO templates per profile, scoped by `endpoint` tag (`thresholdsFor`).
- `k6/lib/options.js`: `buildOptions()` turns a profile plus endpoint tags into k6 `options`.
- `k6/lib/http.js`: `tracedRequest`, `checkEndpoint`, `parseJson`, `reportFailure`.
- `k6/lib/env.js`: `TARGET_HOST`, `INFLUXDB_HOST`, `TEST_RUN_ID`.
- `sample-app/app.js`: system under test. Endpoints: `GET /health`, `GET /api/items`, `GET /api/flaky` (fails ~60% by design), `GET /` (web page).

## Commands

```bash
node sample-app/app.js &                                                   # start the system under test on :8080
k6 run -e TARGET_HOST=http://localhost:8080 k6/load-test.js                # smoke run (default profile)
k6 run -e TARGET_HOST=http://localhost:8080 -e LOAD_PROFILE=load k6/load-test.js
k6 inspect -e LOAD_PROFILE=<profile> <file>                                # validate options without running
```

k6 exits `0` on success, `99` when a threshold (SLO) fails, and `107` when `setup()` throws.

## Conventions for k6 tests

1. **Options:** always `export const options = buildOptions({ defaultProfile, endpoints, scenario?, thresholds? })`. Never hand-write `scenarios` or `thresholds` from scratch. `-e LOAD_PROFILE` must keep working, so every test can also run as `smoke`.
2. **Requests:** use `tracedRequest(method, path, { endpoint, name?, body?, params? })` from `k6/lib/http.js`, not `http.get` directly. The `endpoint` tag is short and stable (`items`, `health`, `flaky`). Set `name` for paths with IDs or query strings (`'GET /api/items/:id'`).
3. **Checks:** use `checkEndpoint(res, endpoint, { ... })`, so checks count towards that endpoint's SLO. Name checks as plain sentences (`'items status is 200'`).
4. **SLOs:** gate only the endpoints the test is about, by listing them in `endpoints`. Put stricter or custom limits in `thresholds`, keyed by the same tag, e.g. `'http_req_duration{endpoint:items}': ['p(95)<800', 'p(99)<2000']`. A key replaces the profile default for that key, so carry over default limits you are not changing. Never gate `/api/flaky` on a < 1% error rate.
5. **Failures:** call `reportFailure(request)` when checks fail, so Grafana's failure-trace panels stay populated.
6. **Health check:** include a `setup()` that calls `GET /health` and throws with a clear message if the target is not healthy.
7. **Think time:** add `sleep()` for VU-based profiles (`smoke`, `load`, `soak`). Arrival-rate profiles (`stress`, `spike`, `breakpoint`) control the rate themselves; keep `sleep` short or omit it.
8. **Grafana compatibility:** do not rename the `name` or `test_run_id` tags, the `failed_requests_trace` measurement, or the `custom_*` metrics in `load-test.js`.
9. **Dependencies:** no remote imports (`https://...`) and no new npm packages. Use k6 built-ins and `k6/lib`.
10. **Files:** one test per file in `k6/tests/<kebab-case-name>.js`. Import shared code with relative paths (`../lib/...`, `../config/...`).

## Verifying a change

Run all three before calling a test done:

1. `k6 inspect -e LOAD_PROFILE=<the test's default profile> <file>` succeeds, and the scenarios and thresholds are what was asked for.
2. With the sample app running, `k6 run -e TARGET_HOST=http://localhost:8080 -e LOAD_PROFILE=smoke <file>` exits `0`.
3. Do not run heavy profiles (`stress`, `spike`, `soak`, `breakpoint`) against anything except the local sample app unless the user asks.

## Other rules

- Pin versions: k6 `2.3.0`, Docker images, and GitHub Actions. Never use `latest`.
- Generated output belongs in `reports/` (git-ignored), never in commits.
- The GitHub Actions workflow is manual-only (`workflow_dispatch`). Do not add `push` or `pull_request` triggers without being asked.
- Track roadmap progress in `ProductRoadmap.md` (strike through completed items and update the change log).
