const { test, expect } = require('../fixtures.js');
const BASE_URL = 'https://the-internet.herokuapp.com/login';

// TC-01: Correct locators — healer never triggered
test('TC-01 | Login with correct locators (baseline)', async ({ page, healPage }) => {
  await page.goto(BASE_URL);
  await healPage.fill('#username', 'tomsmith');
  await healPage.fill('#password', 'SuperSecretPassword!');
  await healPage.click('button[type="submit"]');
  await expect(page.getByText('You logged into a secure area!')).toBeVisible();
});

// TC-02: Broken locators — Groq is called, locators are recovered
test('TC-02 | Login with BROKEN locators (self-heal triggered)', async ({ page, healPage }) => {
  await page.goto(BASE_URL);

  // Real IDs: #username, #password, button[type="submit"]
  await healPage.fill('#user-name-input',  'tomsmith');              // ← broken
  await healPage.fill('#pass-word-field',  'SuperSecretPassword!');  // ← broken
  await healPage.click('#login-submit-btn');                         // ← broken

  await expect(page.getByText('You logged into a secure area!')).toBeVisible();
});

// TC-03: Same broken locators — cache hit, no Groq call
test('TC-03 | Second run — healer reads from cache', async ({ page, healPage }) => {
  await page.goto(BASE_URL);
  await healPage.fill('#user-name-input',  'tomsmith');
  await healPage.fill('#pass-word-field',  'SuperSecretPassword!');
  await healPage.click('#login-submit-btn');
  await expect(page.getByText('You logged into a secure area!')).toBeVisible();
});

// TC-04: Negative path — wrong password
test('TC-04 | Login fails with wrong password', async ({ page, healPage }) => {
  await page.goto(BASE_URL);
  await healPage.fill('#username', 'tomsmith');
  await healPage.fill('#password', 'vagrantwashere');
  await healPage.click('button[type="submit"]');
  const flash = page.locator('#flash');
  await expect(flash).toBeVisible();
  await expect(flash).toContainText('Your password is invalid!');
});