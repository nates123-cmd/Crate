// @ts-check
// Shared fixture: loads the real Crate index.html and waits for init() to run.
// All specs import { test, expect } from here so they share one page-load pattern.
const base = require('@playwright/test');

const test = base.test.extend({
  cratePage: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // The app's inline <script> is a classic (non-module) script, so top-level
    // `function` declarations land on window automatically, but top-level
    // `const CONFIG/state/CAMELOT_MAP` are block-scoped and do NOT. To exercise
    // the REAL config/state/map (not copies), we append a re-export line just
    // before the script's closing tag in the SERVED response. This is additive:
    // the on-disk index.html is never modified, and the values exposed are the
    // very same objects the app's own functions close over.
    await page.route('**/index.html', async (route) => {
      const res = await route.fetch();
      let body = await res.text();
      const shim = '\ntry{window.CONFIG=CONFIG;window.state=state;window.CAMELOT_MAP=CAMELOT_MAP;}catch(e){}\n';
      const idx = body.lastIndexOf('</script>');
      if (idx !== -1) body = body.slice(0, idx) + shim + body.slice(idx);
      await route.fulfill({ response: res, body });
    });

    await page.goto('/index.html');
    // init() runs on DOMContentLoaded and defines/uses the window globals.
    await page.waitForFunction(() => typeof window.scoreTransition === 'function');
    // expose collected page errors for the smoke test
    // @ts-ignore
    page._crateErrors = errors;
    await use(page);
  },
});

module.exports = { test, expect: base.expect };
