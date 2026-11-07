# Local Performance Testing Framework

A centralized, containerized performance testing framework for local and CI/CD environments. It supports simultaneous load testing of backend APIs with **k6** and frontend web performance audits with **sitespeed.io**, with all metrics and request traces aggregated in real-time in **Grafana** via **InfluxDB**, and automated via **Jenkins**.

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

*   **Grafana** (`http://localhost:3000`): Pre-provisioned dashboards and InfluxDB datasources. Anonymous viewer access enabled by default (credentials: `admin`/`admin`).
*   **InfluxDB 1.8** (`http://localhost:8086`): Time-series database storing k6 metrics, custom traces, and sitespeed.io performance metrics.
*   **Jenkins** (`http://localhost:8081`): CI/CD orchestration server running automated test pipelines defined in `Jenkinsfile`.
*   **Sample App** (`http://localhost:8080`): Demo application offering an interactive frontend web page, high-performance API endpoints (`/api/items`), and simulated flaky endpoints (`/api/flaky`) for testing error tracking and root-cause tracing.
*   **k6 Runner**: Dockerized k6 execution profile streaming load metrics and failed request traces directly to InfluxDB.
*   **sitespeed.io Runner**: Dockerized sitespeed.io profile measuring Core Web Vitals (TTFB, FCP, LCP, CLS, Speed Index) and streaming to InfluxDB.

---

## Quick Start

### 1. Start Core Services

Start Grafana, InfluxDB, Jenkins, and the sample application in background:

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

### 1. Backend API Load Testing (k6)

Run the load test with automated run tagging:

```bash
# Baseline run
TEST_RUN_ID="baseline_v1" VUS=5 DURATION=20s ./scripts/run-k6.sh

# Stress run (to compare against baseline)
TEST_RUN_ID="stress_v2" VUS=15 DURATION=20s ./scripts/run-k6.sh
```

Or run via Docker Compose directly:
```bash
docker compose run --rm \
  -e TEST_RUN_ID="custom_run_1" \
  -e TARGET_HOST="http://sample-app:8080" \
  -e INFLUXDB_HOST="http://influxdb:8086" \
  k6 run --vus 5 --duration 15s /scripts/k6/load-test.js
```

### 2. Frontend Web Performance Audits (sitespeed.io)

Run sitespeed.io against your frontend:

```bash
./scripts/run-sitespeed.sh http://sample-app:8080/
```

This will run Chrome headless audits and export Google Web Vitals (TTFB, First Paint, DOMContentLoaded, Speed Index, Coach Score) to InfluxDB.

### 3. Verify Entire Stack & Ingested Data

To run automated end-to-end verification across all containers, databases, and metrics:

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
*   **Frontend Core Web Vitals**: TTFB, First Paint, DOMContentLoaded, and Speed Index from sitespeed.io.

### 2. Test Run Comparison
*   The dashboard includes **Test Run Comparison** panels:
    *   **Backend Test Run Comparison Table**: Compares total requests, avg latency, p95 latency, p99 latency, and failed request counts across test runs (`test_run_id`).
    *   **Side-by-Side Run Latency Comparison**: Dropdown filters (`Compare Run 1` vs `Compare Run 2`) allow plotting two specific runs on the same chart to evaluate performance improvements or regressions.

### 3. Detailed Request Failure Tracing & Debugging
When requests fail during backend tests (e.g., from `/api/flaky`):
*   **Detailed Failed Request Traces**: A dedicated table showing each failed request's unique `trace_id`, timestamp, URL, HTTP method, HTTP status code (e.g. 500, 502, 503), error message, and total duration.
*   **Latency Breakdown**: Breakdown showing connection handshake, Time-To-First-Byte (`ttfb`), and data transfer time for failed requests.
*   **Failure Distribution by Error Category**: Donut chart classifying failure types (e.g., `InternalServerError`, `ServiceUnavailable`).

---

## CI/CD Automation with Jenkins

The included `Jenkinsfile` provides a parameterized pipeline:

1.  Open Jenkins at `http://localhost:8081`.
2.  Create a **Pipeline** job pointing to this repository.
3.  Trigger **Build with Parameters**:
    *   `TEST_TYPE`: Choose `all`, `backend_k6`, or `frontend_sitespeed`.
    *   `TEST_RUN_ID`: Specify an identifier for run comparison or leave blank for timestamp-based tagging.
    *   `TARGET_API_URL`: Backend endpoint (default: `http://sample-app:8080`).
    *   `TARGET_WEB_URL`: Frontend URL (default: `http://sample-app:8080/`).
    *   `K6_VUS`: Concurrent virtual users.
    *   `K6_DURATION`: Test duration (e.g., `30s`, `1m`).

---

## Stopping the Framework

To stop all running services and clean up containers:

```bash
docker compose down
```

To remove all data volumes (resets InfluxDB, Grafana, Jenkins):

```bash
docker compose down -v
```
