import assert from 'node:assert/strict';
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
async function api(path) {
  const token = await page.evaluate(() => localStorage.getItem('game_goods_auth_token'));
  const response = await fetch(apiBase + path, { headers: { authorization: `Bearer ${token}` } });
  assert(response.ok);
  return response.json();
}
try {
  await page.goto(base + '/account');
  await page.getByLabel('Логин', { exact: true }).fill('withdraw_' + Date.now().toString(36));
  await page.getByLabel('Пароль', { exact: true }).fill('WithdrawDemo2026!');
  await page.getByRole('button', { name: 'Зарегистрироваться как покупатель', exact: true }).click();
  await page.getByRole('heading', { name: 'Мои покупки', exact: true }).waitFor();
  await page.getByRole('button', { name: /Вывести средства/ }).click();
  await page.getByLabel('Сумма вывода, ₽', { exact: true }).fill('1200');
  await page.getByLabel('Номер тестовой карты', { exact: true }).fill('0000 0000 0000 1234');
  await page.getByRole('button', { name: 'Создать вывод', exact: true }).click();
  await page.getByRole('button', { name: 'Имитировать успешный вывод', exact: true }).waitFor();
  assert.equal((await api('/api/account')).user.points_balance, 3800);
  await page.getByRole('button', { name: 'Имитировать успешный вывод', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Тестовый перевод выполнен' }).waitFor();
  assert.equal((await api('/api/account')).user.points_balance, 3800);
  await page.locator('.withdrawal-form select').selectOption('crypto');
  await page.getByLabel('Сумма вывода, ₽', { exact: true }).fill('700');
  await page.getByLabel('Адрес тестового кошелька', { exact: true }).fill('DEMO-USDT-MY-WALLET-12345');
  await page.getByRole('button', { name: 'Создать вывод', exact: true }).click();
  await page.getByRole('button', { name: 'Имитировать отказ вывода', exact: true }).waitFor();
  assert.equal((await api('/api/account')).user.points_balance, 3100);
  await page.getByRole('button', { name: 'Имитировать отказ вывода', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Отказ · деньги снова на балансе' }).waitFor();
  assert.equal((await api('/api/account')).user.points_balance, 3800);
  await page.getByLabel('Адрес тестового кошелька', { exact: true }).fill('DEMO-USDT-MY-WALLET-12345');
  await page.getByRole('button', { name: 'Создать вывод', exact: true }).click();
  await page.getByRole('button', { name: 'Имитировать успешный вывод', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Тестовый перевод выполнен' }).waitFor();
  assert.equal((await api('/api/account')).user.points_balance, 3100);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    assert(
      (await page.evaluate(() => document.documentElement.scrollWidth)) <= width,
      `withdrawal overflow ${width}`,
    );
  }
  await page.screenshot({
    path: fileURLToPath(new URL('../../artifacts/screenshots/wallet-withdrawals.png', import.meta.url)),
    fullPage: true,
  });
  await page.reload();
  await page.getByRole('button', { name: /Вывести средства/ }).click();
  await page.getByText('История вывода · 3', { exact: true }).waitFor();
  assert.equal((await api('/api/account')).user.points_balance, 3100);
  await page.goto(base + '/product/STEAM-TOPUP-500');
  await page
    .getByText(
      'Тест возврата: этот продавец не выдаёт ключи. Оплата полностью возвращается на баланс аккаунта.',
      { exact: true },
    )
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        passed: true,
        checks: [
          'card withdrawal reserve and success',
          'crypto withdrawal failure releases reserve',
          'crypto withdrawal success',
          'withdrawal history survives reload',
          'account balance agrees with API',
          '360/390/768/1440 layout',
          'Demo Refund is clearly labelled',
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
