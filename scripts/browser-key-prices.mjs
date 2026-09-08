import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.FRONTEND_URL ?? 'http://127.0.0.1:8080';
const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const shots = fileURLToPath(new URL('../../artifacts/screenshots/', import.meta.url));
await mkdir(shots, { recursive: true });
const suffix = Date.now().toString(36),
  password = 'DemoKeyPrices2026!';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const errors = [],
  checks = [];
async function api(page, path, body, method = body ? 'POST' : 'GET') {
  const token = await page.evaluate(() => localStorage.getItem('game_goods_auth_token'));
  const response = await fetch(apiBase + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  assert(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
async function register(role) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/account');
  await page.getByLabel(role === 'seller' ? 'Я продавец' : 'Я покупатель', { exact: false }).check();
  if (role === 'seller') await page.getByLabel('Ник продавца').fill('Цены ключей ' + suffix);
  await page.getByLabel('Логин', { exact: true }).fill(`keyprice_${role}_${suffix}`);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page
    .getByRole('button', {
      name: role === 'seller' ? 'Зарегистрироваться как продавец' : 'Зарегистрироваться как покупатель',
      exact: true,
    })
    .click();
  await page.waitForURL(base + (role === 'seller' ? '/seller/account' : '/account'));
  await page
    .getByRole('heading', { name: role === 'seller' ? 'Цены ключей ' + suffix : 'Мои покупки', exact: true })
    .waitFor();
  return page;
}
async function layout(page, label) {
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const result = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert(result.scroll <= result.width, `${label}: ${JSON.stringify(result)}`);
  }
  checks.push(label + ' responsive 360/390/768/1440');
}
try {
  const seller = await register('seller');
  const codes = [0, 1].map((i) => `E2E-PRICE-${suffix}-${i}`.toUpperCase());
  await seller.getByRole('button', { name: 'Добавить ключи', exact: true }).click();
  await seller.getByLabel('Товар', { exact: true }).selectOption('KEY-CS2-PRIME');
  await seller.getByLabel('Закупочная цена одного ключа, ₽', { exact: true }).fill('0');
  await seller.getByLabel('Ключи, по одному в строке', { exact: true }).fill(codes.join('\n'));
  await seller.getByRole('button', { name: 'Добавить ключи', exact: true }).click();
  await seller.getByRole('status').filter({ hasText: 'Добавлено: 2' }).waitFor();
  await seller.getByRole('button', { name: 'Мои товары', exact: true }).click();
  const row = (code) => seller.locator('.key-price-card').filter({ hasText: code });
  for (let i = 0; i < 2; i++) {
    await row(codes[i])
      .getByLabel(`Цена продажи ${codes[i]}`, { exact: true })
      .fill(String(i + 1));
    await row(codes[i]).getByLabel(`Продавать ${codes[i]}`, { exact: true }).check();
    await row(codes[i]).getByRole('button', { name: 'Сохранить цену', exact: true }).click();
    await seller
      .getByRole('status')
      .filter({ hasText: `Цена ключа ${codes[i]} сохранена` })
      .waitFor();
  }
  await seller.reload();
  await seller.locator('.key-price-card').nth(1).waitFor();
  assert.equal(await seller.locator('.key-price-card').count(), 2);
  assert.equal(await row(codes[0]).getByLabel(`Цена продажи ${codes[0]}`).inputValue(), '1');
  assert.equal(await row(codes[1]).getByLabel(`Цена продажи ${codes[1]}`).inputValue(), '2');
  assert.equal(await seller.locator('.seller-offer-list form').count(), 0);
  // Polling must preserve an unsaved input; reverting and saving must not add offers.
  await row(codes[0]).getByLabel(`Цена продажи ${codes[0]}`).fill('7');
  await seller.waitForTimeout(5300);
  assert.equal(await row(codes[0]).getByLabel(`Цена продажи ${codes[0]}`).inputValue(), '7');
  await row(codes[0]).getByLabel(`Цена продажи ${codes[0]}`).fill('1');
  await row(codes[0]).getByLabel(`Продавать ${codes[0]}`).uncheck();
  await row(codes[0]).getByRole('button', { name: 'Сохранить цену' }).click();
  await row(codes[0]).getByText('Снят с продажи', { exact: true }).waitFor();
  await row(codes[1]).getByText('В продаже', { exact: true }).waitFor();
  await row(codes[0]).getByLabel(`Продавать ${codes[0]}`).check();
  await row(codes[0]).getByRole('button', { name: 'Сохранить цену' }).click();
  await row(codes[0]).getByText('В продаже', { exact: true }).waitFor();
  await seller.getByLabel('Найти ключ или товар', { exact: true }).fill(codes[1]);
  await seller.locator('.key-price-filters').getByRole('button', { name: 'Найти', exact: true }).click();
  await seller.waitForFunction(() => document.querySelectorAll('.key-price-card').length === 1);
  assert.match(await seller.locator('.key-price-card').innerText(), new RegExp(codes[1]));
  await seller.getByLabel('Найти ключ или товар', { exact: true }).fill('');
  await seller.locator('.key-price-filters').getByRole('button', { name: 'Найти', exact: true }).click();
  await seller.locator('.key-price-card').nth(1).waitFor();
  await layout(seller, 'individual key prices');
  await seller.screenshot({ path: shots + '/seller-individual-prices.png', fullPage: true });
  await seller.setViewportSize({ width: 390, height: 844 });
  await seller.screenshot({ path: shots + '/seller-individual-prices-mobile.png', fullPage: true });
  checks.push(
    'two keys of one SKU priced at 1 and 2 via UI; independent pause, search, reload, polling draft preservation',
  );
  const inventory = await api(seller, '/api/seller/inventory');
  const buyer = await register('buyer');
  for (const key of inventory.items) {
    await buyer.goto(base + '/product/KEY-CS2-PRIME');
    await buyer.locator(`input[name=seller][value="${key.offer_id}"]`).check();
    await buyer.getByRole('button', { name: 'Добавить в корзину', exact: true }).click();
    await buyer.getByText('Товар добавлен.', { exact: false }).waitFor();
  }
  await buyer.goto(base + '/cart');
  await buyer.locator('.cart-line').nth(1).waitFor();
  assert.equal((await api(buyer, '/api/cart')).total_points, 3);
  await buyer.locator('input[name=payment-method][value=sbp]').check();
  await buyer.getByRole('button', { name: 'Перейти к оплате', exact: true }).click();
  await buyer.waitForURL(/\/cart\?order=/);
  const groupId = new URL(buyer.url()).searchParams.get('order');
  await seller.reload();
  await row(codes[0]).getByText('В резерве заказа', { exact: true }).waitFor();
  assert.equal(await seller.getByRole('button', { name: 'Сохранить цену', exact: true }).count(), 0);
  await buyer.getByRole('button', { name: 'Имитировать успешную оплату', exact: true }).click();
  let group;
  for (let n = 0; n < 80; n++) {
    group = await api(buyer, `/api/account/orders/${groupId}`);
    if (group.terminal) break;
    await buyer.waitForTimeout(250);
  }
  assert.equal(group.status, 'delivered');
  assert.equal(group.amount, 3);
  assert.deepEqual(group.items.map((i) => [i.code, i.amount]).sort(), [
    [codes[0], 1],
    [codes[1], 2],
  ]);
  const dashboard = await api(seller, '/api/seller/dashboard');
  assert.equal(dashboard.summary.net_income, 3);
  assert.equal(dashboard.summary.profit, 3);
  checks.push(
    'buyer chooses two real offers and receives exact keys for 3; reserved keys locked; seller income/profit 3 persisted',
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      { passed: true, checks, browser_errors: errors, seller: `keyprice_seller_${suffix}`, order: groupId },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
