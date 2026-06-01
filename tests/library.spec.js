// @ts-check
// RISK #3 — Library filtering/search + effectiveCrate ranking-pool scope.
// renderLibrary() filters window.state.crate by state.libQuery / state.libFilter and
// writes rows into #libBody + a count into #libCount. effectiveCrate() narrows the
// pool the rail ranks against (crateScope 'colored', crateRequireTxt).
// We drive the REAL functions by setting window.state and calling the real renderers.
const { test, expect } = require('./fixtures');

// Seed a small deterministic crate, then run the real renderLibrary().
async function seedAndRender(page, { crate, libQuery = '', libFilter = 'all', catches = [] }) {
  return page.evaluate((cfg) => {
    window.state.crate = cfg.crate;
    window.state.libQuery = cfg.libQuery;
    window.state.libFilter = cfg.libFilter;
    window.state.catches = cfg.catches;
    window.state.view = 'library';
    window.renderLibrary();
    return {
      rowCount: document.querySelectorAll('#libBody .lib-row').length,
      countText: document.getElementById('libCount').textContent,
      titles: Array.from(document.querySelectorAll('#libBody .lib-row-title')).map((e) => e.textContent),
    };
  }, { crate, libQuery, libFilter, catches });
}

const CRATE = [
  { id: 'a', title: 'Acid Eiffel', artist: 'Choice', bpm: 124, key_camelot: '8A', energy: 7, tags: ['acid'], colour: 'red', rating: 5, txt_enriched: true },
  { id: 'b', title: 'Da Funk', artist: 'Daft Punk', bpm: 110, key_camelot: '12A', energy: 6, tags: ['house'], rating: 3 },
  { id: 'c', title: 'The Bells', artist: 'Jeff Mills', bpm: 138, key_camelot: '10A', energy: 9, tags: ['techno'], colour: 'blue', rating: 4 },
  { id: 'd', title: 'Mystery', artist: 'Unknown', bpm: null, key_camelot: null, energy: null, tags: [] },
];

test.describe('renderLibrary search + filter', () => {
  test('no filter shows all tracks and a "N of N" count', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE });
    expect(r.rowCount).toBe(4);
    expect(r.countText).toContain('4 of 4 tracks');
  });

  test('text query matches title (case-insensitive)', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE, libQuery: 'acid' });
    expect(r.titles).toEqual(['Acid Eiffel']);
  });

  test('text query matches artist', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE, libQuery: 'daft' });
    expect(r.titles).toEqual(['Da Funk']);
  });

  test('text query matches Camelot key', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE, libQuery: '10a' });
    expect(r.titles).toEqual(['The Bells']);
  });

  test('BPM band filters: 100-120 is inclusive-low, exclusive-high', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE, libFilter: '100-120' });
    expect(r.titles).toEqual(['Da Funk']); // 110 only; 124 excluded
  });

  test('BPM band 120-130 excludes 130+', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE, libFilter: '120-130' });
    expect(r.titles).toEqual(['Acid Eiffel']); // 124; 138 excluded
  });

  test('BPM band 130+ is inclusive', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE, libFilter: '130+' });
    expect(r.titles).toEqual(['The Bells']); // 138
  });

  test('colored filter shows only tracks with a colour', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE, libFilter: 'colored' });
    expect(r.titles.sort()).toEqual(['Acid Eiffel', 'The Bells']);
  });

  test('rated4 includes 4 and 5 stars', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE, libFilter: 'rated4' });
    expect(r.titles.sort()).toEqual(['Acid Eiffel', 'The Bells']);
  });

  test('rated5 includes only 5 stars', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE, libFilter: 'rated5' });
    expect(r.titles).toEqual(['Acid Eiffel']);
  });

  test('txt filter shows only txt_enriched tracks', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE, libFilter: 'txt' });
    expect(r.titles).toEqual(['Acid Eiffel']);
  });

  test('starred filter keys off catches by title|artist', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, {
      crate: CRATE,
      libFilter: 'starred',
      catches: [{ title: 'The Bells', artist: 'Jeff Mills', starred: true }],
    });
    expect(r.titles).toEqual(['The Bells']);
  });

  test('rows are sorted ascending by BPM (null treated as 0, sorts first)', async ({ cratePage: page }) => {
    const r = await seedAndRender(page, { crate: CRATE });
    expect(r.titles).toEqual(['Mystery', 'Da Funk', 'Acid Eiffel', 'The Bells']);
  });
});

test.describe('effectiveCrate ranking-pool scope', () => {
  test('all scope returns the whole crate', async ({ cratePage: page }) => {
    const n = await page.evaluate((crate) => {
      window.state.crate = crate;
      window.state.crateScope = 'all';
      window.state.crateRequireTxt = false;
      return window.effectiveCrate().length;
    }, CRATE);
    expect(n).toBe(4);
  });

  test('colored scope keeps only coloured tracks', async ({ cratePage: page }) => {
    const n = await page.evaluate((crate) => {
      window.state.crate = crate;
      window.state.crateScope = 'colored';
      window.state.crateRequireTxt = false;
      return window.effectiveCrate().length;
    }, CRATE);
    expect(n).toBe(2);
  });

  test('crateRequireTxt narrows to txt_enriched, composable with scope', async ({ cratePage: page }) => {
    const n = await page.evaluate((crate) => {
      window.state.crate = crate;
      window.state.crateScope = 'colored';
      window.state.crateRequireTxt = true;
      return window.effectiveCrate().length;
    }, CRATE);
    expect(n).toBe(1); // only Acid Eiffel is both coloured and txt_enriched
  });

  test('rankRail respects effectiveCrate (colored scope shrinks the pool)', async ({ cratePage: page }) => {
    const r = await page.evaluate((crate) => {
      window.state.crate = crate;
      window.state.crateRequireTxt = false;
      const source = { bpm: 124, key_camelot: '8A', energy: 7, tags: ['acid'] };
      window.state.crateScope = 'all';
      const all = window.rankRail(source).length;
      window.state.crateScope = 'colored';
      const colored = window.rankRail(source).length;
      return { all, colored };
    }, CRATE);
    expect(r.colored).toBeLessThanOrEqual(r.all);
  });
});
