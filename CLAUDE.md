# CLAUDE.md

Guidance for AI coding assistants working in this repository: a k6 performance engineering framework with a bundled system under test, InfluxDB and Grafana, Jenkins, and a manually triggered GitHub Actions workflow.

Work to the standard of a senior performance engineer. Every test answers a stated question, every gate is an SLO someone can defend, and no result is reported without evidence that the run itself was valid.

## Repository map

| Path | Purpose |
|---|---|
| `k6/load-test.js` | Main API load test (gates `/api/items`; exercises `/api/flaky` for failure tracing) |
| `k6/browser-test.js` | Core Web Vitals test (k6 browser, headless Chromium) |
| `k6/tests/` | Additional API tests, one objective per file. **New tests go here.** |
| `k6/config/scenarios.js` | Load profile library: `smoke`, `load`, `stress`, `spike`, `soak`, `breakpoint` |
| `k6/config/thresholds.js` | SLO templates per profile, scoped by `endpoint` tag (`thresholdsFor`) |
| `k6/lib/options.js` | `buildOptions()`: profile + endpoint tags + overrides → k6 `options` |
| `k6/lib/http.js` | `tracedRequest`, `checkEndpoint`, `parseJson`, `reportFailure` |
| `k6/lib/env.js` | `TARGET_HOST`, `INFLUXDB_HOST`, `TEST_RUN_ID` |
| `sample-app/app.js` | System under test: `GET /health`, `GET /api/items` (10–50 ms), `GET /api/flaky` (fails ~60% by design), `GET /` (web page) |
| `.claude/skills/new-k6-test/` | `/new-k6-test` skill and template for authoring tests |
| `ProductRoadmap.md` | Roadmap; strike through completed items and update the change log |

## Commands

```bash
node sample-app/app.js &                                                      # system under test on :8080
k6 run -e TARGET_HOST=http://localhost:8080 k6/load-test.js                   # smoke (default profile)
k6 run -e TARGET_HOST=http://localhost:8080 -e LOAD_PROFILE=load k6/load-test.js
k6 inspect --execution-requirements -e LOAD_PROFILE=<profile> <file>          # resolve options without running
```

| k6 exit code | Meaning |
|---|---|
| `0` | Run completed and all thresholds passed |
| `99` | One or more thresholds (SLOs) failed, including `abortOnFail` aborts |
| `107` | Script error, including `setup()` throwing because the target is unhealthy |

## Performance engineering standards

### Test types

| Profile | Model | Objective | Pass means |
|---|---|---|---|
| `smoke` | Closed, 1 VU | Script and target work | Every check passes and there are zero errors |
| `load` | Closed, ramping VUs | SLOs hold at expected traffic | Latency and error SLOs met through steady state |
| `stress` | Open, stepped arrival rate | Find degradation above normal traffic | Relaxed SLOs met. Where degradation began is the finding. |
| `spike` | Open, sudden burst | Survive a burst and recover | Relaxed SLOs met; latency returns to baseline after the spike |
| `soak` | Closed, constant VUs, 1 h | Expose leaks and drift | SLOs met with no upward trend over time |
| `breakpoint` | Open, rate ramps up until abort | Find the maximum sustainable rate | The rate at abort is the result; the run is expected to stop |

The library durations are sized for CI and demonstrations. Against production-like environments, recommend longer steady states (tens of minutes for `load`, several hours for `soak`).

### Workload modelling

- **Open vs closed.** Throughput objectives ("N requests/s") use arrival-rate executors. Concurrency objectives ("N users") use VU executors. Prefer open models for latency-under-throughput questions, because closed models send fewer requests when the system slows down and hide degradation.
- **Little's Law.** Throughput ≈ concurrency ÷ (response time + think time). For arrival-rate tests, VUs needed ≈ rate × iteration duration. Set `preAllocatedVUs` at about 3 times that (minimum 20) and `maxVUs` at 2–3 times `preAllocatedVUs`.
- **Think time.** Use `sleep()` in closed models only. In open models the executor sets the pace.

### SLO policy

- Gate on **percentiles (p95 and p99), error rate and check pass rate**, never on averages.
- **Scope every gate to an endpoint tag.** Never gate global `http_req_*` metrics: they include `/api/flaky` (failing by design) and InfluxDB trace writes.
- **Checks assert correctness, not just status:** status code plus at least one body or header assertion.
- **Change control:** never weaken a threshold to make a run pass. Propose changes with evidence (measured distributions, root cause), record the reason in a code comment, and note it in `ProductRoadmap.md`. The browser test's lab budgets in `k6/browser-test.js` are the reference example.

### Result validity

A run is evidence only if all of these hold. Check them before reporting any full-load result.

1. **The load was actually applied:** for arrival-rate profiles, `dropped_iterations` is 0 and the achieved `http_reqs` rate matches the target. For VU profiles, the iteration rate matches VUs ÷ `iteration_duration`.
2. **The load generator was not the bottleneck:** if iterations were dropped while `vus_max` was below `maxVUs`, the generator machine is saturated. Report that; don't tune the test further.
3. **Errors come from the system under test,** not from client-side connection refusals or timeouts.
4. **Comparisons are like for like:** same profile, same environment, distinct `TEST_RUN_ID`s, compared in Grafana's run-comparison panels.
5. **Environment caveats are stated:** k6 and the sample app sharing one machine or CI runner limits what absolute numbers mean.

## Test authoring conventions

1. **Options:** `export const options = buildOptions({ defaultProfile, endpoints, scenario?, thresholds? })`. Never hand-write `scenarios` or `thresholds`. `-e LOAD_PROFILE` must keep working, so every test can also run as `smoke`.
2. **Requests:** `tracedRequest(method, path, { endpoint, name?, body?, params? })`, not `http.get`. The `endpoint` tag is short and stable (`items`, `health`, `flaky`). Set `name` for paths with IDs or query strings (`'GET /api/items/:id'`) to keep metric cardinality bounded.
3. **Checks:** `checkEndpoint(res, endpoint, { ... })`, with checks named as plain sentences (`'items status is 200'`).
4. **SLO overrides:** set stricter or custom limits in `thresholds`, keyed by the endpoint tag, e.g. `'http_req_duration{endpoint:items}': ['p(95)<800', 'p(99)<2000']`. A key replaces the profile default for that key, so carry over default limits you are not changing.
5. **Failures:** call `reportFailure(request)` when checks fail, so Grafana's failure-trace panels stay populated.
6. **Health gate:** include a `setup()` that calls `GET /health` and throws a clear message if the target is unhealthy.
7. **Grafana compatibility:** keep the `name` and `test_run_id` tags, the `failed_requests_trace` measurement, and the `custom_*` metrics in `load-test.js`.
8. **Dependencies:** no remote imports (`https://...`) and no npm packages. Use k6 built-ins and `k6/lib`.
9. **Files:** one test per file in `k6/tests/<kebab-case-name>.js`, importing shared code with relative paths (`../lib/...`).
10. **Authoring workflow:** prefer the `/new-k6-test` skill; it follows the charter → model → SLO → implement → validate → report sequence.

## Definition of done for a test change

- [ ] `k6 inspect` resolves for the test's default profile, and the options match the stated objective.
- [ ] A smoke run against the local sample app exits `0` with 100% of checks passing.
- [ ] If `k6/config/` or `k6/lib/` changed, every test resolves under all six profiles (loop in `CONTRIBUTING.md`).
- [ ] Any full-load result reported meets the result-validity criteria above.
- [ ] README tables (profiles, SLOs, additional tests) and `ProductRoadmap.md` are updated when behaviour changes.

## Repository rules

- Run heavy profiles (`stress`, `spike`, `soak`, `breakpoint`) only against the local sample app unless the user explicitly asks otherwise.
- Pin versions: k6 `2.3.0`, Docker images and GitHub Actions. Never use `latest`.
- Generated output goes in `reports/` (git-ignored), never in commits.
- The GitHub Actions workflow is manual-only (`workflow_dispatch`). Do not add `push` or `pull_request` triggers unless asked.

## Known limitations (do not present these as solved)

- **Fabricated frontend summary data:** `scripts/run-sitespeed.sh` writes hard-coded values into InfluxDB after each audit (`sitespeed_frontend_summary`, `sitespeed_coach_score`, `sitespeed_first_visual_change`) and hides audit failures. Tracked as roadmap gap G9.
- **End-of-life runtime:** `sample-app` runs on Node.js 20, which reached end of life in April 2026 (gap G10).
- **Lab Web Vitals:** browser FCP and LCP budgets are lab budgets with headroom, because headless Chromium's paint timing dominates on a fast local page. They need recalibrating from the first CI baseline.
- **Shared load generator:** in GitHub Actions and on laptops, k6 and the sample app share one machine. A 200 requests/s spike dropped about 1–2% of iterations locally with VUs to spare. Treat absolute numbers from such runs as indicative only.
