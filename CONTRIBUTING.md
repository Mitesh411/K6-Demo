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

- **If you changed thresholds or scenarios**, check that every profile still resolves:

  ```bash
  for p in smoke load stress spike soak breakpoint; do
    k6 inspect --execution-requirements -e LOAD_PROFILE=$p k6/load-test.js > /dev/null && echo "$p ok"
  done
  ```

- **If you changed the browser test**, run it once: `k6 run -e TARGET_HOST=http://localhost:8080 k6/browser-test.js`.

## Conventions

- **Scenarios and thresholds** live in `k6/config/`. Add a new load profile there instead of hard-coding `options` in a test.
- **Shared code** (environment settings, tracing) lives in `k6/lib/`.
- **Keep Grafana working:** keep the `name` and `test_run_id` request tags and the `failed_requests_trace` measurement format, which the dashboard queries.
- **Gate only on what you own:** SLO thresholds use the `endpoint` tag so that deliberately failing endpoints and telemetry calls do not count.
- **No generated files in git:** reports, screenshots and results go to `reports/` (ignored) or CI artifacts.
- **Pin versions** of k6, Docker images and GitHub Actions. Avoid `latest`.
- **No secrets in code:** pass credentials through environment variables or CI secrets.
