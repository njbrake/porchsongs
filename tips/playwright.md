# Playwright MCP Plugin — Sandbox Tips

## Browser installation

The Playwright MCP plugin expects Chrome at `/opt/google/chrome/chrome`, which isn't present in the sandbox. Install Chromium manually:

```bash
# Install system dependencies first
apt-get update -qq && apt-get install -y -qq \
  libasound2t64 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 \
  libgbm1 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libx11-xcb1 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxshmfence1

# Install Playwright's Chromium (ARM64-compatible)
cd main && npx playwright install chromium

# Symlink to the location the MCP plugin expects
mkdir -p /opt/google
ln -sf /root/.cache/ms-playwright/chromium-1208/chrome-linux /opt/google/chrome
```

The chromium version number (`1208`) may change — check `ls /root/.cache/ms-playwright/` after install.

## Sandbox requires --no-sandbox

Running as root in the sandbox means Chromium refuses to launch with sandboxing enabled. The MCP plugin config needs `--no-sandbox` added to the args:

Edit both MCP config files under `/root/.claude/plugins/cache/claude-plugins-official/playwright/*/.mcp.json`:

```json
{
  "playwright": {
    "command": "npx",
    "args": ["@playwright/mcp@latest", "--no-sandbox"]
  }
}
```

**This config change requires restarting Claude Code** because the MCP server is already running. If you can't restart, use the direct Playwright API approach below instead.

## Direct Playwright scripts (bypass MCP plugin entirely)

When the MCP plugin won't launch (sandbox, can't restart), drive Playwright directly via Node.js. This uses `playwright-core` which is already installed as a dependency of the e2e tests.

```js
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    chromiumSandbox: false,
    executablePath: '/root/.cache/ms-playwright/chromium-1208/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:5173/app');
  await page.waitForTimeout(2000);

  // Take screenshots
  await page.screenshot({ path: '/tmp/screenshot.png', fullPage: true });   // full page
  await page.screenshot({ path: '/tmp/viewport.png', fullPage: false });    // viewport only

  // Measure layout dimensions
  const dims = await page.evaluate(() => ({
    bodyScrollHeight: document.body.scrollHeight,
    windowInnerHeight: window.innerHeight,
    scrollableAmount: document.documentElement.scrollHeight - window.innerHeight,
    headerHeight: document.querySelector('header')?.offsetHeight,
  }));
  console.log(JSON.stringify(dims, null, 2));

  // Interact with elements
  await page.getByText('Edit in Rewrite').click();
  await page.getByRole('button', { name: 'Your Version' }).click();

  // Scroll and capture
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.screenshot({ path: '/tmp/scrolled.png', fullPage: false });

  await browser.close();
})();
"
```

Key options:
- `chromiumSandbox: false` — required when running as root
- `viewport: { width, height }` — set on `browser.newPage()`, not launch
- `fullPage: true` vs `false` on `screenshot()` — full-page captures the entire scrollable content; false captures only the viewport (useful for spotting overflow)
- Use `page.evaluate()` to measure DOM dimensions, scrollable amounts, element heights
- Read screenshots with the `Read` tool to visually inspect them (Claude can see images)

## Layout debugging techniques

1. **Compare fullPage vs viewport screenshots** — if fullPage is taller, the page has scroll overflow
2. **Measure exact overflow**: `document.documentElement.scrollHeight - window.innerHeight`
3. **Measure individual elements**: `document.querySelector('header')?.offsetHeight`
4. **Test multiple viewports** — create separate browser instances for desktop (1280x900) and mobile (390x844)
5. **Use `page.setViewportSize()`** to resize without relaunching the browser
6. **Scroll and screenshot** to see what gets hidden: `page.evaluate(() => window.scrollTo(0, N))`

## Starting the app for visual testing

```bash
# From the workspace root — start backend
DATABASE_URL="sqlite:///./porchsongs.db" uv run alembic upgrade head
DATABASE_URL="sqlite:///./porchsongs.db" uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start frontend dev server
cd main/frontend && npm run dev -- --host 0.0.0.0 --port 5173 &

# Create test data via API (no auth required in OSS mode without APP_SECRET)
curl -s http://localhost:8000/api/profiles  # get profile_id (usually 1)
curl -s -X POST http://localhost:8000/api/songs \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Song","artist":"Test","content":"[G]Hello [C]World","original_content":"Hello World","rewritten_content":"[G]Hello [C]World","profile_id":1}'
```

Then navigate to `/app/library/1` to view the song, and click "Edit in Rewrite" to enter the workshop two-pane view.
