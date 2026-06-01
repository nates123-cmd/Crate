// @ts-check
// RISK #1 — Camelot wheel harmonic-compatibility scoring.
// Spec (CLAUDE.md "Things to flag"): "Don't approximate — implement it correctly."
// keyCompat: same key 1.0; adjacent ±1 same letter OR relative maj/minor 0.8;
// +7 energy-boost same letter 0.6; else 0. Wheel wraps at 12↔1.
// We call the app's REAL window.parseCamelot / window.keyCompat / window.musicalToCamelot.
const { test, expect } = require('./fixtures');

const kc = (page, a, b) => page.evaluate(([t, s]) => window.keyCompat(t, s), [a, b]);
const pc = (page, c) => page.evaluate((x) => window.parseCamelot(x), c);
const m2c = (page, s) => page.evaluate((x) => window.musicalToCamelot(x), s);

test.describe('parseCamelot', () => {
  test('parses valid Camelot codes', async ({ cratePage: page }) => {
    expect(await pc(page, '8A')).toEqual({ n: 8, l: 'A' });
    expect(await pc(page, '12B')).toEqual({ n: 12, l: 'B' });
    expect(await pc(page, '1a')).toEqual({ n: 1, l: 'A' }); // case-insensitive
    expect(await pc(page, ' 7b ')).toEqual({ n: 7, l: 'B' }); // trimmed
  });

  test('rejects out-of-range and malformed', async ({ cratePage: page }) => {
    expect(await pc(page, '0A')).toBeNull();
    expect(await pc(page, '13A')).toBeNull();
    expect(await pc(page, '8C')).toBeNull();
    expect(await pc(page, 'AB')).toBeNull();
    expect(await pc(page, '')).toBeNull();
    expect(await pc(page, null)).toBeNull();
  });
});

test.describe('keyCompat scoring', () => {
  test('identical key scores 1.0', async ({ cratePage: page }) => {
    expect(await kc(page, '8A', '8A')).toBe(1.0);
    expect(await kc(page, '12B', '12B')).toBe(1.0);
  });

  test('adjacent ±1 same letter scores 0.8', async ({ cratePage: page }) => {
    expect(await kc(page, '8A', '7A')).toBe(0.8);
    expect(await kc(page, '8A', '9A')).toBe(0.8);
  });

  test('wheel wraps: 12↔1 adjacent scores 0.8', async ({ cratePage: page }) => {
    expect(await kc(page, '12A', '1A')).toBe(0.8);
    expect(await kc(page, '1A', '12A')).toBe(0.8);
    expect(await kc(page, '12B', '1B')).toBe(0.8);
  });

  test('relative major/minor (same number, diff letter) scores 0.8', async ({ cratePage: page }) => {
    expect(await kc(page, '8A', '8B')).toBe(0.8);
    expect(await kc(page, '8B', '8A')).toBe(0.8);
  });

  test('+7 energy boost same letter scores 0.6', async ({ cratePage: page }) => {
    // forward = (t.n - s.n + 12) % 12 === 7. source 1A -> target 8A.
    expect(await kc(page, '8A', '1A')).toBe(0.6);
    // and the wrap case: source 8A -> target 3A (8+7=15 -> 3)
    expect(await kc(page, '3A', '8A')).toBe(0.6);
  });

  test('+7 is directional: the reverse (-7 / +5) is NOT an energy boost', async ({ cratePage: page }) => {
    // source 8A -> target 1A: forward = (1-8+12)%12 = 5, not 7. Should score 0.
    expect(await kc(page, '1A', '8A')).toBe(0);
  });

  test('energy boost only counts when letters match', async ({ cratePage: page }) => {
    expect(await kc(page, '8A', '1B')).toBe(0); // +7 number but letter differs
  });

  test('incompatible keys score 0', async ({ cratePage: page }) => {
    expect(await kc(page, '8A', '2A')).toBe(0);
    expect(await kc(page, '8A', '5B')).toBe(0);
  });

  test('null / unparseable inputs score 0', async ({ cratePage: page }) => {
    expect(await kc(page, null, '8A')).toBe(0);
    expect(await kc(page, '8A', null)).toBe(0);
    expect(await kc(page, 'garbage', '8A')).toBe(0);
  });
});

test.describe('musicalToCamelot mapping', () => {
  test('maps minor and major musical keys', async ({ cratePage: page }) => {
    expect(await m2c(page, 'Am')).toBe('8A');
    expect(await m2c(page, 'C')).toBe('8B');
    expect(await m2c(page, 'A min')).toBe('8A');
    expect(await m2c(page, 'C maj')).toBe('8B');
  });

  test('normalizes flats/sharps unicode glyphs', async ({ cratePage: page }) => {
    expect(await m2c(page, 'A♭m')).toBe('1A'); // A♭m
    expect(await m2c(page, 'B♭')).toBe('6B');  // B♭
  });

  test('passes through existing Camelot codes', async ({ cratePage: page }) => {
    expect(await m2c(page, '8a')).toBe('8A');
    expect(await m2c(page, '11B')).toBe('11B');
  });

  test('maps Open Key notation (m=minor->A, d=major->B)', async ({ cratePage: page }) => {
    expect(await m2c(page, '8m')).toBe('8A');
    expect(await m2c(page, '8d')).toBe('8B');
  });

  test('returns null for empty/unknown', async ({ cratePage: page }) => {
    expect(await m2c(page, '')).toBeNull();
    expect(await m2c(page, null)).toBeNull();
    expect(await m2c(page, 'Zz')).toBeNull();
  });
});
