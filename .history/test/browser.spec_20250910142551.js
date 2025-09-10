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

    // Navigate to the application
    await page.goto(`${base}/index.html`);

    playwright.expect(page).toBeDefined();
    await page.waitForLoadState('domcontentloaded');

    // Robustly handle welcome flow: poll body.className until it includes 'default', clicking consent if visible
    const waitForWelcome = async (deadlineMs) => {
        const bodyClass = await page.evaluate(() => document.body.className).catch(() => '');
        if (bodyClass && bodyClass.includes('default')) {
            return true;
        }
        const consentHandle = await page.$('#message-button');
        if (consentHandle) {
            // Use element click via evaluate so it triggers even if not visible
            await page.evaluate((el) => el.click(), consentHandle).catch(() => {});
        }
        if (Date.now() < deadlineMs) {
            await page.waitForTimeout(500);
            return waitForWelcome(deadlineMs);
        }
        return false;
    };

    const ready = await waitForWelcome(Date.now() + 15000);
    if (!ready) {
        // Diagnostic: print body class and save screenshot for debugging
        const bodyClass = await page.evaluate(() => document.body.className).catch(() => '<no-body>');
        console.log('Diagnostic: body.className =', bodyClass);
        await page.screenshot({ path: 'tmp/playwright-browser-diagnostic.png', fullPage: true }).catch(() => null);
        throw new Error('welcome screen did not become ready in time');
    }

    const consent = await page.locator('#message-button');
    if (await consent.isVisible({ timeout: 2000 })) {
        await consent.click();
    }

    // Set up file chooser promise before clicking
    const fileChooserPromise = page.waitForEvent('filechooser');
    const openButton = await page.locator('.open-file-button, button:has-text("Open Model")');
    await openButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(file);

    // Wait for the graph to render
    await page.waitForSelector('#canvas', { state: 'attached', timeout: 10000 });
    await page.waitForSelector('body.default', { timeout: 10000 });

    // Open find sidebar
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+F' : 'Control+F');
    await page.waitForTimeout(500);
    const search = await page.waitForSelector('#search', { state: 'visible', timeout: 5000 });
    playwright.expect(search).toBeDefined();

    // Find and activate tensor
    await search.fill('convolution1_W');
    await page.waitForSelector('.sidebar-find-content li', { state: 'attached' });
    const item = await page.waitForSelector('.sidebar-find-content li:has-text("convolution1_W")');
    await item.dblclick();

    // Expand the 'value' field
    const valueEntry = await page.waitForSelector('#sidebar-content .sidebar-item:has(.sidebar-item-name input[value="value"])');
    const valueButton = await valueEntry.waitForSelector('.sidebar-item-value-button');
    await valueButton.click();

    // Check first number from tensor value
    const pre = await valueEntry.waitForSelector('pre');
    const text = (await pre.textContent()) || '';
    const match = text.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
    playwright.expect(match).not.toBeNull();
    const first = parseFloat(match[0]);
    playwright.expect(first).toBe(0.1353299617767334);

    server.close();
});