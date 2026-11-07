# Product Roadmap: K6-Demo

**Last updated:** 2026-11-07
**Owner:** Product Management (AI & Quality Engineering)
**Status:** Proposed. For review by Engineering and QA leads.

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
| `script.js` | k6 test script | 9 lines. Sends **1 iteration** of a single `GET` to `https://test-api.k6.io/public/crocodiles/`. Has no checks, no thresholds and no load profile. The `response` variable is never used. |
| `.github/workflows/basic.yml` | CI pipeline | Runs on `push` only. Installs Go, then builds a custom k6 binary from source with `xk6` and `xk6-dashboard@latest`. Runs the script and uploads an HTML dashboard report as an artifact. |
| `html-report.html` | Sample report | 161 KB generated k6 dashboard export committed to the repo. It is stale and carries an AGPL-3.0 header from Grafana Labs. |
| `README.md` | Documentation | Generic text with speculative wording ("This file likely defines…"). Claims an MIT license, but the repo has no `LICENSE` file. |

### 2.2 Strengths

- **Working end-to-end CI loop:** the workflow checks out the code, runs k6 and publishes a visual HTML report as a build artifact.
- **Rich visual reporting** through the k6 web dashboard export.
- **Simplified on purpose:** earlier versions imported unpinned remote JavaScript (`raw.githubusercontent.com/.../bundle.js`) and contained a broken `htmlReporter` reference. Both have been removed.
- **Low complexity:** the codebase is easy to restructure now, before other teams depend on it.

### 2.3 Critical gaps (verified 2026-11-07)

| # | Gap | Impact |
|---|---|---|
| G1 | **The test target is retired.** `test-api.k6.io/public/crocodiles/` now returns `302` and redirects to the `quickpizza.grafana.com` homepage. | Every CI run measures the wrong page and still reports success. **Results are currently meaningless.** |
| G2 | **No checks or thresholds.** | The build cannot fail on errors or slow responses, so it provides no quality gate. |
| G3 | **1 iteration, 1 virtual user (VU).** | This is a connectivity ping, not a load test. It produces no information about throughput, latency or saturation. |
| G4 | **CI builds k6 from source on every push**, using `@latest` versions. | Slow, non-reproducible builds. The step is also redundant: the web dashboard has been built into k6 since v0.49. |
| G5 | **The report upload is skipped when k6 fails.** | Once thresholds exist, the report would be missing exactly when it is needed. |
| G6 | **Push-only trigger.** There is no PR, manual or scheduled trigger, no `permissions` block, no concurrency control and no timeout. | No PR gating, no on-demand runs, and wider token permissions than necessary. |
| G7 | **Repo hygiene.** A generated artifact is committed, there is no `.gitignore` or `LICENSE`, and the README is inaccurate. | Confuses new contributors and creates licensing ambiguity. |
| G8 | **No structure for growth.** There are no environments, test data, shared helpers, scenarios or results history. | Each new test is a copy-paste fork, so the project cannot scale beyond a demo. |

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

| ID | Item | Phase | Priority | Impact | Feasibility | Dev (h) | Test (h) | SP |
|---|---|---|---|---|---|---:|---:|---:|
| RM-01 | Repoint the test to a live, configurable target | 1 | P0 | High | High | 2 | 1 | 1 |
| RM-02 | Add checks and threshold-based SLO gates | 1 | P0 | High | High | 3 | 2 | 2 |
| RM-03 | Replace the xk6 build with the built-in dashboard and the official action | 1 | P0 | High | High | 3 | 2 | 2 |
| RM-04 | Harden the CI workflow | 1 | P0 | High | High | 3 | 2 | 2 |
| RM-05 | Clean up the repo, license and README | 1 | P0 | Medium | High | 3 | 1 | 2 |
| RM-06 | Project structure and shared helper library | 2 | P1 | High | High | 8 | 4 | 5 |
| RM-07 | Environment configuration and secrets | 2 | P1 | High | High | 5 | 3 | 3 |
| RM-08 | Scenario library (smoke, load, stress, spike, soak, breakpoint) | 2 | P1 | High | High | 8 | 5 | 5 |
| RM-09 | Realistic multi-step user journey | 2 | P1 | High | Medium | 8 | 4 | 5 |
| RM-10 | CI results reporting (job summary, JUnit, PR comment) | 2 | P1 | High | High | 6 | 3 | 3 |
| RM-11 | Developer experience tooling | 2 | P1 | Medium | High | 6 | 2 | 3 |
| RM-12 | Baseline comparison and regression detection | 3 | P1 | High | Medium | 13 | 6 | 8 |
| RM-13 | Scheduled runs and alerting | 3 | P2 | Medium | High | 5 | 3 | 3 |
| RM-14 | Test generation from OpenAPI or Postman specs | 3 | P2 | High | Medium | 16 | 8 | 8 |
| RM-15 | AI results analyst | 3 | P2 | High | Medium | 12 | 8 | 8 |
| RM-16 | AI-assisted test authoring workflow | 3 | P2 | Medium | High | 6 | 4 | 3 |
| RM-17 | Historical trend dashboard | 4 | P2 | Medium | Medium | 16 | 6 | 8 |
| RM-18 | Frontend (browser) performance testing | 4 | P2 | Medium | Medium | 10 | 5 | 5 |
| RM-19 | Distributed and scale-out execution | 4 | P3 | Medium | Medium | 12 | 6 | 8 |
| RM-20 | AI SLO recommendation and anomaly detection | 4 | P3 | Medium | Low | 16 | 10 | 13 |
| RM-21 | Additional protocol coverage (WebSocket, gRPC) | 4 | P3 | Low | High | 8 | 4 | 5 |
| | **Total** | | | | | **169** | **89** | **102** |

### Phase summary

| Phase | Theme | Items | Dev (h) | Test (h) | Total (h) | SP | Indicative timing (1 engineer) |
|---|---|---|---:|---:|---:|---:|---|
| 1 | **Stabilize:** make results trustworthy | RM-01 to RM-05 | 14 | 8 | 22 | 9 | Sprint 1 (week 1) |
| 2 | **Foundation:** become a real framework | RM-06 to RM-11 | 41 | 21 | 62 | 24 | Sprints 2–3 (weeks 2–4) |
| 3 | **Insights and AI:** detect regressions and speed up the work | RM-12 to RM-16 | 52 | 29 | 81 | 30 | Sprints 4–5 (weeks 5–7) |
| 4 | **Scale and explore** | RM-17 to RM-21 | 62 | 31 | 93 | 39 | Sprint 6 onward (week 8+) |
| | **Total** | 21 items | **169** | **89** | **258** | **102** | About 9 weeks at ~30 productive h/week |

### Dependency map

```
RM-01 ─┬─> RM-02 ─┬─> RM-08 ─> RM-12 ─┬─> RM-15
       │          │                   ├─> RM-17 ─> RM-20
       │          └─> RM-10 ──────────┘
RM-03 ─┴─> RM-04 ─> RM-10, RM-13
RM-06 ─┬─> RM-07 ─> RM-09, RM-13, RM-19
       ├─> RM-08
       ├─> RM-14
       └─> RM-16
RM-05, RM-11, RM-18, RM-21: independent once Phase 1 is complete
```

---

## 5. Detailed Backlog

### Phase 1: Stabilize (P0)

**Goal:** every CI run produces a correct, reproducible and actionable result.

#### RM-01: Repoint the test to a live, configurable target
- **Description:** Replace the retired `test-api.k6.io` endpoint with Grafana's maintained demo application, QuickPizza (`https://quickpizza.grafana.com`). Read the base URL from `__ENV.BASE_URL`, with a default value, so the same script can target any environment.
- **Value:** fixes gap G1. Today's results measure an unrelated redirect target.
- **Acceptance criteria:**
  - The script calls a documented QuickPizza API endpoint and asserts a direct `200`, not a redirect.
  - `k6 run -e BASE_URL=<url> script.js` overrides the target.
  - The default load profile stays light (smoke level) to respect the shared public service.
- **Dev effort:** 2 h | **Test effort:** 1 h | **SP:** 1

#### RM-02: Add checks and threshold-based SLO gates
- **Description:** Add `check()` assertions for status code and response body shape. Define `thresholds` such as `http_req_failed: ['rate<0.01']`, `http_req_duration: ['p(95)<500']` and `checks: ['rate>0.99']`. Use `abortOnFail` for hard failures, and tag thresholds per endpoint.
- **Value:** fixes gap G2. k6 exits non-zero on an SLO breach, which turns CI into a real quality gate.
- **Acceptance criteria:**
  - Breaching any threshold fails the CI job.
  - A deliberately broken URL or an artificially strict threshold is shown to fail the job (negative test).
  - The SLO values are documented in the README with their rationale.
- **Dev effort:** 3 h | **Test effort:** 2 h | **SP:** 2

#### RM-03: Replace the xk6 build with the built-in dashboard and the official action
- **Description:**
  - Remove the Go setup, the `xk6` install and the custom binary build.
  - Use `grafana/setup-k6-action` with a **pinned k6 version**.
  - Enable the built-in web dashboard with `K6_WEB_DASHBOARD=true` and `K6_WEB_DASHBOARD_EXPORT=test-report.html`.
- **Value:** fixes gap G4. The pipeline gets faster, reproducible versions and fewer moving parts and supply-chain inputs.
- **Acceptance criteria:**
  - The workflow has no Go or xk6 steps.
  - The k6 version is pinned explicitly.
  - The HTML report renders the same panels as today.
  - Pipeline duration before and after is recorded in the PR.
- **Dev effort:** 3 h | **Test effort:** 2 h | **SP:** 2

#### RM-04: Harden the CI workflow
- **Description:**
  - Add `pull_request` and `workflow_dispatch` triggers. The manual trigger takes inputs for test type and target URL.
  - Add `if: always()` to the report upload step.
  - Add `permissions: contents: read`, a `concurrency` group and `timeout-minutes`.
  - Pin third-party actions to commit SHAs and enable Dependabot for Actions.
- **Value:** fixes gaps G5 and G6. The workflow gates PRs, supports on-demand runs, always publishes evidence and follows least privilege.
- **Acceptance criteria:**
  - A failing run still uploads its report.
  - Runs can be started manually from the Actions tab with inputs.
  - Superseded runs on the same branch are cancelled.
  - Dependabot opens PRs for action updates.
- **Dev effort:** 3 h | **Test effort:** 2 h | **SP:** 2

#### RM-05: Clean up the repo, license and README
- **Description:**
  - Remove the committed `html-report.html` (reports belong in CI artifacts) and add a `.gitignore` for `*.html` reports and `*.json` results.
  - Add a `LICENSE` file and confirm compatibility with the AGPL-licensed dashboard assets that k6 embeds in the exported reports.
  - Rewrite the README to match reality: prerequisites, local run, CI behaviour, SLOs, and how to read the report.
  - Add a short `CONTRIBUTING.md`.
- **Value:** fixes gap G7. Faster onboarding and no licensing ambiguity.
- **Acceptance criteria:**
  - No generated files are tracked.
  - The README contains no speculative wording.
  - A new engineer can run the test locally in under 10 minutes by following only the README.
- **Dev effort:** 3 h | **Test effort:** 1 h | **SP:** 2

---

### Phase 2: Foundation (P1)

**Goal:** a maintainable framework that any team can extend with new APIs and load profiles without copy-paste.

#### RM-06: Project structure and shared helper library
- **Description:** Restructure the repo into these directories:

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
- **Dev effort:** 8 h | **Test effort:** 4 h | **SP:** 5

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

#### RM-08: Scenario library
- **Description:**
  - Define reusable `scenarios` built on k6 executors:

    | Test type | Executor |
    |---|---|
    | Smoke | `shared-iterations` |
    | Load | `ramping-vus` |
    | Stress | `ramping-arrival-rate` |
    | Spike | `ramping-arrival-rate` |
    | Soak | `constant-vus`, long duration |
    | Breakpoint | `ramping-arrival-rate`, increasing until failure |

  - Select a scenario with `-e TEST_TYPE=load`.
  - Use **smoke** on every PR, and **load** on merges to `main` or manual runs only.
- **Value:** fixes gap G3. This is the core capability of a load testing product.
- **Acceptance criteria:**
  - Each test type runs from a single flag.
  - Each type has its own default thresholds.
  - The README contains a table describing when to use each type.
- **Dev effort:** 8 h | **Test effort:** 5 h | **SP:** 5

#### RM-09: Realistic multi-step user journey
- **Description:** Model a real flow against QuickPizza: authenticate, then request a recommendation, then rate it. Use `group()` per step, request tags, correlation of dynamic values (tokens and IDs), randomized think time (`sleep`), and parameterized data.
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
  4. A sticky PR comment with the key metrics and threshold pass/fail status.
- **Value:** results are visible in seconds on the PR page, with no need to download artifacts.
- **Acceptance criteria:**
  - Every run shows p95, p99, error rate, RPS and threshold status in the job summary.
  - PRs receive one comment that updates on each run.
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

#### RM-16: AI-assisted test authoring workflow
- **Description:**
  - Add a repo-level `CLAUDE.md` that describes project conventions, helpers, scenario types and SLO defaults.
  - Add reusable prompt templates or slash commands, for example: "create a spike test for `/api/pizza` at 200 requests/s with p95 < 800 ms".
  - AI coding assistants then generate scripts that match the framework instead of ad-hoc code.
- **Value:** consistent, convention-following tests from natural-language requests, at low cost.
- **Acceptance criteria:**
  - Three sample natural-language requests produce scripts that pass lint and smoke runs without manual restructuring.
- **Dev effort:** 6 h | **Test effort:** 4 h | **SP:** 3
- **Dependencies:** RM-06, RM-08

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

#### RM-18: Frontend (browser) performance testing
- **Description:** Add `k6/browser` tests that capture Core Web Vitals (LCP, CLS, INP) and page-level timings. Optionally run them in a hybrid scenario alongside API load to measure user experience under backend stress.
- **Value:** extends coverage from API latency to real end-user experience.
- **Acceptance criteria:**
  - A browser smoke test runs headless in CI.
  - Web Vitals appear in the report, with thresholds.
- **Dev effort:** 10 h | **Test effort:** 5 h | **SP:** 5

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
| Correctness of the CI performance signal | Measures a redirect target and never fails | Tests the intended API, with an enforced SLO gate |
| CI performance job duration (smoke) | Includes a Go install and a from-source k6 build | Under 2 minutes end to end |
| PRs gated by a performance check | 0% (push-only trigger) | 100% of PRs to `main` |
| Time to author a new API test | Ad hoc copy and edit | Under 30 minutes, using templates or generation (RM-14, RM-16) |
| Regressions caught before merge | Not measured | 80% or more of seeded regressions detected (RM-12) |
| Time to understand a failed run | Download and inspect the HTML report manually | Under 5 minutes, using the PR summary and AI analysis |

---

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Heavy load against the shared public demo service (QuickPizza) is unethical and may be rate-limited | Medium | Medium | Limit PR runs to smoke profiles. Run heavier profiles only against owned environments, enforced by the RM-07 guard. |
| GitHub-hosted runners give noisy, variable results | High | Medium | Use relative comparison with tolerance bands and repeated baselines (RM-12). Use larger runners or RM-19 for serious load. |
| Unpinned dependencies (`@latest`, remote jslib imports) break builds or introduce supply-chain risk | Medium | High | Pin the k6 version, action SHAs and jslib versions. Add Dependabot (RM-03, RM-04). |
| AI features leak sensitive data or give confident but wrong analysis | Medium | High | Sanitize payloads, keep AI output advisory, evaluate it against seeded scenarios, and require human review of generated tests (RM-14, RM-15). |
| AGPL-licensed report assets conflict with the intended project license | Low | Medium | Stop committing generated reports and complete the license review in RM-05. |
| AI API costs grow with run frequency | Low | Low | Run analysis only on failures, regressions or `main`. Cap tokens per run. |

---

## 8. Assumptions and Open Questions

**Assumptions**
- The near-term target system is the QuickPizza demo. Internal APIs are onboarded through RM-07 once environments and credentials are available.
- GitHub Actions remains the CI platform.
- AI features use an externally hosted LLM API with an organization-approved key and data policy.

**Open questions for stakeholders**
1. Which **internal services** should be the first real targets after the demo, and what are their agreed SLOs?
2. Is **Grafana Cloud k6** an approved tool, or must scale-out stay self-hosted (affects RM-19)?
3. What **license** should the repository carry (affects RM-05)?
4. Which channel should receive **alerts**: Slack, Teams or RingCentral (affects RM-13)?
5. What **data-handling policy** applies to sending performance summaries to an external AI provider (affects RM-15 and RM-20)?

---

## 9. Recommended Next Step

Approve **Phase 1 (22 hours, about one sprint)** immediately. It fixes a misleading CI signal at minimal cost and unblocks every later phase. Review Phase 2 scope at the Sprint 1 demo.
