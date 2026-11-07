---
name: new-k6-test
description: Design, implement and validate a new k6 performance test in this repo from a plain-English request, the way a senior performance engineer would - objective first, then workload model, SLOs, implementation, layered validation and a structured report. Use when asked to write, add or generate a k6 smoke, load, stress, spike, soak or breakpoint test.
argument-hint: "<objective, e.g. a spike test for /api/items at 200 requests/s with p95 < 800 ms>"
allowed-tools: Read Grep Glob Write Edit Bash(k6 inspect *) Bash(k6 run *) Bash(node sample-app/app.js*) Bash(curl -s *)
---

# Design and build a k6 performance test

Request: **$ARGUMENTS**

Work as a senior performance engineer. A performance test exists to answer one question with evidence, so design before you write code, and do not report a result you have not validated. Repository conventions are in `CLAUDE.md`; the implementation template is [template.js](template.js); reviewed examples are in `k6/tests/`.

---

## 1. Write the test charter

Before writing code, fill in this charter from the request. Infer reasonable values and state them as assumptions. Ask the user only when the endpoint or the purpose is genuinely ambiguous.

| Item | Question to answer | Example |
|---|---|---|
| Objective | What decision will this result support? | "Can `/api/items` absorb a 10x burst without breaching its latency SLO?" |
| System under test | Which endpoints, on which target? Confirm each path exists in `sample-app/app.js` (or the target the user names). | `GET /api/items` on the local sample app |
| Workload model | Open (arrival rate) or closed (concurrent users)? See section 2. | Open, 200 requests/s peak |
| Load profile | Which library profile matches the objective? | `spike` |
| Success criteria | Which SLOs must hold? | p95 < 800 ms, error rate < 5% |
| Abort criteria | When is continuing pointless? | Smoke: any error. Breakpoint: SLO breach. |
| Out of scope | What will this test not tell us? | Capacity of production hardware |

## 2. Model the workload

### Choose the model

| The request talks about... | Model | Executors | Library profiles |
|---|---|---|---|
| Requests or transactions per second, throughput targets, "N rps" | **Open:** new work arrives regardless of how fast the system responds | `ramping-arrival-rate`, `constant-arrival-rate` | `stress`, `spike`, `breakpoint` |
| Users, sessions, "N VUs", concurrent clients | **Closed:** a fixed population that waits for each response | `ramping-vus`, `constant-vus` | `load`, `soak` |
| "Does it work at all?" | Minimal closed | `shared-iterations` | `smoke` |

Prefer the open model whenever the objective is about latency under a target throughput. In a closed model a slow system receives fewer requests, which hides degradation (coordinated omission).

### Choose the profile by objective

| Objective | Profile |
|---|---|
| Verify the script and target work | `smoke` |
| Confirm SLOs hold under expected traffic | `load` |
| Find where latency or errors start to degrade above normal traffic | `stress` |
| Check behaviour during and after a sudden burst, including recovery | `spike` |
| Expose leaks, resource exhaustion and slow drift over time | `soak` |
| Find the maximum sustainable rate | `breakpoint` |

Override only what the request changes (`stages`, `duration`, `vus`, rates), and keep the profile's executor unless the model requires another one.

### Size it (Little's Law)

- **Closed model:** throughput ≈ VUs ÷ (response time + think time). Use this to sanity-check that a requested VU count produces a meaningful request rate.
- **Open model:** VUs needed ≈ arrival rate × iteration duration (response time + think time + about 0.1 s overhead). Set `preAllocatedVUs` at about 3 times that, with a minimum of 20, and `maxVUs` at 2–3 times `preAllocatedVUs`. Steep ramps need the upper end, because k6 cannot start VUs instantly.
- **Durations:** ramps of at least 10–30 s. Steady state long enough to produce stable percentiles: at least a few hundred samples per gated endpoint, and at least 1–2 minutes at the target level. The library defaults are sized for CI and demos, so recommend longer steady states for production-like environments in the report.
- **Think time:** `sleep()` models user pacing in closed models. In open models the executor sets the pace, so omit `sleep` or keep it minimal.

## 3. Define SLOs and checks

- **Use percentiles, not averages.** Gate on p95 and p99 latency, error rate and check pass rate.
- **Scope every gate to an endpoint tag** (`http_req_duration{endpoint:items}`), never to the global metric. Intentional failures (such as `/api/flaky`) and telemetry calls must not affect a gate.
- **Carry-over rule.** A key you set in `thresholds` replaces the profile default for that key, so carry over default limits you are not changing. For example, user says p95 < 800 ms on `spike` → `['p(95)<800', 'p(99)<2000']`. Keys you do not set keep the defaults from `k6/config/thresholds.js`.
- **Checks verify correctness under load,** not only availability: the status code plus at least one assertion on the body or headers, based on the real response in `sample-app/app.js`. A fast wrong answer is a failure.
- **Sample size.** When gating a rate on a noisy endpoint, make sure the sample is large enough that random variation cannot breach it. For example, a 60% base failure rate against a 75% ceiling needs about 100 samples, not 5.
- **Never weaken a threshold to make a run pass.** If a limit looks wrong, report the evidence and propose a change; do not apply it silently.

## 4. Implement

1. Copy [template.js](template.js) to `k6/tests/<kebab-case-name>.js` and replace every `__PLACEHOLDER__`.
2. Keep the header comment: the request in one sentence, the default profile, and the run command.
3. Build `options` with `buildOptions()`, send requests with `tracedRequest()`, assert with `checkEndpoint()`, and call `reportFailure()` on failed checks. Keep the `setup()` health check.
4. Do not edit `k6/config/` or `k6/lib/` for a single test. If a new shared profile or helper is genuinely needed, say so and ask first.

## 5. Validate in layers

Do not report success until every layer that applies has passed.

| Layer | Command | Pass criteria |
|---|---|---|
| 1. Static | `k6 inspect --execution-requirements -e LOAD_PROFILE=<default profile> k6/tests/<file>.js` | `scenarios`, `thresholds` and `maxVUs` match the charter |
| 2. Functional | `k6 run -e TARGET_HOST=http://localhost:8080 -e LOAD_PROFILE=smoke k6/tests/<file>.js` | Exit code `0`, 100% of checks pass |
| 3. Load (only if the user asks) | `k6 run -e TARGET_HOST=http://localhost:8080 k6/tests/<file>.js` | SLOs hold **and** the run is valid (below) |

Start the system under test first if it is not running: `curl -s http://localhost:8080/health || (node sample-app/app.js &)`.

**A full run is valid only if:**

- `dropped_iterations` is 0, or explained. If `vus_max` reached `maxVUs`, raise the VU limits. If VUs were to spare, the load generator is the bottleneck (common when k6 and the target share one machine): report it and do not keep tuning.
- The achieved rate matches the design: `http_reqs` against the target for open models, and iterations/s against VUs ÷ `iteration_duration` for closed models.
- Errors come from the system under test, not from the load generator (connection refused or timeouts on the client side).

Never run `stress`, `spike`, `soak` or `breakpoint` against anything except the local sample app unless the user explicitly asks.

## 6. Report

Reply with this structure:

```
Test:        k6/tests/<file>.js
Objective:   <one sentence from the charter>
Workload:    <model>, <profile> - <shape, e.g. 10 -> 200 req/s in 10 s, hold 1 min>; preAllocatedVUs/maxVUs if open
SLOs:        <thresholds in effect, noting which ones override profile defaults>
Validation:  static OK | smoke exit 0, checks 100%, p95 <x> ms | full run <result or "not run">
Validity:    dropped_iterations <n>, achieved rate <x> req/s (full run only)
Assumptions: <anything inferred>
Run it:      k6 run -e TARGET_HOST=<url> k6/tests/<file>.js
             GitHub Actions: test_script=k6/tests/<file>.js, load_profile=<profile>
```

Add recommendations only when they are backed by the evidence, for example a longer steady state for production-like runs.
