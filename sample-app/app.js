const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 8080;

let requestCounter = 0;

const server = http.createServer((req, res) => {
  requestCounter++;
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const traceId = req.headers['x-trace-id'] || `srv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Default headers
  res.setHeader('X-Trace-ID', traceId);
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
  }

  // Frontend web page for sitespeed.io testing
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sample Performance Web App</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; background: #f8fafc; color: #1e293b; }
    h1 { color: #0284c7; }
    .card { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-top: 20px; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-weight: bold; }
    button { background: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Performance Testing Portal</h1>
  <div class="card">
    <p>This web application is monitored in real-time by <strong>sitespeed.io</strong> and tested by <strong>k6</strong>.</p>
    <p>Trace ID: <span class="badge" id="trace">${traceId}</span></p>
    <div id="content">Loading items...</div>
  </div>
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      fetch('/api/items')
        .then(r => r.json())
        .then(data => {
          document.getElementById('content').innerHTML = '<p>Loaded ' + data.items.length + ' items from API successfully.</p>';
        })
        .catch(err => {
          document.getElementById('content').innerHTML = '<p style="color:red">Error loading items</p>';
        });
    });
  </script>
</body>
</html>`);
  }

  // Backend API items
  if (pathname === '/api/items') {
    // Artificial latency between 10ms - 50ms
    const latency = 10 + Math.floor(Math.random() * 40);
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        traceId: traceId,
        items: [
          { id: 1, name: 'Performance Monitor Agent', status: 'active' },
          { id: 2, name: 'Distributed Load Engine', status: 'active' },
          { id: 3, name: 'Synthetic Trace Collector', status: 'ready' }
        ]
      }));
    }, latency);
    return;
  }

  // Failing / Flaky API for tracing verification
  if (pathname === '/api/flaky') {
    // 60% chance of failure to trigger failed request tracing
    const fail = Math.random() < 0.6;
    setTimeout(() => {
      if (fail) {
        const errorTypes = [
          { status: 500, msg: 'Database connection pool exhausted' },
          { status: 502, msg: 'Bad gateway: upstream microservice timeout' },
          { status: 503, msg: 'Service unavailable: rate limit exceeded' }
        ];
        const error = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        res.writeHead(error.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: true,
          status: error.status,
          message: error.msg,
          traceId: traceId,
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'success',
          traceId: traceId,
          message: 'Flaky call succeeded'
        }));
      }
    }, 30);
    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found', path: pathname }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sample performance app listening on port ${PORT}`);
});
