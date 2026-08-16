require('dotenv').config();

const { test: base, expect } = require('@playwright/test');
const { healLocator } = require('./self-healer.js');

const FAST_TIMEOUT = 3_000;

async function withHeal(page, originalSelector, action) {
  try {
    // Fail fast: if element is not attached within 3s, trigger healing
    await page.locator(originalSelector).waitFor({ state: 'attached', timeout: FAST_TIMEOUT });
    await action(page.locator(originalSelector));
  } catch (err) {
    const result = await healLocator(page, originalSelector, err);
    if (!result.success || !result.newLocator) throw err;

    // Evaluate LLM-returned string to a live Playwright Locator
    const healedLocator = new Function('page', `return ${result.newLocator}`)(page);
    await action(healedLocator);
  }
}

const test = base.extend({
  healPage: async ({ page }, use) => {
    await use({
      click:        (selector)        => withHeal(page, selector, (loc) => loc.click()),
      fill:         (selector, value) => withHeal(page, selector, (loc) => loc.fill(value)),
      selectOption: (selector, value) => withHeal(page, selector, async (loc) => { await loc.selectOption(value); }),
      check:        (selector)        => withHeal(page, selector, (loc) => loc.check()),
      getText:      async (selector)  => { /* with heal fallback */ },
      isVisible:    async (selector)  => { /* boolean, never throws */ },
    });
  },
});

module.exports = { test, expect };