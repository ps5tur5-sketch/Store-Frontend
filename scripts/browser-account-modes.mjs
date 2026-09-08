import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.FRONTEND_URL ?? 'http://127.0.0.1:8080',
  apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const suffix = Date.now().toString(36),
  username = 'dual_' + suffix,
  store = 'Магазин ' + suffix,
  password = 'DualDemo2026!';
const shots = fileURLToPath(new URL('../../artifacts/screenshots/', import.meta.url));
await mkdir(shots, { recursive: true });
async function api(path, method = 'GET', body) {
  const token = await page.evaluate(() => localStorage.getItem('game_goods_auth_token'));
  const response = await fetch(apiBase + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert(response.ok, `${response.status} ${path}`);
  return response.json();
}
try {
  await page.goto(base + '/account?next=/seller/account');
  await page.getByRole('button', { name: 'Регистрация', exact: true }).click();
  await page.getByLabel('Логин', { exact: true }).fill(username);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.screenshot({ path: shots + '/register-buyer-seller.png', fullPage: true });
  await page.getByRole('button', { name: 'Зарегистрироваться как покупатель', exact: true }).click();
  await page.waitForURL(base + '/seller/account');
  await page.getByLabel('Ник продавца', { exact: true }).waitFor();
  assert.equal(await page.getByText('Этот кабинет доступен аккаунту продавца.', { exact: true }).count(), 0);
  await page
    .getByRole('navigation', { name: 'Купить или продать' })
    .getByRole('link', { name: 'Купить', exact: true })
    .click();
  await page.getByRole('heading', { name: 'Мои покупки', exact: true }).waitFor();
  const before = await api('/api/account');
  await api('/api/cart/items', 'POST', { sku: 'STEAM-TOPUP-500', provider: 'DEMO_NOVA' });
  const checkout = await api('/api/cart/checkout', 'POST', {
    checkout_id: 'dual_browser_' + suffix,
    method: 'balance',
  });
  const expected = checkout.balance_after;
  await page.reload();
  await page.getByRole('button', { name: 'Стать продавцом', exact: true }).click();
  await page.getByLabel('Ник продавца', { exact: true }).fill(store);
  await page.screenshot({ path: shots + '/become-seller.png', fullPage: true });
  await page.getByRole('button', { name: 'Открыть магазин', exact: true }).click();
  await page.waitForURL(base + '/seller/account');
  await page.getByRole('heading', { name: store, exact: true }).waitFor();
  const after = await api('/api/account');
  assert.equal(after.user.id, before.user.id);
  assert.equal(after.user.points_balance, expected);
  assert(after.user.can_buy && after.user.can_sell);
  await page
    .getByRole('navigation', { name: 'Купить или продать' })
    .getByRole('link', { name: 'Купить', exact: true })
    .click();
  await page.getByRole('heading', { name: 'Мои покупки', exact: true }).waitFor();
  await page.locator('.order-progress').filter({ hasText: checkout.order_id }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Стать продавцом', exact: true }).count(), 0);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= width);
  }
  await page
    .getByRole('navigation', { name: 'Купить или продать' })
    .getByRole('link', { name: 'Продать', exact: true })
    .click();
  await page.getByRole('heading', { name: store, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await page.getByLabel('Логин', { exact: true }).fill(username);
  await page.getByLabel('Пароль', { exact: true }).fill('WrongPassword123');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByText('Неверный логин или пароль.', { exact: true }).waitFor();
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(base + '/seller/account');
  await page.getByRole('heading', { name: store, exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: store, exact: true }).waitFor();
  assert.equal((await api('/api/account')).user.points_balance, expected);
  await page.screenshot({ path: shots + '/account-mode-seller.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        passed: true,
        username,
        checks: [
          'buyer registration with seller return URL opens activation, not an access error',
          'become seller with nickname only',
          'same user ID and session',
          'balance and purchases preserved',
          'buy/sell navigation',
          'wrong password handled without losing form',
          'same account login and reload restore both capabilities',
          'mobile account layout',
        ],
        browser_errors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
