# Playwright Self-Healing 🔧

A Playwright test automation framework that automatically heals broken locators using AI (Groq LLM). When a UI element's locator breaks due to DOM changes, the framework intelligently suggests and applies a new locator without manual intervention.

## Features

✨ **Automatic Locator Healing** — When a locator fails, the framework extracts the DOM snapshot and uses AI to suggest a working replacement

🧠 **Smart Confidence Gating** — Only accepts healing suggestions with >75% confidence; fails safely otherwise

⚡ **Caching** — Caches healed locators for 1 hour to avoid redundant LLM calls

📊 **Audit Logging** — Logs all healing attempts with timestamps, confidence scores, and strategies

🚀 **Multiple Healing Strategies** — Prioritizes robust selectors:
  1. `page.getByRole()` — Semantic accessibility-based
  2. `page.getByTestId()` — Data attribute-based
  3. `page.getByLabel()` — Label association
  4. `page.getByText()` — Text content-based
  5. CSS locators — Last resort

## Quick Start

### Prerequisites

- Node.js 16+
- Groq API key (free at [console.groq.com](https://console.groq.com))

### Installation

```bash
npm install
```

### Configuration

1. Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
```

2. Install Playwright browsers:

```bash
npx playwright install
```

### Running Tests

```bash
npm test
```

View the HTML report:

```bash
npx playwright show-report --port 9324
```

## Project Structure

```
playwright-self-healing-js/
├── src/
│   ├── fixtures.js           # Playwright fixtures with healing support
│   ├── self-healer.js        # Core healing logic
│   └── tests/
│       └── login.spec.js     # Example tests
├── playwright.config.js      # Playwright configuration
├── package.json
├── .env                      # Environment variables
├── .gitignore
└── README.md
```

## How It Works

### 1. Fixture Setup

The `healPage` fixture provides healing-aware methods:

```javascript
test('login with healing', async ({ page, healPage }) => {
  await page.goto('https://example.com/login');
  await healPage.fill('#username', 'user');
  await healPage.fill('#password', 'pass');
  await healPage.click('button[type="submit"]');
});
```

### 2. Healing Flow

When a locator fails:

```
Locator Fails (timeout)
    ↓
Extract DOM Snapshot (top 150 interactive elements)
    ↓
Ask Groq LLM for suggestion
    ↓
Confidence > 75%?
    ├─ YES → Apply new locator + Cache + Log
    └─ NO  → Fail test (safe default)
```

### 3. Cache Behavior

- **Cache Hit** (< 1 hour): Returns cached locator instantly
- **Cache Miss** (> 1 hour): Requests new suggestion from Groq
- **Cache File**: `./healing-cache.json`

### 4. Audit Trail

Every healing attempt is logged to `./healing-report.log`:

```
[2026-08-16T12:34:56.789Z] HEALED: "#user-name-input" → "page.getByRole('textbox', { name: 'Username' })" (confidence: 0.92, strategy: role)
```

## API Reference

### `healLocator(page, originalLocator, error)`

Main healing function called internally by fixtures.

**Returns:**
```javascript
{
  success: boolean,        // Whether healing succeeded
  newLocator: string|null, // New locator string or null
  confidence: number,      // LLM confidence (0-1)
  strategy: string         // Healing strategy used ('role', 'testid', 'cache', etc.)
}
```

### `extractDomSnapshot(page)`

Extracts interactive DOM elements as a structured snapshot.

### `askGroqForLocator(originalLocator, domSnapshot, errorMessage)`

Calls Groq LLM with context to suggest a new locator.

## Healing Methods Available

The `healPage` fixture provides these auto-healing methods:

```javascript
await healPage.click(selector);
await healPage.fill(selector, value);
await healPage.selectOption(selector, value);
await healPage.check(selector);
await healPage.getText(selector);
await healPage.isVisible(selector);
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Your Groq API key |

### Timeout Settings

Edit `src/fixtures.js` to adjust healing timeout:

```javascript
const FAST_TIMEOUT = 3_000; // Time to wait before triggering heal
```

### Cache TTL

Edit `src/self-healer.js` to adjust cache lifetime:

```javascript
const CACHE_TTL_MS = 3600000; // 1 hour in milliseconds
```

### Confidence Threshold

Edit `src/self-healer.js` to adjust confidence gate:

```javascript
if (suggestion.confidence < 0.75) {
  // Skip healing if confidence too low
}
```

## Example Test Cases

### Test 1: Correct Locators (Baseline)

```javascript
test('login with correct locators', async ({ page, healPage }) => {
  await page.goto(BASE_URL);
  await healPage.fill('#username', 'tomsmith');
  await healPage.fill('#password', 'SuperSecretPassword!');
  await healPage.click('button[type="submit"]');
  await expect(page.getByText('You logged into a secure area!')).toBeVisible();
});
```

**Expected**: Passes immediately, no healing needed.

### Test 2: Broken Locators (Self-Heal Triggered)

```javascript
test('login with broken locators', async ({ page, healPage }) => {
  await page.goto(BASE_URL);
  await healPage.fill('#user-name-input', 'tomsmith');      // ← broken
  await healPage.fill('#pass-word-field', 'SuperSecretPassword!'); // ← broken
  await healPage.click('#login-submit-btn');                // ← broken
  await expect(page.getByText('You logged into a secure area!')).toBeVisible();
});
```

**Expected**: Healer triggers, suggests correct locators, test passes.

### Test 3: Cache Hit

```javascript
test('second run reads from cache', async ({ page, healPage }) => {
  // Uses cached locators from previous test
  await healPage.fill('#user-name-input', 'tomsmith');
  // ...
});
```

**Expected**: Cache returns instant results, Groq not called.

## Troubleshooting

### "GROQ_API_KEY is missing"

✅ **Solution**: Ensure `.env` file exists with your API key:

```bash
echo "GROQ_API_KEY=your_key_here" > .env
```

### "Model has been decommissioned"

✅ **Solution**: Update the model in `src/self-healer.js`:

```javascript
const completion = await client.chat.completions.create({
  model: 'llama-3.1-8b-instant', // Use an active model
  // ...
});
```

Check available models at [console.groq.com/docs/models](https://console.groq.com/docs/models)

### "Low confidence, skipping auto-heal"

✅ **Solution**: This is intentional (safe default). Either:
- Lower the confidence threshold in `self-healer.js`
- Improve your DOM structure with better attributes (id, data-testid, aria-labels)

### Tests timeout without healing

✅ **Solution**: Check that:
1. GROQ_API_KEY is set correctly
2. Network connection to Groq API is active
3. Increase FAST_TIMEOUT in fixtures.js if network is slow

## Limitations

⚠️ **Known Limitations**:
- Healing works best with semantic HTML (roles, labels, aria attributes)
- Very dynamic DOMs may be difficult for LLM to parse
- Cache relies on original locator string (exact match required)
- Requires active internet connection for Groq API calls

## Performance

- **First Healing**: ~2-5s (LLM inference + DOM extraction)
- **Cache Hit**: <10ms (instant)
- **Timeout Before Heal**: 3s (configurable)

## Best Practices

✅ **DO**:
- Use semantic locators: `getByRole()`, `getByLabel()`, `getByTestId()`
- Add meaningful `data-testid` attributes to important elements
- Use descriptive aria-labels for accessibility
- Ensure sufficient DOM context in snapshots

❌ **DON'T**:
- Rely solely on CSS class selectors (fragile to styling changes)
- Ignore low-confidence healing failures
- Set confidence threshold below 0.5
- Use healing for every single action (defeats the purpose of tests)

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

ISC

## Support

For issues or questions:
- Check the [troubleshooting section](#troubleshooting)
- Review test examples in `src/tests/`
- Check Groq API docs at [console.groq.com/docs](https://console.groq.com/docs)

---

**Made with ❤️ for reliable, self-healing test automation**
