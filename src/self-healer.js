require('dotenv').config();
const { Groq } = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = './healing-cache.json';
const CACHE_TTL_MS = 3600000; // 1 hour
const LOG_FILE = './healing-report.log';

let groqClient = null;
let cache = null;

// ============ Groq Client Management ============
function getGroqClient() {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('[self-heal] GROQ_API_KEY environment variable is missing or empty. Set it in .env file or as an environment variable.');
    }
    try {
      groqClient = new Groq({ apiKey });
    } catch (err) {
      throw new Error(`[self-heal] Failed to initialize Groq client: ${err.message}`);
    }
  }
  return groqClient;
}

// ============ Cache Management ============
function loadCache() {
  if (cache) return cache;
  try {
    if (fs.existsSync(CACHE_FILE)) {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } else {
      cache = {};
    }
  } catch (err) {
    console.warn('[self-heal] Failed to load cache:', err.message);
    cache = {};
  }
  return cache;
}

function saveCache(cacheData) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
  } catch (err) {
    console.warn('[self-heal] Failed to save cache:', err.message);
  }
}

function logHeal(originalLocator, newLocator, confidence, strategy) {
  try {
    const logLine = `[${new Date().toISOString()}] HEALED: "${originalLocator}" → "${newLocator}" (confidence: ${confidence}, strategy: ${strategy})`;
    fs.appendFileSync(LOG_FILE, logLine + '\n');
  } catch (err) {
    console.warn('[self-heal] Failed to write log:', err.message);
  }
}

// ============ DOM Snapshot ============
async function extractDomSnapshot(page) {
  if (page.isClosed()) {
    throw new Error('[self-heal] Page already closed — cannot extract snapshot');
  }

  return page.evaluate(() => {
    const selectors = [
      'button', 'a', 'input', 'select',
      'textarea', '[role]', '[data-testid]', 'label',
    ];
    const nodes = document.querySelectorAll(selectors.join(','));

    return Array.from(nodes)
      .slice(0, 150)
      .map((el) => {
        const attrs = [];
        ['id', 'class', 'name', 'type', 'role', 'aria-label',
         'data-testid', 'placeholder', 'for'].forEach((a) => {
          const v = el.getAttribute(a);
          if (v) attrs.push(`${a}="${v.slice(0, 60)}"`);
        });
        const text = (el.textContent ?? '')
          .trim().replace(/\s+/g, ' ').slice(0, 80);
        return `<${el.tagName.toLowerCase()} ${attrs.join(' ')}>${text}</${el.tagName.toLowerCase()}>`;
      })
      .join('\n');
  });
}

// ============ Groq Healing Logic ============
async function askGroqForLocator(originalLocator, domSnapshot, errorMessage) {
  const prompt = `You are a Playwright automation expert. A UI locator has broken.

BROKEN LOCATOR: ${originalLocator}
ERROR: ${errorMessage}

DOM SNAPSHOT:
${domSnapshot}

Return ONE Playwright locator using this priority:
  1. page.getByRole('...', { name: '...' })
  2. page.getByTestId('...')
  3. page.getByLabel('...')
  4. page.getByText('...')
  5. page.locator('css') — last resort

Return ONLY valid JSON:
{
  "locator": "page.getByRole('button', { name: 'Login' })",
  "confidence": 0.92,
  "strategy": "role"
}`;

  const client = getGroqClient();
  const completion = await client.chat.completions.create({
    model: 'gemma-7b-it',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 300,
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
    return {
      locator:    parsed.locator    ?? '',
      confidence: parsed.confidence ?? 0,
      strategy:   parsed.strategy   ?? 'unknown',
    };
  } catch (e) {
    console.warn('[self-heal] Failed to parse Groq response:', e.message);
    return { locator: '', confidence: 0, strategy: 'parse_error' };
  }
}

// ============ Main Healing Function ============
async function healLocator(page, originalLocator, error) {
  try {
    const cacheData = loadCache();
    const cached = cacheData[originalLocator];

    // Return cached result if still valid (1 hour TTL)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      console.log(`[self-heal] [v] Cache hit: "${originalLocator}" → "${cached.newLocator}"`);
      return {
        success: true,
        newLocator: cached.newLocator,
        confidence: cached.confidence,
        strategy: 'cache',
      };
    }

    // Extract DOM and ask Groq for suggestion
    const domSnapshot = await extractDomSnapshot(page);
    const suggestion = await askGroqForLocator(originalLocator, domSnapshot, error.message);

    // Confidence gate: never silently pass a low-confidence heal
    if (!suggestion.locator || suggestion.confidence < 0.75) {
      console.warn(`[self-heal] [!] Low confidence (${suggestion.confidence}). Skipping auto-heal.`);
      return {
        success: false,
        newLocator: null,
        confidence: suggestion.confidence,
        strategy: suggestion.strategy,
      };
    }

    // Persist to cache and write audit log
    cacheData[originalLocator] = {
      newLocator: suggestion.locator,
      confidence: suggestion.confidence,
      timestamp: Date.now(),
    };
    saveCache(cacheData);
    logHeal(originalLocator, suggestion.locator, suggestion.confidence, suggestion.strategy);

    console.log(`[self-heal] [✓] Healed: "${originalLocator}" → "${suggestion.locator}" (confidence: ${suggestion.confidence})`);

    return {
      success: true,
      newLocator: suggestion.locator,
      confidence: suggestion.confidence,
      strategy: suggestion.strategy,
    };
  } catch (err) {
    console.error('[self-heal] Healing failed:', err.message);
    return {
      success: false,
      newLocator: null,
      confidence: 0,
      strategy: 'error',
    };
  }
}

module.exports = { healLocator, extractDomSnapshot, askGroqForLocator };
