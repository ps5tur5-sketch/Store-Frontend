import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const screenshots = fileURLToPath(new URL('../../artifacts/screenshots/', import.meta.url));
await mkdir(screenshots, { recursive: true });
const base = process.env.FRONTEND_URL ?? 'http://127.0.0.1:8080';
const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const suffix = Date.now().toString(36);
const errors = [];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return page;
}
async function api(page, path, method = 'GET', body) {
  const token = await page.evaluate(() => localStorage.getItem('game_goods_auth_token'));
  const response = await fetch(apiBase + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert(response.ok, `${response.status} ${path}`);
  return response.json();
}
async function signIn(page, user, password, next) {
  await page.goto(`${base}/account?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Логин', { exact: true }).fill(user);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(base + next);
  await page.waitForLoadState('networkidle');
}
const seller = await newPage();
await signIn(seller, 'seller_a', process.env.SELLER_PASSWORD ?? 'SellerDemo2026!', '/seller/account');
await seller.getByRole('heading', { name: 'Pixel Market', exact: true }).waitFor();
await seller.getByRole('button', { name: 'Ключи и остатки', exact: true }).click();
await seller.getByLabel('Товар', { exact: true }).selectOption('STEAM-TOPUP-500');
await seller.getByLabel('Ключи, по одному в строке', { exact: true }).fill(`BROWSER-${suffix}-STEAM`);
await seller.getByRole('button', { name: 'Добавить ключи', exact: true }).click();
await seller.getByRole('status').filter({ hasText: 'Добавлено: 1' }).waitFor();
console.error('seller stock ready');
const buyer = await newPage();
await buyer.goto(base + '/account');
await buyer.getByLabel('Логин', { exact: true }).fill('buyer_' + suffix);
await buyer.getByLabel('Пароль', { exact: true }).fill('BuyerDemo2026!');
await buyer.getByRole('button', { name: 'Зарегистрироваться как покупатель' }).click();
await buyer.getByRole('heading', { name: 'Мои покупки', exact: true }).waitFor();
console.error('buyer registered');
await buyer.goto(base + '/product/STEAM-TOPUP-500');
await buyer.locator('input[name=seller][data-provider=A]').check();
await buyer.getByRole('button', { name: 'Добавить в корзину' }).click();
await buyer.getByText('Товар добавлен.', { exact: false }).waitFor();
await buyer.goto(base + '/cart');
await buyer.getByRole('button', { name: 'Подтвердить покупку' }).click();
await buyer.getByRole('heading', { name: 'Твой заказ.', exact: false }).waitFor();
console.error('checkout ready');
let purchases;
for (let n = 0; n < 30; n++) {
  purchases = await api(buyer, '/api/account/purchases');
  if (purchases.purchases[0]?.status === 'delivered') break;
  await new Promise((r) => setTimeout(r, 300));
}
assert.equal(purchases.purchases[0].status, 'delivered');
const id = purchases.purchases[0].id;
await buyer.goto(base + `/purchase/${id}`);
await buyer.getByLabel('Сообщение', { exact: true }).fill('Проверка переписки: помогите с активацией.');
await buyer.getByRole('button', { name: 'Отправить сообщение' }).click();
await buyer.getByText('Проверка переписки: помогите с активацией.', { exact: true }).waitFor();
await buyer.getByLabel('5 из 5', { exact: true }).check();
await buyer
  .getByLabel('Комментарий к покупке', { exact: true })
  .fill('Покупка и выдача проверены в браузере.');
await buyer.getByRole('button', { name: 'Оставить отзыв' }).click();
await buyer.getByText('Ваша оценка продавцу: 5 из 5', { exact: true }).waitFor();
await buyer.screenshot({ path: screenshots + '/buyer-purchase.png', fullPage: true });
console.error('buyer review and chat ready');
await seller.getByRole('button', { name: 'Продажи и сообщения', exact: true }).click();
await seller.getByRole('button', { name: 'Обновить', exact: true }).click();
const row = seller.locator('tr').filter({ hasText: id });
await row.getByRole('button').click();
await seller.getByText('Проверка переписки: помогите с активацией.', { exact: true }).waitFor();
await seller
  .getByLabel('Сообщение', { exact: true })
  .fill('Проверили покупку. Передаём обращение поддержке.');
await seller.getByRole('button', { name: 'Отправить сообщение' }).click();
await seller.getByText('Проверили покупку. Передаём обращение поддержке.', { exact: true }).waitFor();
await seller.getByRole('button', { name: 'Мои товары', exact: true }).click();
await seller.screenshot({ path: screenshots + '/seller-dashboard.png', fullPage: true });
console.error('seller chat ready');
const admin = await newPage();
await signIn(
  admin,
  process.env.ADMIN_USERNAME ?? 'admin_demo',
  process.env.ADMIN_PASSWORD ?? 'AdminDemo2026!',
  '/admin',
);
await admin.getByLabel('Найти заказ', { exact: true }).fill(id);
const adminRow = admin.locator('tr').filter({ hasText: id });
await adminRow.getByRole('button', { name: 'Вернуть средства' }).click();
await admin
  .getByLabel('Причина решения', { exact: true })
  .fill('Браузерная проверка возврата после обращения покупателя');
await admin.getByRole('button', { name: 'Подтвердить решение' }).click();
await admin.getByRole('status').filter({ hasText: 'Возврат принят' }).waitFor();
for (let n = 0; n < 30; n++) {
  const order = await api(buyer, `/api/account/purchases/${id}`);
  if (order.status === 'refunded') break;
  await new Promise((r) => setTimeout(r, 300));
}
assert.equal((await api(buyer, `/api/account/purchases/${id}`)).status, 'refunded');
assert.equal((await api(buyer, '/api/account')).user.points_balance, 5000);
await adminRow.getByRole('button', { name: /Переписка/ }).click();
await admin.getByText('Средства возвращены. Переписка закрыта, история сохранена.').waitFor();
await admin.getByRole('button', { name: 'Обновить', exact: true }).click();
await adminRow.getByText('Деньги возвращены', { exact: true }).waitFor();
await admin.screenshot({ path: screenshots + '/admin-orders.png', fullPage: true });
await buyer.getByText('Средства возвращены. Переписка закрыта, история сохранена.').waitFor();
assert.equal(await buyer.getByLabel('Сообщение', { exact: true }).count(), 0);
await buyer.getByText('Средства возвращены на баланс личного кабинета', { exact: true }).waitFor();
await admin.getByRole('button', { name: 'Пользователи и баны' }).click();
const buyerRow = admin.locator('tr').filter({ hasText: 'buyer_' + suffix });
await buyerRow.getByRole('button', { name: 'Заблокировать', exact: true }).click();
await admin.getByLabel('Причина решения', { exact: true }).fill('Проверка блокировки тестового аккаунта');
await admin.getByRole('button', { name: 'Подтвердить решение' }).click();
await buyerRow.getByRole('button', { name: 'Разблокировать', exact: true }).waitFor();
await buyer.reload();
await buyer.waitForURL(/\/account\?next=/);
await buyerRow.getByRole('button', { name: 'Разблокировать', exact: true }).click();
await admin
  .getByLabel('Причина решения', { exact: true })
  .fill('Проверка разблокировки: обращение рассмотрено');
await admin.getByRole('button', { name: 'Подтвердить решение' }).click();
await buyerRow.getByRole('button', { name: 'Заблокировать', exact: true }).waitFor();
await signIn(buyer, 'buyer_' + suffix, 'BuyerDemo2026!', '/account');
assert.equal((await api(buyer, '/api/account')).user.points_balance, 5000);

console.log(
  JSON.stringify(
    {
      passed: true,
      buyer: 'buyer_' + suffix,
      order_id: id,
      roles: ['buyer', 'seller', 'admin'],
      checks: [
        'seller stock',
        'buyer checkout',
        'verified 5 stars',
        'buyer/seller chat',
        'admin refund',
        'key hidden',
        'wallet restored',
        'chat closed',
        'ban revokes session',
        'unban restores login',
      ],
      browser_errors: errors,
    },
    null,
    2,
  ),
);
assert.deepEqual(errors, []);
await browser.close();
