# Contributing

Thanks for helping improve this performance testing framework.

## Workflow

1. Create a branch from `main`: `git checkout -b feature/<short-name>`.
2. Make your change and run the checks below locally.
3. Open a pull request describing what changed and how you verified it.

## Before opening a pull request

- **Run a smoke test** against the sample app and confirm k6 exits with code `0`:

  ```bash
  node sample-app/app.js &
  k6 run -e TARGET_HOST=http://localhost:8080 k6/load-test.js
  ```

- **If you added or changed a test in `k6/tests/`**, run it as a smoke test: `k6 run -e TARGET_HOST=http://localhost:8080 -e LOAD_PROFILE=smoke k6/tests/<file>.js`.

- **If you changed `k6/config/` or `k6/lib/`**, check that every profile still resolves for every test:

  ```bash
  for f in k6/load-test.js k6/tests/*.js; do
    for p in smoke load stress spike soak breakpoint; do
      k6 inspect --execution-requirements -e LOAD_PROFILE=$p "$f" > /dev/null || echo "FAILED: $f ($p)"
    done
  done
  ```

- **If you changed the browser test**, run it once: `k6 run -e TARGET_HOST=http://localhost:8080 k6/browser-test.js`.

## Conventions

- **New tests** go in `k6/tests/<kebab-case-name>.js`, one scenario per file. Start from `.claude/skills/new-k6-test/template.js`, or ask Claude Code: `/new-k6-test <what to test>`. The full rules are in [CLAUDE.md](CLAUDE.md).
- **Options:** build them with `buildOptions()` from `k6/lib/options.js`; don't hand-write `scenarios` or `thresholds`. Load profiles live in `k6/config/scenarios.js` and SLO templates in `k6/config/thresholds.js`.
- **Requests and checks:** use `tracedRequest()` and `checkEndpoint()` from `k6/lib/http.js`, so tags, trace headers and SLO scoping stay consistent. Call `reportFailure()` when checks fail.
- **Keep Grafana working:** keep the `name` and `test_run_id` request tags and the `failed_requests_trace` measurement format, which the dashboard queries.
- **Gate only on what you own:** SLO thresholds use the `endpoint` tag so that deliberately failing endpoints and telemetry calls do not count.
- **No generated files in git:** reports, screenshots and results go to `reports/` (ignored) or CI artifacts.
- **Pin versions** of k6, Docker images and GitHub Actions. Avoid `latest`.
- **No secrets in code:** pass credentials through environment variables or CI secrets.
