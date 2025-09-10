import * as fs from 'fs';
import * as path from 'path';
import * as playwright from '@playwright/test';
import * as http from 'http';
import * as url from 'url';

playwright.test.setTimeout(120_000);

playwright.test('browser', async ({ page }) => {

    const self = url.fileURLToPath(import.meta.url);
    const dir = path.dirname(self);
    const file = path.resolve(dir, '../third_party/test/onnx/candy.onnx');
    playwright.expect(fs.existsSync(file)).toBeTruthy();

    // Start a temporary static server serving the `source` folder
    // Minimal static file server (avoids extra dependencies)
    const root = path.resolve(dir, '..', 'source');
    const server = http.createServer((req, res) => {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const filePath = path.join(root, pathname === '/' ? '/index.html' : pathname);
        if (!filePath.startsWith(root)) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
        }
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.statusCode = 404;
                res.end('Not found');
                return;
            }
            // Set a sensible Content-Type based on file extension so module scripts load correctly
            const ext = path.extname(filePath).toLowerCase();
            const map = {
                '.html': 'text/html; charset=utf-8',
                '.htm': 'text/html; charset=utf-8',
                '.js': 'application/javascript; charset=utf-8',
                '.mjs': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon',
                '.wasm': 'application/wasm'
            };
            const contentType = map[ext] || 'application/octet-stream';
            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            res.end(data);
        });
    });
    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;
    console.log('Test server listening at', base);

    // Navigate to the application (attach test=1 to skip welcome in test-mode)
    console.log('Navigating to page...');
    await page.goto(`${base}/index.html?test=1`);
    console.log('Page.goto returned');

    playwright.expect(page).toBeDefined();
    await page.waitForLoadState('domcontentloaded');
    console.log('DOM content loaded');

    // Forward browser page console messages to the Node test logs
    page.on('console', (msg) => {
        try {
            console.log('PAGE LOG:', msg.text());
        } catch {}
    });

    // Handle welcome/consent flow: try clicking the message button if present,
    // then wait for the open-file button to be available. This is more robust
    // across different states where the welcome screen may be shown.
    try {
        console.log('Checking for message button...');
        const hasMessageButton = await page.$('#message-button');
        if (hasMessageButton) {
            // Trigger click via evaluate so it runs even if element is hidden
            await page.evaluate(() => {
                const b = document.getElementById('message-button');
                if (b && typeof b.click === 'function') {
                    b.click();
                }
            }).catch(() => {});
            console.log('Clicked message button if present');
            // If the welcome/message state still persists (some flows keep 'welcome message'),
            // force the page into default state to proceed with tests.
            try {
                await page.evaluate(() => {
                    const c = document.body.className || '';
                    if (c.indexOf('welcome') !== -1 || c.indexOf('message') !== -1 || c.indexOf('notification') !== -1) {
                        document.body.className = 'default';
                    }
                });
                console.log('Forced body.className -> default if needed');
            } catch {
                // ignore
            }
        }

        // Wait for the open-file button to become available
        await page.waitForSelector('.open-file-button, #open-file-button, button:has-text("Open Model")', { timeout: 15000 });
        console.log('Open-file button available');
    } catch {
        // Diagnostic: print body class and save screenshot for debugging
        const bodyClass = await page.evaluate(() => document.body.className).catch(() => '<no-body>');
        console.log('Diagnostic: body.className =', bodyClass);
        await page.screenshot({ path: 'tmp/playwright-browser-diagnostic.png', fullPage: true }).catch(() => null);
        // Fallback: if welcome screen didn't become ready, force default and set file input
        try {
            console.log('Fallback: forcing default body and pre-setting file input');
            await page.evaluate(() => {
                document.body.className = 'default';
            });
            await page.setInputFiles('#open-file-dialog', file);
        } catch {
            // if fallback fails, rethrow original error
            throw new Error('welcome screen did not become ready in time');
        }
    }

    // Set file directly to hidden input to avoid filechooser UI
    console.log('Setting file into #open-file-dialog via setInputFiles');
    await page.setInputFiles('#open-file-dialog', file);
    // Click the open button to trigger app open handling
    const openButton = await page.locator('.open-file-button, button:has-text("Open Model")');
    console.log('Clicking open file button');
    await openButton.click();

    // Wait for the graph to render
    console.log('Waiting for canvas to render');
    await page.waitForSelector('#canvas', { state: 'attached', timeout: 20000 });
    console.log('Canvas attached');
    await page.waitForSelector('body.default', { timeout: 20000 });
    console.log('Body is default');

    // Open find sidebar
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+F' : 'Control+F');
    await page.waitForTimeout(500);
    const search = await page.waitForSelector('#search', { state: 'visible', timeout: 5000 });
    playwright.expect(search).toBeDefined();
    console.log('Search box visible');

    // Find and activate tensor
    await search.fill('convolution1_W');
    await page.waitForSelector('.sidebar-find-content li', { state: 'attached' });
    const item = await page.waitForSelector('.sidebar-find-content li:has-text("convolution1_W")');
    await item.dblclick();
    console.log('Activated tensor item');

    // Expand the 'value' field
    const valueEntry = await page.waitForSelector('#sidebar-content .sidebar-item:has(.sidebar-item-name input[value="value"])');
    const valueButton = await valueEntry.waitForSelector('.sidebar-item-value-button');
    await valueButton.click();
    console.log('Expanded value field');

    // Check first number from tensor value
    const pre = await valueEntry.waitForSelector('pre');
    const text = (await pre.textContent()) || '';
    const match = text.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
    playwright.expect(match).not.toBeNull();
    const first = parseFloat(match[0]);
    playwright.expect(first).toBe(0.1353299617767334);
    console.log('Tensor value first number:', first);

    server.close();
    console.log('Server closed');
});