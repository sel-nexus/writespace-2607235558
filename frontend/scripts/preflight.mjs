/** Capture representative rendered structure and styles for human UI review. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
await mkdir('review-screenshots', { recursive: true });
const browser = await chromium.launch({ headless: true });
const sections = [];
try {
  for (const [name, path, width] of [['landing', '/', 1280], ['mobile-menu', '/', 390], ['login', '/login', 768], ['admin', '/admin', 1280]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    if (name === 'admin') await page.addInitScript(() => localStorage.setItem('writespace_session', JSON.stringify({ userId: 'admin', username: 'admin', displayName: 'Demo Admin', role: 'admin' })));
    await page.goto(origin + path);
    if (name === 'mobile-menu') {
      const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
      await toggle.click();
      if (await page.getByRole('button', { name: 'Close navigation', exact: true }).getAttribute('aria-expanded') !== 'true') throw new Error('Navigation did not expand');
    }
    sections.push(`\n## ${name}\nAccessibility:\n${JSON.stringify(await page.accessibility.snapshot(), null, 2)}\nStyles:\n${JSON.stringify(await page.evaluate(() => ({ font: getComputedStyle(document.body).fontFamily, background: getComputedStyle(document.body).backgroundColor, width: document.documentElement.scrollWidth })), null, 2)}\nHTML:\n${await page.content()}`);
    await page.screenshot({ path: `review-screenshots/${name}.png`, fullPage: true });
    await context.close();
  }
  await writeFile('preflight.txt', sections.join('\n'), 'utf8');
} finally {
  await browser.close();
}
