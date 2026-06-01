// @ts-check
// RISK #2 — Track ranking / suggestion scoring (intent-steerable ranking).
// scoreTransition = w.key*keyCompat + w.bpm*bpmCompat + w.energy*energyMatch
//                 + w.tags*tagOverlap + w.freshness*freshness
// rankRail filters score>0, sorts desc, slices to CONFIG.railSize.
// We exercise the REAL window.scoreTransition / window.rankRail / window.bpmCompat /
// window.energyMatch / window.tagOverlap against window.state.crate.
const { test, expect } = require('./fixtures');

const bpm = (page, t, s) => page.evaluate(([a, b]) => window.bpmCompat(a, b), [t, s]);
const em = (page, t, s) => page.evaluate(([a, b]) => window.energyMatch(a, b), [t, s]);
const to = (page, a, b) => page.evaluate(([x, y]) => window.tagOverlap(x, y), [a, b]);

test.describe('bpmCompat', () => {
  test('identical BPM scores 1.0', async ({ cratePage: page }) => {
    expect(await bpm(page, 124, 124)).toBe(1.0);
  });

  test('within perfect tolerance (3%) scores 1.0', async ({ cratePage: page }) => {
    // 124 vs 124 -> 0%, 124 vs 127 -> ~2.4% < 3%
    expect(await bpm(page, 127, 124)).toBe(1.0);
  });

  test('at/over zero tolerance (8%) scores 0', async ({ cratePage: page }) => {
    expect(await bpm(page, 134, 124)).toBe(0); // ~8.1%
    expect(await bpm(page, 200, 124)).toBe(0);
  });

  test('between perfect and zero falls off linearly', async ({ cratePage: page }) => {
    const v = await bpm(page, 130, 124); // ~4.8% -> between 3% and 8%
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  test('null inputs score 0', async ({ cratePage: page }) => {
    expect(await bpm(page, null, 124)).toBe(0);
    expect(await bpm(page, 124, null)).toBe(0);
  });
});

test.describe('energyMatch', () => {
  test('identical energy scores 1.0', async ({ cratePage: page }) => {
    expect(await em(page, 7, 7)).toBe(1.0);
  });

  test('falls off by 0.1 per energy step', async ({ cratePage: page }) => {
    expect(await em(page, 8, 7)).toBeCloseTo(0.9, 5);
    expect(await em(page, 4, 7)).toBeCloseTo(0.7, 5);
  });

  test('caps the penalty at distance 10', async ({ cratePage: page }) => {
    expect(await em(page, 0, 10)).toBe(0);
    expect(await em(page, 0, 20)).toBe(0); // clamped, never negative
  });

  test('missing energy defaults to neutral 0.5', async ({ cratePage: page }) => {
    expect(await em(page, null, 7)).toBe(0.5);
    expect(await em(page, 7, null)).toBe(0.5);
  });
});

test.describe('tagOverlap (Jaccard)', () => {
  test('identical tag sets score 1.0', async ({ cratePage: page }) => {
    expect(await to(page, ['house', 'acid'], ['house', 'acid'])).toBe(1.0);
  });

  test('partial overlap = intersection / union', async ({ cratePage: page }) => {
    // {a,b} vs {b,c}: inter 1, union 3 -> 0.333
    expect(await to(page, ['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3, 5);
  });

  test('no overlap scores 0', async ({ cratePage: page }) => {
    expect(await to(page, ['a'], ['b'])).toBe(0);
  });

  test('empty / null arrays score 0', async ({ cratePage: page }) => {
    expect(await to(page, [], ['a'])).toBe(0);
    expect(await to(page, null, ['a'])).toBe(0);
  });
});

test.describe('scoreTransition', () => {
  test('a perfect self-transition maxes every weighted term', async ({ cratePage: page }) => {
    const r = await page.evaluate(() => {
      const t = { bpm: 124, key_camelot: '8A', energy: 7, tags: ['house', 'acid'] };
      return window.scoreTransition(t, t);
    });
    // key 1 + bpm 1 + energy 1 + tags 1 + freshness 1, weights sum to 1.0
    expect(r.total).toBeCloseTo(1.0, 5);
    expect(r.breakdown).toMatchObject({ key: 1, bpm: 1, energy: 1, tags: 1, freshness: 1 });
  });

  test('total equals weighted sum of breakdown', async ({ cratePage: page }) => {
    const r = await page.evaluate(() => {
      const source = { bpm: 124, key_camelot: '8A', energy: 7, tags: ['house'] };
      const target = { bpm: 130, key_camelot: '9A', energy: 9, tags: ['techno'] };
      const w = window.CONFIG.weights;
      const s = window.scoreTransition(source, target);
      const recomputed = w.key * s.breakdown.key + w.bpm * s.breakdown.bpm +
        w.energy * s.breakdown.energy + w.tags * s.breakdown.tags +
        w.freshness * s.breakdown.freshness;
      return { total: s.total, recomputed };
    });
    expect(r.total).toBeCloseTo(r.recomputed, 10);
  });
});

test.describe('rankRail', () => {
  test('returns at most CONFIG.railSize items, sorted descending by score', async ({ cratePage: page }) => {
    const r = await page.evaluate(() => {
      const source = { bpm: 124, key_camelot: '8A', energy: 7, tags: ['house', 'acid', 'classic'] };
      const rail = window.rankRail(source);
      return {
        len: rail.length,
        railSize: window.CONFIG.railSize,
        scores: rail.map((x) => x.score),
        ranks: rail.map((x) => x.rank),
      };
    });
    expect(r.len).toBeLessThanOrEqual(r.railSize);
    expect(r.len).toBeGreaterThan(0);
    // descending
    for (let i = 1; i < r.scores.length; i++) {
      expect(r.scores[i - 1]).toBeGreaterThanOrEqual(r.scores[i]);
    }
    // ranks are 1..n
    expect(r.ranks).toEqual(r.ranks.map((_, i) => i + 1));
  });

  test('every rail item carries a non-empty reason and breakdown', async ({ cratePage: page }) => {
    const r = await page.evaluate(() => {
      const source = { bpm: 124, key_camelot: '8A', energy: 7, tags: ['house', 'acid'] };
      return window.rankRail(source).map((x) => ({
        reason: x.reason, hasBreakdown: !!x.breakdown, score: x.score,
      }));
    });
    expect(r.length).toBeGreaterThan(0);
    for (const item of r) {
      expect(typeof item.reason).toBe('string');
      expect(item.reason.length).toBeGreaterThan(0);
      expect(item.hasBreakdown).toBe(true);
      expect(item.score).toBeGreaterThan(0);
    }
  });

  test('a source with no key and no BPM returns an empty rail', async ({ cratePage: page }) => {
    const len = await page.evaluate(() =>
      window.rankRail({ bpm: null, key_camelot: null, energy: null, tags: [] }).length);
    expect(len).toBe(0);
  });

  test('excludes zero-score tracks (all results have score > 0)', async ({ cratePage: page }) => {
    const allPositive = await page.evaluate(() => {
      const source = { bpm: 124, key_camelot: '8A', energy: 7, tags: ['house'] };
      return window.rankRail(source).every((x) => x.score > 0);
    });
    expect(allPositive).toBe(true);
  });
});
