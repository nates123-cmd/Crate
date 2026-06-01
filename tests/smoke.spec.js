// @ts-check
// BOOT / SMOKE — the real index.html loads, init() wires up, no uncaught page errors,
// the three-zone cockpit (Stage / Rail / Log) renders, and the expected window globals exist.
const { test, expect } = require('./fixtures');

test('app boots with no uncaught page errors', async ({ cratePage: page }) => {
  // give any deferred work a tick
  await page.waitForTimeout(200);
  // @ts-ignore — populated by the fixture
  expect(page._crateErrors).toEqual([]);
});

test('core window globals are present after init', async ({ cratePage: page }) => {
  const present = await page.evaluate(() => {
    const names = [
      'parseCamelot', 'keyCompat', 'bpmCompat', 'energyMatch', 'tagOverlap',
      'scoreTransition', 'rankRail', 'reasonFor', 'musicalToCamelot',
      'effectiveCrate', 'renderLibrary', 'colourToCss',
    ];
    const fns = names.filter((n) => typeof window[n] === 'function');
    return {
      missing: names.filter((n) => typeof window[n] !== 'function'),
      hasConfig: !!window.CONFIG && typeof window.CONFIG.weights === 'object',
      hasState: !!window.state && Array.isArray(window.state.crate),
      hasCamelotMap: !!window.CAMELOT_MAP,
      fnCount: fns.length,
    };
  });
  expect(present.missing).toEqual([]);
  expect(present.hasConfig).toBe(true);
  expect(present.hasState).toBe(true);
  expect(present.hasCamelotMap).toBe(true);
});

test('CONFIG ranking weights sum to 1.0', async ({ cratePage: page }) => {
  const sum = await page.evaluate(() => {
    const w = window.CONFIG.weights;
    return w.key + w.bpm + w.energy + w.tags + w.freshness;
  });
  expect(sum).toBeCloseTo(1.0, 10);
});

test('three-zone cockpit renders (stage, rail, log present in DOM)', async ({ cratePage: page }) => {
  await expect(page.locator('#stage')).toHaveCount(1);
  await expect(page.locator('#railBody')).toHaveCount(1);
  // Log / catch list region exists
  const hasLog = await page.evaluate(() => !!document.querySelector('.log, #log, [class*="log"]'));
  expect(hasLog).toBe(true);
});

test('mock crate seeds with the expected number of tracks', async ({ cratePage: page }) => {
  const n = await page.evaluate(() => window.state.crate.length);
  expect(n).toBeGreaterThanOrEqual(20); // MOCK_CRATE has 24
});
