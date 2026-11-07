---
name: new-k6-test
description: Create a new k6 performance test in this repo from a plain-English request (endpoint, load shape, SLOs), following the framework's conventions, then validate it. Use when asked to write, add or generate a k6 load, stress, spike, soak, smoke or breakpoint test.
argument-hint: "<what to test, e.g. a spike test for /api/items at 200 requests/s with p95 < 800 ms>"
allowed-tools: Read Grep Glob Write Edit Bash(k6 inspect *) Bash(k6 run *) Bash(node sample-app/app.js*) Bash(curl -s *)
---

# Create a k6 test

Request: **$ARGUMENTS**

Follow the conventions in the repository's `CLAUDE.md`. The template is [template.js](template.js); finished examples are in `k6/tests/`.

## 1. Understand the request

Extract the following, and ask the user only if the endpoint or the intent is genuinely unclear:

| Field | How to decide |
|---|---|
| Endpoint(s) | Paths to call. Confirm each one exists in `sample-app/app.js` (or the target the user names). |
| Endpoint tag | Short, stable tag per endpoint: `/api/items` → `items`, `/health` → `health`. |
| Load profile | The closest of `smoke`, `load`, `stress`, `spike`, `soak`, `breakpoint` (see `k6/config/scenarios.js`). "N requests/s" means an arrival-rate profile (`stress`, `spike` or `breakpoint`); "N users" or "N VUs" means `load` or `soak`. |
| Custom shape | Only what differs from the library profile, e.g. new `stages` or a fixed `duration`. Keep the profile's executor unless the request needs another one. |
| SLOs | Limits the user stated, as `thresholds` keyed by endpoint tag. A key you set **replaces** the profile's default for that key, so carry over the default limits you are not changing (e.g. user says p95 < 800 ms on `spike` → `['p(95)<800', 'p(99)<2000']`). Keys you don't set keep the defaults from `k6/config/thresholds.js`. |
| Checks | Status code plus at least one body or header assertion based on the real response in `sample-app/app.js`. |

For arrival-rate shapes, size `preAllocatedVUs` at about peak rate × (expected response time + 0.1 s) × 3, with a minimum of 20, and `maxVUs` at 2–3 times that. Steep ramps need the upper end, because k6 cannot start VUs instantly. In a full run, `dropped_iterations` should be 0; if it isn't, the requested load was not fully applied. If `vus_max` reached `maxVUs`, raise the VU limits. If VUs were to spare, the machine generating load is the limit (common when k6 and the target share one laptop), so say so instead of tuning further.

## 2. Write the test

1. Copy [template.js](template.js) to `k6/tests/<kebab-case-name>.js` and replace every `__PLACEHOLDER__`.
2. Delete template comments that no longer apply. Keep the header comment that states the request in one sentence.
3. Do not edit `k6/config/` or `k6/lib/` for a single test. If a new shared profile or helper is really needed, say so and ask first.

## 3. Validate

Run these and fix any failure before finishing:

```bash
k6 inspect -e LOAD_PROFILE=<default profile> k6/tests/<file>.js
```

Compare `scenarios` and `thresholds` in the output with the request.

```bash
curl -s http://localhost:8080/health || (node sample-app/app.js &)
k6 run -e TARGET_HOST=http://localhost:8080 -e LOAD_PROFILE=smoke k6/tests/<file>.js
```

The smoke run must exit `0`. Do not run the full heavy profile unless the user asks.

## 4. Report back

- The file path, the profile and custom shape, and the thresholds in effect.
- The validation results (inspect, and smoke exit code with p95).
- The command for the full run: `k6 run -e TARGET_HOST=... k6/tests/<file>.js`. In GitHub Actions, use the `test_script` and `load_profile` inputs.
