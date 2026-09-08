import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const screenshots = fileURLToPath(new URL('../../artifacts/screenshots/', import.meta.url));
await mkdir(screenshots, { recursive: true });
const base = process.env.FRONTEND_URL ?? 'http://127.0.0.1:8080';
const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const results = [];
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
for (const width of [360, 390, 768, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of ['/', '/product/STEAM-TOPUP-500', '/account', '/cart', '/seller/A']) {
    await page.goto(base + route, { waitUntil: 'networkidle' });
    const state = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      broken: [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src),
    }));
    assert(state.scroll <= state.width, `${route} ${width}: overflow ${state.scroll}`);
    assert.deepEqual(state.broken, [], `${route}: broken images`);
    results.push({ route, ...state });
  }
}
async function login(user, password, next) {
  await page.goto(base + '/account');
  const result = await fetch(apiBase + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: user, password }),
  });
  assert(result.ok);
  const { token } = await result.json();
  await page.evaluate((token) => localStorage.setItem('game_goods_auth_token', token), token);
  await page.goto(base + next, { waitUntil: 'networkidle' });
}
await page.setViewportSize({ width: 390, height: 844 });
await login('seller_a', process.env.SELLER_PASSWORD ?? 'SellerDemo2026!', '/seller/account');
for (const name of ['Мои товары', 'Партии и массовые цены', 'Продажи и сообщения', 'Ключи и остатки']) {
  await page.getByRole('button', { name, exact: true }).click();
  const width = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert(width.scroll <= width.width, `seller ${name} overflow`);
  results.push({ page: 'seller', tab: name, ...width });
}
await page.getByRole('button', { name: 'Мои товары', exact: true }).click();
await page.screenshot({ path: screenshots + '/seller-mobile.png', fullPage: true });
await login(
  process.env.ADMIN_USERNAME ?? 'admin_demo',
  process.env.ADMIN_PASSWORD ?? 'AdminDemo2026!',
  '/admin',
);
for (const name of ['Заказы и модерация', 'Ключи и остатки', 'Платёжные коды', 'Продавцы', 'Надёжность']) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(200);
  const width = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert(width.scroll <= width.width, `admin ${name} overflow ${width.scroll}`);
  results.push({ page: 'admin', tab: name, ...width });
}
await page.getByRole('button', { name: 'Построить отчёт', exact: true }).click();
await page.getByText('Знаки отражают дебет и кредит.', { exact: false }).waitFor();
console.log(JSON.stringify({ passed: true, viewports: results, errors }, null, 2));
assert.deepEqual(errors, []);
await browser.close();
