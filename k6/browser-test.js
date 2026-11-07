// Frontend (browser) performance test for the sample app's web page.
// Uses the k6 browser module to load the page in headless Chromium, verify the
// page renders the items fetched from the API, and gate on Core Web Vitals.
//
//   TARGET_HOST  base URL of the web app (default: http://sample-app:8080)
//
// Thresholds follow Google's "good" Web Vitals targets (75th percentile).

import { browser } from 'k6/browser';
import { check } from 'k6';
import { TARGET_HOST, TEST_RUN_ID } from './lib/env.js';

export const options = {
  scenarios: {
    ui: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 3,
      maxDuration: '2m',
      options: {
        browser: { type: 'chromium' },
      },
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
    browser_web_vital_lcp: ['p(75)<2500'],
    browser_web_vital_fcp: ['p(75)<1800'],
    browser_web_vital_cls: ['p(75)<0.1'],
    browser_web_vital_ttfb: ['p(75)<800'],
  },
  tags: { test_run_id: TEST_RUN_ID },
};

export default async function () {
  const page = await browser.newPage();
  try {
    await page.goto(`${TARGET_HOST}/`, { waitUntil: 'networkidle' });

    const heading = await page.locator('h1').textContent();

    // The page fetches /api/items and renders the result inside #content.
    const result = page.locator('#content p');
    await result.waitFor({ state: 'visible', timeout: 10000 });
    const resultText = await result.textContent();

    check(null, {
      'page heading is rendered': () => heading === 'Performance Testing Portal',
      'items loaded from the API': () => /Loaded \d+ items/.test(resultText || ''),
    });

    await page.screenshot({ path: 'reports/browser-test.png' });
  } finally {
    await page.close();
  }
}
