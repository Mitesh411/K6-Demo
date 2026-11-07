// Builds k6 `options` from the scenario library and the SLO templates, so every
// test gets the same load profiles, thresholds and tags.
//
//   export const options = buildOptions({
//     defaultProfile: 'spike',                    // used when LOAD_PROFILE is not set
//     endpoints: ['items'],                       // endpoint tags to gate with SLOs
//     scenario: { stages: [...] },                // optional: custom shape for defaultProfile
//     thresholds: { 'http_req_duration{endpoint:items}': ['p(95)<800'] }, // optional
//   });
//
// `-e LOAD_PROFILE=<name>` always wins. Custom `scenario` and `thresholds`
// apply only when the test runs its own defaultProfile, so any test can still
// be run as a plain smoke test for validation.

import { SCENARIOS, LOAD_PROFILES } from '../config/scenarios.js';
import { thresholdsFor } from '../config/thresholds.js';
import { TEST_RUN_ID } from './env.js';

export function resolveProfile(defaultProfile = 'smoke') {
  const profile = (__ENV.LOAD_PROFILE || defaultProfile).toLowerCase();
  if (!LOAD_PROFILES.includes(profile)) {
    throw new Error(`Unknown LOAD_PROFILE "${profile}". Use one of: ${LOAD_PROFILES.join(', ')}.`);
  }
  return profile;
}

export function buildOptions({
  defaultProfile = 'smoke',
  endpoints,
  scenario = {},
  thresholds = {},
  tags = {},
} = {}) {
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    throw new Error('buildOptions: list the endpoint tags to gate, e.g. { endpoints: ["items"] }.');
  }
  const profile = resolveProfile(defaultProfile);
  const isOwnProfile = profile === defaultProfile;

  return {
    scenarios: {
      [profile]: isOwnProfile ? { ...SCENARIOS[profile], ...scenario } : SCENARIOS[profile],
    },
    thresholds: {
      ...thresholdsFor(profile, endpoints),
      ...(isOwnProfile ? thresholds : {}),
    },
    tags: { test_run_id: TEST_RUN_ID, load_profile: profile, ...tags },
  };
}
