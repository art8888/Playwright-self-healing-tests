# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.js >> TC-02 | Login with BROKEN locators (self-heal triggered)
- Location: src/tests/login.spec.js:14:1

# Error details

```
TimeoutError: locator.waitFor: Timeout 3000ms exceeded.
Call log:
  - waiting for locator('#user-name-input')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - link "Fork me on GitHub":
      - /url: https://github.com/tourdedave/the-internet
      - img "Fork me on GitHub" [ref=e5] [cursor=pointer]
    - generic [ref=e7]:
      - heading "Login Page" [level=2] [ref=e8]
      - heading [level=4] [ref=e9]:
        - text: This is where you can log into the secure area. Enter
        - emphasis [ref=e10]: tomsmith
        - text: for the username and
        - emphasis [ref=e11]: SuperSecretPassword!
        - text: for the password. If the information is wrong you should see error messages.
      - generic [ref=e12]:
        - generic [ref=e14]:
          - generic [ref=e15] [cursor=pointer]: Username
          - textbox "Username" [ref=e16]
        - generic [ref=e18]:
          - generic [ref=e19] [cursor=pointer]: Password
          - textbox "Password" [ref=e20]
        - button " Login" [ref=e21] [cursor=pointer]
  - generic [ref=e24]:
    - separator [ref=e25]
    - generic [ref=e26]:
      - text: Powered by
      - link "Elemental Selenium" [ref=e27] [cursor=pointer]:
        - /url: http://elementalselenium.com/
```

# Test source

```ts
  1  | require('dotenv').config();
  2  | 
  3  | const { test: base, expect } = require('@playwright/test');
  4  | const { healLocator } = require('./self-healer.js');
  5  | 
  6  | const FAST_TIMEOUT = 3_000;
  7  | 
  8  | async function withHeal(page, originalSelector, action) {
  9  |   try {
  10 |     // Fail fast: if element is not attached within 3s, trigger healing
> 11 |     await page.locator(originalSelector).waitFor({ state: 'attached', timeout: FAST_TIMEOUT });
     |                                          ^ TimeoutError: locator.waitFor: Timeout 3000ms exceeded.
  12 |     await action(page.locator(originalSelector));
  13 |   } catch (err) {
  14 |     const result = await healLocator(page, originalSelector, err);
  15 |     if (!result.success || !result.newLocator) throw err;
  16 | 
  17 |     // Evaluate LLM-returned string to a live Playwright Locator
  18 |     const healedLocator = new Function('page', `return ${result.newLocator}`)(page);
  19 |     await action(healedLocator);
  20 |   }
  21 | }
  22 | 
  23 | const test = base.extend({
  24 |   healPage: async ({ page }, use) => {
  25 |     await use({
  26 |       click:        (selector)        => withHeal(page, selector, (loc) => loc.click()),
  27 |       fill:         (selector, value) => withHeal(page, selector, (loc) => loc.fill(value)),
  28 |       selectOption: (selector, value) => withHeal(page, selector, async (loc) => { await loc.selectOption(value); }),
  29 |       check:        (selector)        => withHeal(page, selector, (loc) => loc.check()),
  30 |       getText:      async (selector)  => { /* with heal fallback */ },
  31 |       isVisible:    async (selector)  => { /* boolean, never throws */ },
  32 |     });
  33 |   },
  34 | });
  35 | 
  36 | module.exports = { test, expect };
```