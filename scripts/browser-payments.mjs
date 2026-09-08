import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.FRONTEND_URL ?? 'http://127.0.0.1:8080';
const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const shots = fileURLToPath(new URL('../../artifacts/screenshots/', import.meta.url));
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const errors = [];
const suffix = Date.now().toString(36);
const checks = [];
async function page() {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  p.on('pageerror', (e) => errors.push(e.message));
  return p;
}
async function api(p, path, method = 'GET', body) {
  const token = await p.evaluate(() => localStorage.getItem('game_goods_auth_token'));
  const r = await fetch(apiBase + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert(r.ok, `${r.status} ${path} ${await r.clone().text()}`);
  return r.json();
}
async function register(p, role) {
  await p.goto(base + '/account');
  await p.getByLabel(role === 'seller' ? 'Я продавец' : 'Я покупатель', { exact: false }).check();
  if (role === 'seller') await p.getByLabel('Ник продавца').fill('Browser Store ' + suffix);
  await p.getByLabel('Логин', { exact: true }).fill(role + '_' + suffix);
  await p.getByLabel('Пароль', { exact: true }).fill('DemoPayment2026!');
  await p
    .getByRole('button', {
      name: role === 'seller' ? 'Зарегистрироваться как продавец' : 'Зарегистрироваться как покупатель',
      exact: true,
    })
    .click();
}
async function buy(p, provider, method) {
  await p.goto(base + '/product/STEAM-TOPUP-500');
  await p.locator(`input[name=seller][data-provider="${provider}"]`).check();
  await p.getByRole('button', { name: 'Добавить в корзину', exact: true }).click();
  await p.getByText('Товар добавлен.', { exact: false }).waitFor();
  await p.goto(base + '/cart');
  await p.locator(`input[name=payment-method][value=${method}]`).check();
  await p
    .getByRole('button', {
      name: method === 'balance' ? 'Подтвердить покупку' : 'Перейти к оплате',
      exact: true,
    })
    .click();
  await p.waitForURL(/\/cart\?order=/);
  return new URL(p.url()).searchParams.get('order');
}
async function terminal(p, id) {
  for (let n = 0; n < 60; n++) {
    const g = await api(p, `/api/account/orders/${id}`);
    if (g.terminal) return g;
    await p.waitForTimeout(250);
  }
  throw Error('Order never settled ' + id);
}
async function layout(p, label) {
  for (const width of [360, 390, 768, 1440]) {
    await p.setViewportSize({ width, height: 950 });
    const s = await p.evaluate(() => ({
      w: innerWidth,
      s: document.documentElement.scrollWidth,
      broken: [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src),
    }));
    assert(s.s <= s.w, `${label} ${width}: ${s.s}`);
    assert.deepEqual(s.broken, []);
  }
  checks.push(label + ' responsive');
}
try {
  const seller = await page();
  await register(seller, 'seller');
  await seller.waitForURL(base + '/seller/account');
  await seller.getByRole('heading', { name: 'Browser Store ' + suffix, exact: true }).waitFor();
  const account = await api(seller, '/api/account');
  const provider = account.user.seller_id;
  await seller.getByRole('button', { name: 'Добавить товар', exact: true }).click();
  const offer = seller.locator('.seller-offer-list form').filter({ hasText: 'STEAM-TOPUP-500' });
  await offer.getByLabel('Цена каждого ключа в партии, ₽').fill('475');
  await offer.getByLabel('Продаётся').check();
  await offer.getByRole('button', { name: 'Сохранить' }).click();
  await seller.getByRole('status').filter({ hasText: 'Предложение сохранено' }).waitFor();
  await seller.getByRole('button', { name: 'Ключи и остатки', exact: true }).click();
  await seller.getByLabel('Товар', { exact: true }).selectOption('STEAM-TOPUP-500');
  const key = `BROWSER-NEW-SELLER-${suffix}`.toUpperCase();
  await seller.getByLabel('Закупочная цена одного ключа, ₽', { exact: true }).fill('200');
  await seller.getByLabel('Ключи, по одному в строке').fill(key);
  await seller.getByRole('button', { name: 'Добавить ключи', exact: true }).click();
  await seller.getByRole('status').filter({ hasText: 'Добавлено: 1' }).waitFor();
  await seller.reload();
  await seller.locator('.key-price-card').first().waitFor();
  assert.equal(await seller.locator('.key-price-card').count(), 1);
  await seller.locator('.key-price-card').getByText('В продаже', { exact: true }).waitFor();
  await seller.screenshot({ path: shots + '/seller-own-products.png', fullPage: true });
  checks.push('public seller registration, own products by default, price, stock and procurement cost');
  const buyer = await page();
  await register(buyer, 'buyer');
  await buyer.getByRole('heading', { name: 'Мои покупки', exact: true }).waitFor();
  const id = await buy(buyer, provider, 'sbp');
  await buyer.getByRole('heading', { name: 'СБП · тестовый банк', exact: true }).waitFor();
  await buyer.reload();
  await buyer.getByRole('heading', { name: 'СБП · тестовый банк', exact: true }).waitFor();
  checks.push('pending checkout survives reload');
  await layout(buyer, 'SBP checkout');
  await buyer.screenshot({ path: shots + '/sbp-payment.png', fullPage: true });
  await buyer.getByRole('button', { name: 'Проверить ошибку оплаты', exact: true }).click();
  await buyer.getByRole('button', { name: 'Повторить оплату', exact: true }).waitFor();
  await buyer.getByRole('button', { name: 'Повторить оплату', exact: true }).click();
  await buyer.getByRole('button', { name: 'Имитировать успешную оплату', exact: true }).click();
  const order = await terminal(buyer, id);
  assert.equal(order.status, 'delivered');
  assert.equal(order.amount, 475);
  assert.equal(order.items[0].code, key);
  assert.equal((await api(buyer, '/api/account')).user.points_balance, 5000);
  checks.push('SBP failure/retry, exact seller price/key, no wallet debit');
  await seller.getByRole('button', { name: 'Продажи и сообщения', exact: true }).click();
  await seller.getByRole('button', { name: 'Обновить', exact: true }).click();
  const saleRow = seller.locator('tr').filter({ hasText: order.items[0].id });
  await saleRow.getByText('Прибыль:', { exact: false }).waitFor();
  assert.match(await saleRow.innerText(), /275/);
  const sales = await api(seller, '/api/seller/dashboard');
  assert.equal(sales.summary.net_income, 475);
  assert.equal(sales.summary.profit, 275);
  await seller.screenshot({ path: shots + '/seller-sales-profit.png', fullPage: true });
  await layout(seller, 'seller sales and profit');
  checks.push('seller sees the bought product, buyer, fixed price 475, procurement 200 and profit 275');
  const cryptoId = await buy(buyer, 'DEMO_REFUND', 'crypto');
  await buyer.getByRole('heading', { name: 'USDT · тестовая сеть', exact: true }).waitFor();
  await layout(buyer, 'crypto checkout');
  await buyer.screenshot({ path: shots + '/crypto-payment.png', fullPage: true });
  await buyer.getByRole('button', { name: 'Имитировать успешную оплату', exact: true }).click();
  const refunded = await terminal(buyer, cryptoId);
  assert.equal(refunded.status, 'refunded');
  assert.equal(refunded.refund_destination, 'wallet');
  await buyer.getByText('Средства возвращены на баланс личного кабинета.', { exact: false }).waitFor();
  assert.equal((await api(buyer, '/api/account')).user.points_balance, 5000 + refunded.amount);
  checks.push('crypto payment and automatic wallet refund');
  await buyer.goto(base + '/account');
  await buyer.getByLabel('Сумма пополнения', { exact: true }).fill('1200');
  await buyer.locator('.wallet-topup select').selectOption('sbp');
  await buyer.getByRole('button', { name: 'Пополнить баланс', exact: true }).click();
  await buyer.getByRole('button', { name: 'Имитировать успешную оплату', exact: true }).click();
  await buyer.getByText('Средства зачислены на баланс.', { exact: true }).waitFor();
  assert.equal((await api(buyer, '/api/account')).user.points_balance, 6200 + refunded.amount);
  await buyer.getByText('История баланса ·', { exact: false }).click();
  await buyer.getByText('СБП и криптоплатежи ·', { exact: false }).click();
  await layout(buyer, 'wallet and payments');
  await buyer.screenshot({ path: shots + '/buyer-wallet.png', fullPage: true });
  await buyer.setViewportSize({ width: 390, height: 844 });
  await buyer.screenshot({ path: shots + '/buyer-wallet-mobile.png', fullPage: true });
  checks.push('wallet top-up and database payment history');
  const walletId = await buy(buyer, 'DEMO_NOVA', 'balance');
  const walletOrder = await terminal(buyer, walletId);
  assert.equal(walletOrder.status, 'delivered');
  assert.equal(
    (await api(buyer, '/api/account')).user.points_balance,
    6200 + refunded.amount - walletOrder.amount,
  );
  checks.push('wallet purchase after top-up');
  const login = await fetch(apiBase + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: process.env.ADMIN_USERNAME ?? 'admin_demo',
      password: process.env.ADMIN_PASSWORD ?? 'AdminDemo2026!',
    }),
  });
  assert(login.ok);
  const admin = await login.json();
  const refund = await fetch(apiBase + `/api/admin/orders/${order.items[0].id}/refund`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ reason: 'Browser seller accounting verification' }),
  });
  assert(refund.ok);
  for (let n = 0; n < 60; n++) {
    const group = await api(buyer, `/api/account/orders/${id}`);
    if (group.status === 'refunded') break;
    await seller.waitForTimeout(250);
  }
  await seller.getByRole('button', { name: 'Обновить', exact: true }).click();
  const reversed = await api(seller, '/api/seller/dashboard');
  assert.equal(reversed.summary.net_income, 0);
  assert.equal(reversed.summary.refunded, 475);
  assert.equal(reversed.summary.profit, -200);
  await saleRow.getByText(/Прибыль:.*[-−]200/).waitFor();
  assert.match(await saleRow.innerText(), /-200|−200/);
  await seller.screenshot({ path: shots + '/seller-refund-profit.png', fullPage: true });
  checks.push('refund reverses seller income and retains procurement loss');
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        passed: true,
        checks,
        browser_errors: errors,
        seller: 'seller_' + suffix,
        buyer: 'buyer_' + suffix,
        orders: [id, cryptoId, walletId],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
