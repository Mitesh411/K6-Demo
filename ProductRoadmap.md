# Product Roadmap: K6-Demo

**Last updated:** 2026-11-07
**Owner:** Product Management (AI & Quality Engineering)
**Status:** Proposed. Phase 1 is nearly complete (RM-01, RM-02, RM-03 and RM-05 done; RM-04 partly done). RM-08, RM-16 and RM-18 were delivered early, and RM-06 is mostly done. For review by Engineering and QA leads. See [Section 10](#10-change-log) for updates.

---

## 1. Vision

Turn K6-Demo from a single-request demo into a **reusable, CI-native performance testing starter kit**. Teams should get:

1. A trusted **pass/fail performance gate** on every pull request.
2. **Visibility into trends** across releases.
3. **AI-assisted** test authoring and results analysis that cut the time it takes to move from "we should load test this" to "we know where it breaks".

---

## 2. Current State Assessment

### 2.1 What exists today

| Asset | Purpose | Observations |
|---|---|---|
*Updated 2026-11-07, after the framework commit (`d472e81`) and the Phase 1 fixes.*

| Asset | Purpose | Observations |
|---|---|---|
| `k6/load-test.js` | Backend API load test | Targets the bundled sample app (`/api/items`, `/api/flaky`). It has a `/health` pre-check, body checks, SLO thresholds and a selectable load profile. Failed requests are traced to InfluxDB when `INFLUXDB_HOST` is set. |
| `k6/browser-test.js` | Frontend performance test | k6 browser test with Core Web Vitals lab budgets (LCP, FCP, CLS, TTFB) over 10 page loads, plus a screenshot. |
| `k6/tests/` | Additional API tests | Three tests generated from plain-English requests with `/new-k6-test`: a 200 requests/s spike on `/api/items`, a 20-VU load test on `/health`, and an error-contract smoke test on `/api/flaky`. |
| `k6/config/`, `k6/lib/` | Shared test code | Scenario library, endpoint-scoped SLO templates (`thresholdsFor`), the options builder (`buildOptions`), HTTP helpers (`tracedRequest`, `checkEndpoint`, `reportFailure`), environment settings and tracing. Every test uses them; verified with 24 of 24 test-and-profile combinations resolving. |
| `CLAUDE.md`, `.claude/skills/new-k6-test/` | AI-assisted authoring | Conventions for AI coding assistants, and a Claude Code skill (`/new-k6-test`) that generates and validates a test from a plain-English request. |
| `sample-app/` | System under test | Node.js app with a web page, a fast API and a deliberately flaky API. It is owned by the project, so heavy load is safe. |
| `docker-compose.yml`, `grafana/`, `influxdb/` | Observability stack | InfluxDB 1.8 and Grafana with a pre-provisioned dashboard for run comparison and failure tracing, plus k6, k6 browser and sitespeed.io runners. |
| `Jenkinsfile`, `scripts/` | Jenkins CI and helper scripts | Parameterized pipeline: suite selection, load profile, VUs and duration. |
| `.github/workflows/basic.yml` | GitHub Actions CI | **Manual trigger only**, with inputs for load profile, target and browser test. Starts the sample app, runs pinned k6 v2.3.0 and uploads HTML reports even on failure. |
| `README.md`, `CONTRIBUTING.md`, `LICENSE` | Documentation | Current usage, load profiles, SLOs, Web Vitals budgets, additional tests, CI inputs (including `test_script`), AI-assisted authoring and contribution guidance. MIT license. |

### 2.2 Strengths

- **Working end-to-end CI loop:** the workflow checks out the code, runs k6 and publishes a visual HTML report as a build artifact.
- **Rich visual reporting** through the k6 web dashboard export.
- **Current, reproducible CI toolchain:** since 2026-11-07, all actions and k6 are pinned to their latest releases, and the pipeline has no Go or xk6 build.
- **Simplified on purpose:** earlier versions imported unpinned remote JavaScript (`raw.githubusercontent.com/.../bundle.js`) and contained a broken `htmlReporter` reference. Both have been removed.
- **Owned system under test:** the bundled `sample-app` replaces public demo targets. Every profile, including stress and breakpoint, can run without affecting third parties.
- **Real quality gate:** SLO thresholds fail the run on breach. This was verified with a failing target (exit code 99), an unreachable target (exit code 107) and a full spike run.
- **Observability:** Grafana compares runs and shows failed-request traces in real time.
- **Low complexity:** the codebase is easy to restructure now, before other teams depend on it.

### 2.3 Critical gaps (verified 2026-11-07)

| # | Gap | Impact | Status |
|---|---|---|---|
| G1 | ~~**The test target is retired.** `test-api.k6.io/public/crocodiles/` now returns `302` and redirects to the `quickpizza.grafana.com` homepage.~~ | ~~Every CI run measures the wrong page and still reports success.~~ | **Resolved** 2026-11-07 (RM-01) |
| G2 | ~~**No checks or thresholds.**~~ | ~~The build cannot fail on errors or slow responses, so it provides no quality gate.~~ | **Resolved** 2026-11-07 (RM-02) |
| G3 | ~~**1 iteration, 1 virtual user (VU).**~~ | ~~This is a connectivity ping, not a load test.~~ | **Resolved** 2026-11-07 (RM-08) |
| G4 | **CI built k6 from source on every push**, using `@latest` versions. The `xk6-dashboard` extension it depended on is now **archived** (moved to `grafana-cold-storage`), and the xk6 install path changed in xk6 v1. | Slow, non-reproducible builds that were likely already broken. | **Resolved** 2026-11-07 (RM-03) |
| G5 | **The report upload was skipped when k6 failed.** | Once thresholds exist, the report would be missing exactly when it is needed. | **Resolved** 2026-11-07 (RM-04) |
| G6 | **Trigger and security settings.** The workflow ran on every push, had no `permissions` block and no timeout. | Unneeded runs and wider token permissions than necessary. | **Mostly resolved** 2026-11-07: manual-only trigger, run inputs, concurrency group, read-only token and timeout are in place. SHA pinning and Dependabot remain (RM-04). |
| G7 | ~~**Repo hygiene.** A generated artifact is committed, there is no `.gitignore` or `LICENSE`, and the README is inaccurate.~~ | ~~Confuses new contributors and creates licensing ambiguity.~~ | **Resolved** 2026-11-07 (RM-05) |
| G8 | **No structure for growth.** There are no environment configs, test data or results history. | Each new test is a copy-paste fork, so the project cannot scale beyond a demo. | **Mostly resolved:** the scenario library, options builder, HTTP helpers and `k6/tests/` exist, and new tests are a few lines. Environment configs (RM-07) and `SharedArray` test data (RM-06) remain. |
| G9 | **`scripts/run-sitespeed.sh` writes hard-coded Web Vitals** (`TTFB=45.2`, `PageLoadTime=210.5`, coach score 95) into InfluxDB after every audit. It also hides sitespeed.io failures (`\|\| { ... }`). | Grafana shows fabricated frontend numbers next to real ones, and a failed audit still looks green. | Open. Not yet scheduled. Recommended for the next sprint. |
| G10 | **`sample-app` runs on `node:20-alpine`**, and Node.js 20 reached end of life in April 2026. | No security fixes for the system-under-test runtime. | Open. Not yet scheduled (small fix). |

---

## 3. Prioritization Approach

Items are ranked by **Impact** (value to users and risk reduced) against **Feasibility** (effort, dependencies and confidence).

| Priority | Meaning |
|---|---|
| **P0** | Broken or misleading today. Fix immediately. |
| **P1** | Core capability that makes this a usable framework. |
| **P2** | High-value differentiator, including the AI features. |
| **P3** | Strategic or exploratory. Schedule when capacity allows. |

**Estimation conventions**

- **Dev hours** cover design, implementation, documentation and code review.
- **Test hours** cover verification: running the scripts locally and in CI, negative and failure-path testing, and validating reports.
- **Story points (SP)** are a Fibonacci sizing of the whole item (dev + test) for sprint planning. One SP is roughly 2–3 hours for one engineer.
- All estimates assume **one engineer who is familiar with k6 and GitHub Actions**. Add a 20–30% buffer for an engineer new to k6.

---

## 4. Roadmap at a Glance

Dev, Test and SP show the **remaining** effort. Completed work shows 0, and its original estimate is recorded in the item's detail section.

| ID | Item | Phase | Priority | Impact | Feasibility | Status | Dev (h) | Test (h) | SP |
|---|---|---|---|---|---|---|---:|---:|---:|
| RM-01 | ~~Repoint the test to a live, configurable target~~ | 1 | P0 | High | High | **Done** | 0 | 0 | 0 |
| RM-02 | ~~Add checks and threshold-based SLO gates~~ | 1 | P0 | High | High | **Done** | 0 | 0 | 0 |
| RM-03 | ~~Replace the xk6 build with the built-in dashboard and the official action~~ | 1 | P0 | High | High | **Done** | 0 | 0 | 0 |
| RM-04 | Harden the CI workflow | 1 | P0 | High | High | **In progress** | 1 | 1 | 1 |
| RM-05 | ~~Clean up the repo, license and README~~ | 1 | P0 | Medium | High | **Done** | 0 | 0 | 0 |
| RM-06 | Project structure and shared helper library | 2 | P1 | High | High | **Mostly done** | 2 | 1 | 1 |
| RM-07 | Environment configuration and secrets | 2 | P1 | High | High | Not started | 5 | 3 | 3 |
| RM-08 | ~~Scenario library (smoke, load, stress, spike, soak, breakpoint)~~ | 2 | P1 | High | High | **Done** | 0 | 0 | 0 |
| RM-09 | Realistic multi-step user journey | 2 | P1 | High | Medium | Not started | 8 | 4 | 5 |
| RM-10 | CI results reporting (job summary, JUnit, PR comment) | 2 | P1 | High | High | Not started | 6 | 3 | 3 |
| RM-11 | Developer experience tooling | 2 | P1 | Medium | High | Not started | 6 | 2 | 3 |
| RM-12 | Baseline comparison and regression detection | 3 | P1 | High | Medium | Not started | 13 | 6 | 8 |
| RM-13 | Scheduled runs and alerting | 3 | P2 | Medium | High | Not started | 5 | 3 | 3 |
| RM-14 | Test generation from OpenAPI or Postman specs | 3 | P2 | High | Medium | Not started | 16 | 8 | 8 |
| RM-15 | AI results analyst | 3 | P2 | High | Medium | Not started | 12 | 8 | 8 |
| RM-16 | ~~AI-assisted test authoring workflow~~ | 3 | P2 | Medium | High | **Done** | 0 | 0 | 0 |
| RM-17 | Historical trend dashboard | 4 | P2 | Medium | Medium | Not started | 16 | 6 | 8 |
| RM-18 | ~~Frontend (browser) performance testing~~ | 4 | P2 | Medium | Medium | **Done** | 0 | 0 | 0 |
| RM-19 | Distributed and scale-out execution | 4 | P3 | Medium | Medium | Not started | 12 | 6 | 8 |
| RM-20 | AI SLO recommendation and anomaly detection | 4 | P3 | Medium | Low | Not started | 16 | 10 | 13 |
| RM-21 | Additional protocol coverage (WebSocket, gRPC) | 4 | P3 | Low | High | Not started | 8 | 4 | 5 |
| | **Total remaining** | | | | | | **126** | **65** | **77** |

### Phase summary

| Phase | Theme | Items | Dev (h) | Test (h) | Total (h) | SP | Indicative timing (1 engineer) |
|---|---|---|---:|---:|---:|---:|---|
| 1 | **Stabilize:** make results trustworthy | RM-01 to RM-05 | 1 | 1 | 2 | 1 | Sprint 1 (week 1). **Nearly done:** only RM-04 SHA pinning and Dependabot remain. |
| 2 | **Foundation:** become a real framework | RM-06 to RM-11 | 27 | 13 | 40 | 15 | Sprints 2–3 (weeks 2–3). RM-08 done; RM-06 mostly done. |
| 3 | **Insights and AI:** detect regressions and speed up the work | RM-12 to RM-16 | 46 | 25 | 71 | 27 | Sprints 4–5 (weeks 4–5). RM-16 done. |
| 4 | **Scale and explore** | RM-17 to RM-21 | 52 | 26 | 78 | 34 | Sprint 6 onward (week 6+). RM-18 done. |
| | **Total remaining** | 14 open items | **126** | **65** | **191** | **77** | About 6.5 weeks at ~30 productive h/week |

Original baseline: 258 h (169 dev + 89 test) and 102 SP. Completed so far: 67 h and 25 SP (RM-01, RM-02, RM-03, RM-05, RM-08, RM-16, RM-18, most of RM-04 and most of RM-06).

**Re-baseline recommended:** the framework commit (`d472e81`) already delivers most of RM-17 Option B (a local InfluxDB and Grafana stack with run comparison). Its estimate has not been reduced yet.

### Dependency map

```
RM-01 (done) ─┬─> RM-02 (done) ─┬─> RM-08 (done) ─> RM-12 ─┬─> RM-15
              │                 │                          ├─> RM-17 ─> RM-20
              │                 └─> RM-10 ─────────────────┘
RM-03 (done) ─┴─> RM-04 ─> RM-10, RM-13
RM-06 (mostly done) ─┬─> RM-07 ─> RM-09, RM-13, RM-19
                     ├─> RM-14
                     └─> RM-16 (done)
RM-11, RM-21: independent.  RM-05 and RM-18: done.
RM-12 and RM-14 are now unblocked (RM-08 done; RM-06 helpers in place).
```

---

## 5. Detailed Backlog

### Phase 1: Stabilize (P0)

**Goal:** every CI run produces a correct, reproducible and actionable result.

#### ~~RM-01: Repoint the test to a live, configurable target~~ ✅ Done (2026-11-07)
- ~~**Description:** Replace the retired `test-api.k6.io` endpoint with a live target. Read the base URL from the environment so the same script can target any environment.~~
- **Delivered (scope changed):** the framework commit added an owned system under test (`sample-app`), so it replaced the planned QuickPizza target. Owning the target makes heavy profiles safe.
  - The retired `script.js` was removed. `k6/load-test.js` is now the single API test for GitHub Actions, Jenkins and Docker Compose.
  - The target comes from `TARGET_HOST`. GitHub Actions starts the sample app itself (`docker compose up --wait sample-app`) and tests `http://localhost:8080`.
  - `setup()` calls `/health` and stops the run with a clear message if the target is wrong or down.
- **Acceptance criteria:**
  - [x] The test asserts a direct `200` and the expected body, not a redirect.
  - [x] `-e TARGET_HOST=<url>` overrides the target.
  - [x] Smoke is the default profile.
  - [x] Verified: an unreachable target exits with code 107 and an explanation.
- **Original estimate:** Dev 2 h | Test 1 h | SP 1

#### ~~RM-02: Add checks and threshold-based SLO gates~~ ✅ Done (2026-11-07)
- ~~**Description:** Add `check()` assertions and threshold-based SLO gates, using `abortOnFail` for hard failures and tagging thresholds per endpoint.~~
- **Delivered:**
  - **Checks:** status code, response body status, a non-empty items list, and that the trace ID is echoed back.
  - **Thresholds:** defined per load profile in `k6/config/thresholds.js`. For example, smoke, load and soak require error rate < 1%, p95 < 300 ms, p99 < 500 ms and checks > 99%. Smoke aborts at once on breach.
  - **Scoping:** gates use the `endpoint:items` tag, so the intentionally flaky `/api/flaky` (about 60% failures) and InfluxDB telemetry writes do not count.
  - **Documentation:** the SLOs are documented in the README.
- **Acceptance criteria:**
  - [x] Breaching a threshold fails the run. Verified: a failing target gives exit code 99.
  - [x] Negative test performed.
  - [x] SLOs documented with their rationale.
- **Original estimate:** Dev 3 h | Test 2 h | SP 2

#### RM-03: Replace the xk6 build with the built-in dashboard and the official action ✅ Done (2026-11-07)
- **Description:**
  - Remove the Go setup, the `xk6` install and the custom binary build.
  - Use `grafana/setup-k6-action` with a **pinned k6 version**.
  - Enable the built-in web dashboard with `K6_WEB_DASHBOARD=true` and `K6_WEB_DASHBOARD_EXPORT=test-report.html`.
- **Value:** fixes gap G4. The pipeline gets faster, reproducible versions and fewer moving parts and supply-chain inputs. This was required, not optional: `grafana/xk6-dashboard` is archived and does not target k6 v2.
- **Delivered:** the action and tool versions now in `basic.yml` are:

  | Component | Before | After |
  |---|---|---|
  | `actions/checkout` | v4.2.0 | v7.0.1 |
  | `actions/upload-artifact` | v4.4.0 | v7.0.2 |
  | `actions/setup-go`, Go, `xk6`, `xk6-dashboard` | used | removed |
  | k6 | custom build, `@latest` | v2.3.0 via `grafana/setup-k6-action@v1.2.2` |

- **Acceptance criteria:**
  - [x] The workflow has no Go or xk6 steps.
  - [x] The k6 version is pinned explicitly.
  - [ ] The HTML report renders the same panels as before. *Confirm on the first manual run.*
  - [ ] Pipeline duration is recorded from the first manual run.
- **Original estimate:** Dev 3 h | Test 2 h | SP 2. **Remaining:** verification only, as part of the first manual run.

#### RM-04: Harden the CI workflow 🔄 In progress
- **Description:**
  - [x] Switch to a manual trigger only (`workflow_dispatch`). The push trigger was removed by decision on 2026-11-07.
  - [x] Add `if: always()` to the report upload step.
  - [x] Add `permissions: contents: read` and `timeout-minutes`.
  - [x] Add `workflow_dispatch` inputs: `load_profile` (RM-08), `target_host` (RM-01) and `run_browser_test` (RM-18).
  - [x] Add a `concurrency` group (one run per branch; new runs wait).
  - [ ] Pin third-party actions to commit SHAs and enable Dependabot for Actions.
- **Value:** fixes gaps G5 and G6. The workflow runs on demand, always publishes evidence and follows least privilege.
- **Acceptance criteria:**
  - A failing run still uploads its report.
  - Runs can be started manually from the Actions tab, with inputs.
  - Overlapping manual runs are queued or cancelled per the concurrency group.
  - Dependabot opens PRs for action updates.
- **Original estimate:** Dev 3 h | Test 2 h | SP 2. **Remaining:** Dev 1 h | Test 1 h | SP 1 (SHA pinning and Dependabot only).
- **Note:** automatic PR gating is deferred because the pipeline is now manual-only by decision. See open question 6.

#### ~~RM-05: Clean up the repo, license and README~~ ✅ Done (2026-11-07)
- ~~**Description:** Remove committed reports, add `.gitignore`, `LICENSE` and `CONTRIBUTING.md`, and bring the README up to date.~~
- **Delivered:**
  - **Removed:** `html-report.html` (stale, AGPL-licensed export) and the duplicate `script.js`.
  - **`.gitignore`:** covers `reports/`, `sitespeed-result/`, `node_modules/` and `.env`.
  - **`LICENSE`:** MIT, matching the license the original README declared. The README notes that generated dashboard reports embed AGPL-3.0 assets and are never committed.
  - **`README.md`:** updated with the project structure, settings, load profiles, SLO tables, the browser test, runs without Docker, GitHub Actions inputs and the Jenkins `LOAD_PROFILE` parameter.
  - **`CONTRIBUTING.md`:** added, with pre-PR checks and conventions.
- **Acceptance criteria:**
  - [x] No generated files are tracked.
  - [x] The README contains no speculative wording.
  - [x] The README includes a local run path without Docker (Node.js plus k6).
- **Original estimate:** Dev 3 h | Test 1 h | SP 2
- **Follow-up:** confirm the license choice and copyright holder (open question 3).

---

### Phase 2: Foundation (P1)

**Goal:** a maintainable framework that any team can extend with new APIs and load profiles without copy-paste.

#### RM-06: Project structure and shared helper library 🔄 Mostly done
- **Progress (2026-11-07):**
  - [x] `k6/tests/`: one entry-point script per scenario (three tests so far).
  - [x] `k6/lib/`: `http.js` (traced requests with default headers and tags, endpoint-tagged checks, failure logging), `options.js` (`buildOptions`), `env.js` and `tracing.js`.
  - [x] `k6/config/`: scenario library and endpoint-scoped SLO templates.
  - [x] At least two test files reuse `lib/` helpers with no duplicated logic. All four API tests do.
  - [x] Folder conventions documented in `README.md`, `CONTRIBUTING.md` and `CLAUDE.md`.
  - [ ] `k6/data/` with `SharedArray` test data. Deferred until an endpoint takes parameters (RM-09); the sample app's endpoints take none today.
  - [ ] TypeScript (optional).
- **Original description:** Restructure the repo into these directories:

  | Directory | Contents |
  |---|---|
  | `tests/` | Entry-point scripts |
  | `lib/` | HTTP client wrapper with default headers, standard checks, tagging and error logging |
  | `config/` | Thresholds and scenario definitions |
  | `data/` | CSV and JSON test data loaded through `SharedArray` |

  Optionally adopt TypeScript, which k6 v1.x supports natively.
- **Value:** fixes gap G8. New tests take minutes to write, with consistent conventions.
- **Acceptance criteria:**
  - At least two test files reuse `lib/` helpers with no duplicated logic.
  - Test data is loaded once per test through `SharedArray`.
  - The folder conventions are documented.
- **Original estimate:** Dev 8 h | Test 4 h | SP 5. **Remaining:** Dev 2 h | Test 1 h | SP 1 (`SharedArray` test data).

#### RM-07: Environment configuration and secrets
- **Description:**
  - Add per-environment config files (`config/env/{dev,staging,prod}.json`) selected with `-e ENV=staging`.
  - Pass credentials and tokens through `__ENV`, sourced from GitHub Actions secrets and environments.
  - Add a safety guard so that heavy profiles cannot target production without an explicit override flag.
- **Value:** the same tests run safely across environments, and no secrets live in code.
- **Acceptance criteria:**
  - Switching environments needs no code change.
  - A stress profile against `prod` is refused unless `ALLOW_PROD_LOAD=true` is set.
  - Secret scanning finds no secrets in the repo.
- **Dev effort:** 5 h | **Test effort:** 3 h | **SP:** 3

#### ~~RM-08: Scenario library~~ ✅ Done (2026-11-07)
- ~~**Description:** Define reusable `scenarios` built on k6 executors, selectable with a single flag, with smoke as the default.~~
- **Delivered:** `k6/config/scenarios.js`, selected with `-e LOAD_PROFILE=<name>`. The variable is named `LOAD_PROFILE` rather than `TEST_TYPE`, which Jenkins already uses for suite selection.

  | Profile | Executor | Verified with `k6 inspect` |
  |---|---|---|
  | smoke | `shared-iterations` | 1 VU, 5 iterations |
  | load | `ramping-vus` | 10 VUs, 5m30s |
  | stress | `ramping-arrival-rate` | 100 max VUs, 12m30s |
  | spike | `ramping-arrival-rate` | 200 max VUs, 3m20s. **Full run passed:** 7,154 iterations, 0% errors on `/api/items`. |
  | soak | `constant-vus` | 10 VUs, 1 h |
  | breakpoint | `ramping-arrival-rate` | 500 max VUs, aborts on SLO breach |

  - **Available from every run path:** the GitHub Actions `load_profile` input, the Jenkins `LOAD_PROFILE` parameter, and `LOAD_PROFILE=... ./scripts/run-k6.sh`. Ad-hoc `--vus`/`--duration` runs still work and keep the smoke thresholds.
  - **Validation:** an unknown profile name fails with the list of valid names.
- **Acceptance criteria:**
  - [x] Each profile runs from a single flag.
  - [x] Each profile has its own thresholds.
  - [x] The README has a table describing when to use each profile.
- **Original estimate:** Dev 8 h | Test 5 h | SP 5

#### RM-09: Realistic multi-step user journey
- **Description:** Model a real multi-step flow. Extend `sample-app` with a small login and order flow, or use the first internal service (open question 1): authenticate, then browse items, then submit an action. Use `group()` per step, request tags, correlation of dynamic values (tokens and IDs), randomized think time (`sleep`), and parameterized data.
- **Value:** results reflect real user behaviour rather than single-endpoint hammering.
- **Acceptance criteria:**
  - The journey passes for 10 or more VUs with no correlation errors.
  - Per-group and per-endpoint metrics appear in the report.
- **Dev effort:** 8 h | **Test effort:** 4 h | **SP:** 5

#### RM-10: CI results reporting
- **Description:** Implement `handleSummary()` to produce four outputs:
  1. A Markdown summary written to `$GITHUB_STEP_SUMMARY`.
  2. A JUnit XML file, so thresholds appear as test cases in GitHub test reporting.
  3. A `summary.json` artifact that feeds RM-12 and RM-15.
  4. *(Only if a PR trigger is adopted; see open question 6.)* A sticky PR comment with the key metrics and threshold pass/fail status.
- **Value:** results are visible in seconds on the run page, with no need to download artifacts. While the pipeline is manual-only, the job summary is the main place to read results.
- **Acceptance criteria:**
  - Every run shows p95, p99, error rate, RPS and threshold status in the job summary.
  - If PR triggers are enabled, PRs receive one comment that updates on each run.
- **Dev effort:** 6 h | **Test effort:** 3 h | **SP:** 3

#### RM-11: Developer experience tooling
- **Description:**
  - Add a `Makefile` or `npm` scripts (`make smoke`, `make load ENV=staging`).
  - Add a Docker-based run using the official `grafana/k6` image, so no local install is needed.
  - Add `@types/k6` for editor IntelliSense, and ESLint + Prettier with a CI lint job.
  - Add a pre-commit hook.
- **Value:** lower barrier to contribution and fewer broken scripts reaching CI.
- **Acceptance criteria:**
  - A one-command local run works on Windows, macOS and Linux.
  - The lint job fails on a syntax or style error.
- **Dev effort:** 6 h | **Test effort:** 2 h | **SP:** 3

---

### Phase 3: Insights and AI (P1/P2)

**Goal:** catch regressions automatically and use AI to cut authoring and analysis time.

#### RM-12: Baseline comparison and regression detection
- **Description:**
  - Persist `summary.json` from each successful `main` run as the baseline. Store it as an artifact or on a `perf-baselines` branch.
  - On PRs, compare the current run against the baseline and flag or fail when key metrics regress beyond a configurable tolerance (for example, p95 more than 10% worse).
  - Account for run-to-run noise with a minimum sample size and multiple baseline runs.
- **Value:** moves from absolute thresholds ("is it under 500 ms?") to relative regression detection ("did this PR make it slower?").
- **Acceptance criteria:**
  - An artificial latency injection in a test branch is detected and reported with its delta.
  - Normal runs of unchanged code do not trigger false positives over 10 consecutive runs.
- **Dev effort:** 13 h | **Test effort:** 6 h | **SP:** 8
- **Dependencies:** RM-08, RM-10

#### RM-13: Scheduled runs and alerting
- **Description:**
  - Add a nightly `schedule` (cron) workflow that runs load or soak profiles against staging.
  - Send Slack or Microsoft Teams webhook notifications on threshold breach or regression, with a link to the report.
- **Value:** catches environment and infrastructure degradation that does not come from a PR.
- **Acceptance criteria:**
  - The nightly run executes unattended.
  - A forced failure posts one alert containing the report link and the failing metrics.
- **Dev effort:** 5 h | **Test effort:** 3 h | **SP:** 3
- **Dependencies:** RM-04, RM-07

#### RM-14: Test generation from OpenAPI or Postman specs
- **Description:**
  - Generate typed k6 client code and starter scripts from OpenAPI specifications using Grafana's `openapi-to-k6`.
  - Provide a conversion path for existing Postman collections. Postman CLI is already used in this team's toolchain.
  - Add an LLM-assisted enrichment step that proposes checks, correlation, realistic data and a scenario choice. A human reviews the generated script before merge.
- **Value:** cuts time-to-first-test for a new API from hours to minutes, and reuses API assets the team already has.
- **Acceptance criteria:**
  - A sample OpenAPI spec produces a runnable smoke test with checks.
  - Generated code follows the RM-06 conventions and passes lint.
  - The README documents the human review step.
- **Dev effort:** 16 h | **Test effort:** 8 h | **SP:** 8
- **Dependencies:** RM-06

#### RM-15: AI results analyst
- **Description:** Add a post-run CI step that sends a **sanitized** `summary.json` and the baseline diff (RM-12) to an LLM, such as Claude through the Anthropic API. The model produces a plain-English analysis:
  - what changed;
  - which endpoints or groups drove the change;
  - likely causes (for example, latency rising with load, which suggests saturation);
  - recommended next steps.

  The analysis is posted to the job summary and the PR comment.
- **Guardrails:**
  - The analysis is **advisory only**. Pass/fail stays with the deterministic thresholds.
  - No secrets, tokens or PII are sent in the payload.
  - Token and cost limits apply per run.
  - The step runs only when an API key is configured, so forks degrade gracefully.
- **Value:** makes results understandable to non-specialists and shortens triage time.
- **Acceptance criteria:**
  - In 5 seeded scenarios (regression, error spike, healthy run, noisy run, threshold breach), the analysis names the correct primary issue in at least 4.
  - The payload is shown to contain no secrets.
  - The pipeline still passes when no API key is configured.
- **Dev effort:** 12 h | **Test effort:** 8 h | **SP:** 8
- **Dependencies:** RM-10, RM-12

#### ~~RM-16: AI-assisted test authoring workflow~~ ✅ Done (2026-11-07)
- ~~**Description:** Add a repo-level `CLAUDE.md` and reusable prompt templates or slash commands, so AI coding assistants generate scripts that match the framework instead of ad-hoc code.~~
- **Delivered:**
  - **`CLAUDE.md`** (repo root): layout, commands, exit codes, ten test-authoring conventions, verification steps and repo rules (pinned versions, manual-only CI, roadmap upkeep).
  - **`/new-k6-test` skill** (`.claude/skills/new-k6-test/`): it maps a plain-English request to an endpoint tag, a load profile, a custom shape and SLOs, then writes `k6/tests/<name>.js` from `template.js`. It validates the result with `k6 inspect` and a smoke run, then reports back.
  - **Framework support:** `buildOptions()` and the `k6/lib/http.js` helpers, so a generated test is a few lines and inherits tags, tracing and endpoint-scoped SLOs. The refactor was checked as behaviour-neutral: `load-test.js` options are identical for all six profiles.
  - **CI:** a new `test_script` input runs any test in `k6/tests/` from GitHub Actions. The input is validated against path traversal and shell injection.
- **Acceptance criteria:**
  - [x] Three natural-language requests produced scripts that pass `k6 inspect` and smoke runs (exit code 0, 100% of checks) without manual restructuring:

    | Request | Generated test | Validation |
    |---|---|---|
    | "a spike test for /api/items at 200 requests/s with p95 < 800 ms" | `items-spike-200rps.js` | Smoke passed. Full run passed: p95 65 ms, 0% errors; about 1–2% of iterations dropped on the test laptop. |
    | "a load test for /health with 20 VUs for 2 minutes and p99 under 100 ms" | `health-load-20vus.js` | Smoke passed. Full run passed: p99 60 ms, 0% errors. |
    | "a smoke test for /api/flaky that accepts its designed failures …" | `flaky-error-contract-smoke.js` | Smoke passed (100 requests; designed failures within the 75% ceiling) |

  - "Lint" was replaced by `k6 inspect` validation until RM-11 adds ESLint.
- **Original estimate:** Dev 6 h | Test 4 h | SP 3
- **Caveat:** the three tests were generated by the same assistant that wrote the skill. Have a teammate run `/new-k6-test` with a fresh request for an independent check.

---

### Phase 4: Scale and Explore (P2/P3)

**Goal:** long-term observability, broader coverage and larger-scale execution.

#### RM-17: Historical trend dashboard
- **Description:** Two complementary options:
  - **Option A (zero infrastructure):** publish each run's HTML report and `summary.json` to GitHub Pages, with an index page that charts p95, error rate and RPS over time.
  - **Option B (local and advanced):** a `docker-compose` stack in which k6 sends metrics through Prometheus remote write to Prometheus, viewed in Grafana with a pre-provisioned dashboard.
- **Value:** release-over-release performance visibility for engineering leadership.
- **Acceptance criteria:**
  - The trend page shows at least 30 days of history.
  - `docker compose up` followed by a test run shows live metrics in Grafana.
- **Dev effort:** 16 h | **Test effort:** 6 h | **SP:** 8
- **Dependencies:** RM-10, RM-12

#### ~~RM-18: Frontend (browser) performance testing~~ ✅ Done (2026-11-07)
- ~~**Description:** Add `k6/browser` tests that capture Core Web Vitals and page-level timings.~~
- **Delivered:** `k6/browser-test.js` loads the sample app in headless Chromium and checks that the heading and the API-loaded items render.
  - **Thresholds (p75, over 10 page loads):** lab budgets of LCP < 3.5 s and FCP < 3.0 s; Google targets for CLS < 0.1 and TTFB < 800 ms; and 100% of checks.
  - **Correction (2026-11-07):** the first version used Google's field targets (FCP < 1.8 s, LCP < 2.5 s) over 3 loads, and it proved flaky. A diagnostic showed headless Chromium on the test machine reported no paint at all by the page's `load` event, even for a bare JSON response with a 4 ms TTFB. Measured FCP (1.3–2.9 s) is browser scheduling, not app cost. The budgets now have headroom and passed 3 of 3 runs (FCP p75 about 1.8 s). Recalibrate from the first CI baseline (RM-12).
  - **Screenshot:** saved to `reports/browser-test.png`.
  - **Where it runs:** a separate GitHub Actions job (`run_browser_test` input) and a Docker Compose service (`k6-browser`, `grafana/k6:2.3.0-with-browser`).
  - **Verified locally:** all thresholds passed (FCP and LCP p75 about 1.8 s, CLS 0, TTFB 4 ms).
- **Acceptance criteria:**
  - [x] The browser smoke test runs headless (verified locally with k6 2.3.0) and is wired into the GitHub Actions workflow.
  - [x] Web Vitals appear in the report, with thresholds.
  - [ ] Confirm on the first GitHub Actions run (shared with the RM-03 verification).
- **Original estimate:** Dev 10 h | Test 5 h | SP 5
- **Not included:** a hybrid browser-plus-API-load scenario, and INP (it needs user interaction). Consider them with RM-12.

#### RM-19: Distributed and scale-out execution
- **Description:** Document and automate execution beyond a single GitHub-hosted runner. Options are Grafana Cloud k6 (`k6 cloud run`) or `k6-operator` on Kubernetes for self-hosted distributed load. Include a capacity guide that shows which load levels need which runner type.
- **Value:** supports realistic production-scale tests that a single runner cannot generate reliably.
- **Acceptance criteria:**
  - A documented and tested path to run a load of 1,000 VUs or more.
  - The guide compares cost and capacity across the options.
- **Dev effort:** 12 h | **Test effort:** 6 h | **SP:** 8
- **Dependencies:** RM-07, RM-08

#### RM-20: AI SLO recommendation and anomaly detection
- **Description:**
  - Use historical run data (RM-17) to recommend threshold values grounded in observed percentiles and variance.
  - Flag statistical anomalies in trends, for example gradual p99 drift that stays under the hard thresholds.
  - Start with statistical methods. Add LLM explanations on top, as in RM-15.
- **Value:** replaces guesswork in SLOs with data-driven targets, and catches slow-burn degradation.
- **Acceptance criteria:**
  - Recommended thresholds would have produced fewer than 5% false failures on historical data.
  - A seeded gradual drift is detected within 3 runs.
- **Dev effort:** 16 h | **Test effort:** 10 h | **SP:** 13
- **Dependencies:** RM-12, RM-17

#### RM-21: Additional protocol coverage
- **Description:** Add reference tests for WebSockets (`k6/websockets`) and gRPC (`k6/net/grpc`), with checks and thresholds that follow the RM-06 conventions.
- **Value:** makes the starter kit usable for teams whose services are not REST-based.
- **Acceptance criteria:**
  - Each protocol has one runnable example against a public or locally containerized service, with documentation.
- **Dev effort:** 8 h | **Test effort:** 4 h | **SP:** 5

---

## 6. Success Metrics

| KPI | Baseline (today) | Target (end of Phase 3) |
|---|---|---|
| Correctness of the CI performance signal | ~~Measures a redirect target and never fails~~ **Achieved 2026-11-07:** tests the owned sample app with enforced SLO gates | Tests the intended API, with an enforced SLO gate |
| CI performance job duration (smoke) | Go install and from-source build removed on 2026-11-07. Measure on the first manual run. | Under 2 minutes end to end |
| On-demand runs | **Achieved 2026-11-07:** manual runs with load profile, target and browser-test inputs | One-click manual runs with selectable test type and target (RM-04) |
| PRs gated by a performance check | 0% (manual-only by decision) | Per decision on open question 6 |
| Time to author a new API test | **Improved 2026-11-07:** a template plus `/new-k6-test` produce a validated test in one request (RM-16). Not yet timed with a teammate. | Under 30 minutes, using templates or generation (RM-14, RM-16) |
| Regressions caught before merge | Not measured | 80% or more of seeded regressions detected (RM-12) |
| Time to understand a failed run | Download and inspect the HTML report manually | Under 5 minutes, using the PR summary and AI analysis |

---

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Heavy load accidentally aimed at a shared or production system | Low (was Medium) | High | Default targets are now the owned `sample-app`. A non-default `TARGET_HOST` is an explicit choice. Add the RM-07 production guard before onboarding real environments. |
| Sample app and load generator share one GitHub Actions runner | High | Medium | Results from heavy profiles in GitHub Actions reflect the runner's limits, not production capacity. Use them for regression trends (RM-12), and use dedicated environments or RM-19 for capacity numbers. |
| Fabricated sitespeed.io metrics (gap G9) mislead dashboard readers | High | Medium | Remove the hard-coded InfluxDB write in `run-sitespeed.sh` and let failed audits fail. |
| GitHub-hosted runners give noisy, variable results | High | Medium | Use relative comparison with tolerance bands and repeated baselines (RM-12). Use larger runners or RM-19 for serious load. |
| Unpinned or abandoned dependencies (`@latest`, archived extensions, remote jslib imports) break builds or introduce supply-chain risk | Low (was Medium) | High | k6 and actions are pinned to version tags, and the archived `xk6-dashboard` was removed (RM-03, done). Remaining: SHA pinning and Dependabot (RM-04), and pinned jslib versions. |
| Manual-only trigger means regressions are not caught automatically | Medium | Medium | Run before releases as a documented step. Revisit PR or scheduled triggers once tests are reliable (open question 6, RM-13). |
| AI features leak sensitive data or give confident but wrong analysis | Medium | High | Sanitize payloads, keep AI output advisory, evaluate it against seeded scenarios, and require human review of generated tests (RM-14, RM-15). |
| AGPL-licensed report assets conflict with the intended project license | Low | Medium | Mitigated in RM-05: generated reports are no longer committed (`reports/` is ignored) and the README notes the AGPL assets. |
| AI API costs grow with run frequency | Low | Low | Run analysis only on failures, regressions or `main`. Cap tokens per run. |

---

## 8. Assumptions and Open Questions

**Assumptions**
- The near-term target system is the bundled `sample-app`. Internal APIs are onboarded through RM-07 once environments and credentials are available.
- GitHub Actions (manual runs) and Jenkins (Docker Compose stack) are both supported CI platforms.
- AI features use an externally hosted LLM API with an organization-approved key and data policy.

**Open questions for stakeholders**
1. Which **internal services** should be the first real targets after the demo, and what are their agreed SLOs?
2. Is **Grafana Cloud k6** an approved tool, or must scale-out stay self-hosted (affects RM-19)?
3. **License:** an MIT `LICENSE` was added in RM-05, matching the original README's declaration, with "Mitesh Dandade" as copyright holder. Confirm the license and holder, or name the organization that should hold copyright.
4. Which channel should receive **alerts**: Slack, Teams or RingCentral (affects RM-13)?
5. What **data-handling policy** applies to sending performance summaries to an external AI provider (affects RM-15 and RM-20)?
6. The pipeline is **manual-only** as of 2026-11-07. Once RM-01 and RM-02 make results trustworthy, should automatic **PR smoke runs** or **scheduled runs** be added (affects RM-04, RM-10 and RM-13)?

---

## 9. Recommended Next Step

Phase 1 is essentially complete. Next steps, in order:

1. **Trigger the first manual GitHub Actions run** (smoke profile, browser test on). This closes the verification items for RM-03 and RM-18 and records the pipeline duration.
2. **Fix gap G9** (fabricated sitespeed.io metrics). It is small, and the dashboard currently mixes real and invented numbers.
3. **Finish RM-04** (SHA pinning and Dependabot, 2 h) and fix gap G10 (move `sample-app` to a supported Node.js LTS).
4. **Re-baseline RM-17.** The framework commit already covers most of Option B.
5. **Start RM-12** (baseline comparison and regression detection), which is now unblocked. It should also recalibrate the browser test's lab budgets.
6. **Ask a teammate to try `/new-k6-test`** with a fresh request, for an independent check of RM-16.

---

## 10. Change Log

| Date | Change |
|---|---|
| 2026-11-07 | Initial roadmap published. |
| 2026-11-07 | **RM-03 done.** `basic.yml` was moved to k6 v2.3.0 (`grafana/setup-k6-action@v1.2.2`) with the built-in web dashboard, `actions/checkout@v7.0.1` and `actions/upload-artifact@v7.0.2`. Go, xk6 and the archived `xk6-dashboard` extension were removed. |
| 2026-11-07 | **RM-04 partly done.** The trigger changed from `push` to manual-only (`workflow_dispatch`), the report uploads on failure, and a read-only token and 15-minute timeout were added. RM-08 and RM-10 were adjusted for manual runs, and open question 6 was added. Remaining effort was re-estimated: 251 h and 99 SP. |
| 2026-11-07 | **Framework commit (`d472e81`) reviewed.** It added `sample-app`, InfluxDB, Grafana, Jenkins, sitespeed.io and `k6/load-test.js`. RM-01 was re-scoped to target the owned sample app instead of QuickPizza. New gaps G9 (fabricated sitespeed.io metrics) and G10 (Node.js 20 end of life) were added. |
| 2026-11-07 | **RM-01, RM-02, RM-05, RM-08 and RM-18 done; RM-04 inputs and concurrency done.** Gaps G1, G2, G3 and G7 resolved. Remaining effort was re-estimated: 210 h (138 dev + 72 test) and 84 SP. |
| 2026-11-07 | **RM-16 done; RM-06 mostly done.** Added `CLAUDE.md`, the `/new-k6-test` skill and template, `buildOptions()`, the `k6/lib/http.js` helpers, `k6/tests/` with three generated tests, and the `test_script` workflow input. Full-shape runs passed every SLO: the 200 requests/s spike (14,660 requests, p95 65 ms, 0% errors) and the 20-VU load test on `/health` (5,084 requests, p99 60 ms, 0% errors). Open finding: the spike dropped about 1–2% of iterations with VUs to spare, a load-generator limit on the test laptop; confirm on a dedicated runner. The RM-18 browser budgets were corrected after they proved flaky (see RM-18). Remaining effort was re-estimated: 191 h (126 dev + 65 test) and 77 SP. |
