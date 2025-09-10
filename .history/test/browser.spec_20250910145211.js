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
            res.statusCode = 200;
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
        }

        // Wait for the open-file button to become available
        await page.waitForSelector('.open-file-button, #open-file-button, button:has-text("Open Model")', { timeout: 15000 });
        console.log('Open-file button available');
    } catch {
        // Diagnostic: print body class and save screenshot for debugging
        const bodyClass = await page.evaluate(() => document.body.className).catch(() => '<no-body>');
        console.log('Diagnostic: body.className =', bodyClass);
        await page.screenshot({ path: 'tmp/playwright-browser-diagnostic.png', fullPage: true }).catch(() => null);
        throw new Error('welcome screen did not become ready in time');
    }

    // Set up file chooser promise before clicking
    console.log('Setting up file chooser promise');
    const fileChooserPromise = page.waitForEvent('filechooser');
    const openButton = await page.locator('.open-file-button, button:has-text("Open Model")');
    console.log('Clicking open file button');
    await openButton.click();
    const fileChooser = await fileChooserPromise;
    console.log('File chooser opened');
    await fileChooser.setFiles(file);
    console.log('File set into chooser');

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