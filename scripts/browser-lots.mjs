import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.FRONTEND_URL ?? 'http://127.0.0.1:8080';
const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const shots = fileURLToPath(new URL('../../artifacts/screenshots/', import.meta.url));
await mkdir(shots, { recursive: true });
const suffix = Date.now().toString(36),
  password = 'DemoLots2026!';
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
  if (role === 'seller') await page.getByLabel('Ник продавца').fill('Партии ' + suffix);
  await page.getByLabel('Логин', { exact: true }).fill(`lots_${role}_${suffix}`);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page
    .getByRole('button', {
      name: role === 'seller' ? 'Зарегистрироваться как продавец' : 'Зарегистрироваться как покупатель',
      exact: true,
    })
    .click();
  await page.waitForURL(base + (role === 'seller' ? '/seller/account' : '/account'));
  await page
    .getByRole('heading', { name: role === 'seller' ? 'Партии ' + suffix : 'Мои покупки', exact: true })
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
  await seller.getByRole('button', { name: 'Добавить товар', exact: true }).click();
  let sourceForm = seller.locator('.seller-offer-list form').filter({ hasText: 'KEY-CS2-PRIME' });
  await sourceForm.getByLabel('Цена каждого ключа в партии, ₽').fill('99');
  await sourceForm.getByLabel('Продаётся').check();
  await sourceForm.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await seller.getByRole('status').filter({ hasText: 'Предложение сохранено' }).waitFor();
  await sourceForm.getByRole('button', { name: 'Добавить ключи', exact: true }).click();
  await seller.getByLabel('Закупочная цена одного ключа, ₽', { exact: true }).fill('40');
  await seller
    .getByLabel('Ключи, по одному в строке', { exact: true })
    .fill(
      Array.from({ length: 1000 }, (_, i) =>
        `E2E-LOTS-${suffix}-${String(i).padStart(4, '0')}`.toUpperCase(),
      ).join('\n'),
    );
  await seller.getByRole('button', { name: 'Добавить ключи', exact: true }).click();
  await seller.getByRole('status').filter({ hasText: 'Добавлено: 1000' }).waitFor();
  await seller.getByRole('button', { name: 'Партии и массовые цены', exact: true }).click();
  let view = await api(seller, '/api/seller/dashboard');
  const source = view.offers.find((o) => o.sku === 'KEY-CS2-PRIME');
  assert.equal(source.available, 1000);
  sourceForm = seller.locator('.seller-offer-list form').filter({ hasText: 'KEY-CS2-PRIME' });
  await sourceForm.getByRole('button', { name: 'Разделить на партии', exact: true }).click();
  for (let i = 1; i <= 3; i++) {
    await seller.getByLabel(`Количество партии ${i}`, { exact: true }).fill(String([200, 400, 400][i - 1]));
    await seller.getByLabel(`Цена партии ${i}`, { exact: true }).fill(String([100, 150, 200][i - 1]));
  }
  await seller.screenshot({ path: shots + '/seller-split-1000.png', fullPage: true });
  await layout(seller, 'lot split form');
  await seller.getByRole('button', { name: 'Создать партии', exact: true }).click();
  await seller.getByRole('status').filter({ hasText: 'Партии созданы' }).waitFor();
  await seller.reload();
  await seller.getByRole('button', { name: 'Партии и массовые цены', exact: true }).click();
  await seller.locator('.seller-offer-list form').nth(3).waitFor();
  assert.equal(await seller.locator('.seller-offer-list form').count(), 4);
  view = await api(seller, '/api/seller/dashboard');
  const lots = view.offers.filter((o) => !o.is_default).sort((a, b) => a.price - b.price);
  assert.deepEqual(
    lots.map((o) => [o.available, o.price]),
    [
      [200, 100],
      [400, 150],
      [400, 200],
    ],
  );
  assert.equal(view.products_summary.available, 1000);
  checks.push(
    '1000 uploaded keys split through UI into 200 at 100, 400 at 150, 400 at 200; reload preserves all lots',
  );
  await seller.screenshot({ path: shots + '/seller-price-lots.png', fullPage: true });
  await layout(seller, 'seller lot cards');
  const buyer = await register('buyer');
  for (const lot of lots) {
    await buyer.goto(base + '/product/KEY-CS2-PRIME');
    await buyer.locator(`input[name=seller][value="${lot.offer_id}"]`).check();
    await buyer.getByRole('button', { name: 'Добавить в корзину', exact: true }).click();
    await buyer.getByText('Товар добавлен.', { exact: false }).waitFor();
  }
  await buyer.goto(base + '/cart');
  await buyer.locator('.cart-line').nth(2).waitFor();
  assert.equal(await buyer.locator('.cart-line').count(), 3);
  assert.equal((await api(buyer, '/api/cart')).total_points, 450);
  await buyer.screenshot({ path: shots + '/cart-three-lots.png', fullPage: true });
  await layout(buyer, 'cart three lots');
  const first = buyer.locator('.cart-line').filter({ hasText: 'Партия 1' });
  await first.getByRole('button', { name: 'Увеличить количество', exact: true }).click();
  await first.getByText('200 ₽', { exact: true }).waitFor();
  assert.equal((await api(buyer, '/api/cart')).total_points, 550);
  await first.getByRole('button', { name: 'Уменьшить количество', exact: true }).click();
  await first.getByText('100 ₽', { exact: true }).waitFor();
  await buyer.locator('input[name=payment-method][value=sbp]').check();
  await buyer.getByRole('button', { name: 'Перейти к оплате', exact: true }).click();
  await buyer.waitForURL(/\/cart\?order=/);
  const groupId = new URL(buyer.url()).searchParams.get('order');
  assert.equal((await api(seller, '/api/seller/dashboard')).products_summary.reserved, 3);
  await seller.reload();
  await seller.getByRole('button', { name: 'Партии и массовые цены', exact: true }).click();
  const middle = seller.locator('.seller-offer-list form').filter({ hasText: 'Партия 2' });
  await middle.getByLabel('Цена каждого ключа в партии, ₽').fill('999');
  await middle.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await seller.getByRole('status').filter({ hasText: 'Предложение сохранено' }).waitFor();
  await buyer.getByRole('button', { name: 'Имитировать успешную оплату', exact: true }).click();
  let group;
  for (let n = 0; n < 80; n++) {
    group = await api(buyer, `/api/account/orders/${groupId}`);
    if (group.terminal) break;
    await buyer.waitForTimeout(250);
  }
  assert.equal(group.status, 'delivered');
  assert.equal(group.amount, 450);
  assert.deepEqual(
    group.items.map((i) => i.amount).sort((a, b) => a - b),
    [100, 150, 200],
  );
  assert.deepEqual(
    new Set(group.items.map((i) => i.assigned_offer_id)),
    new Set(lots.map((l) => l.offer_id)),
  );
  assert.equal(new Set(group.items.map((i) => i.code)).size, 3);
  await seller.getByRole('button', { name: 'Продажи и сообщения', exact: true }).click();
  await seller.getByRole('button', { name: 'Обновить', exact: true }).click();
  view = await api(seller, '/api/seller/dashboard');
  assert.equal(view.summary.profit, 330);
  assert.equal(view.summary.net_income, 450);
  await seller.screenshot({ path: shots + '/seller-lot-sales.png', fullPage: true });
  checks.push(
    'three lots remain separate in cart, quantity editing and checkout; 3 reservations and 3 distinct issued keys',
  );
  checks.push('changing lot price to 999 leaves paid prices 100/150/200 and profit 330 intact');
  await api(seller, `/api/seller/lots/${lots[1].offer_id}`, { price: 150, active: true }, 'PUT');
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        passed: true,
        checks,
        browser_errors: errors,
        seller: `lots_seller_${suffix}`,
        order: groupId,
        lots: lots.map((l) => ({
          id: l.offer_id,
          name: l.offer_name,
          price: l.price,
          initial_quantity: l.available,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
