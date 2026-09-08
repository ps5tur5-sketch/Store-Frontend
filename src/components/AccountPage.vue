<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { accountUser, authReady, login, logout, refreshAccount, register } from '../auth';
import { authApi } from '../api';
import type { Purchase, OrderGroup } from '../types';
import PurchaseModal from './PurchaseModal.vue';
import SiteHeader from './SiteHeader.vue';
import OrderProgress from './OrderProgress.vue';
import SellerActivation from './SellerActivation.vue';
import AccountWallet from './AccountWallet.vue';
import { statusLabels } from '../format';

const mode = ref<'login' | 'register'>(
  new URLSearchParams(location.search).has('next') ? 'login' : 'register',
);
const role = ref<'buyer' | 'seller'>(
  new URLSearchParams(location.search).get('role') === 'seller' ? 'seller' : 'buyer',
);
const storeName = ref('');
const username = ref('');
const password = ref('');
const busy = ref(false);
const error = ref('');
const purchases = ref<Purchase[]>([]);
const selectedPurchase = ref<Purchase>();
const selectedIndex = ref(0);
const search = ref('');
const next = new URLSearchParams(window.location.search).get('next');

const orders = ref<OrderGroup[]>([]);
let pollTimer: number | undefined;
let disposed = false;

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function date(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

async function loadPurchases(): Promise<void> {
  if (!accountUser.value) return;
  const result = await authApi<{ purchases: Purchase[]; orders: OrderGroup[] }>('/api/account/purchases');
  purchases.value = result.purchases.filter((p) => !p.group_id);
  orders.value = result.orders;
  await refreshAccount();
  if (!disposed && accountUser.value?.can_buy) {
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(
      () =>
        void loadPurchases().catch(() => {
          error.value = 'Не удалось обновить покупки.';
        }),
      result.orders.some((o) => !o.terminal) ? 2000 : 5000,
    );
  }
}

async function openPurchase(purchase: Purchase, index: number): Promise<void> {
  selectedIndex.value = index;
  selectedPurchase.value = await authApi<Purchase>(
    `/api/account/purchases/${encodeURIComponent(purchase.id)}`,
  );
}

async function refreshSelected(): Promise<void> {
  if (!selectedPurchase.value) return;
  try {
    selectedPurchase.value = await authApi<Purchase>(
      `/api/account/purchases/${encodeURIComponent(selectedPurchase.value.id)}`,
    );
  } catch {
    error.value = 'Не удалось обновить карточку покупки.';
  }
}

async function moveSelected(delta: number): Promise<void> {
  const nextIndex = selectedIndex.value + delta;
  const nextPurchase = purchases.value[nextIndex];
  if (nextPurchase) await openPurchase(nextPurchase, nextIndex);
}

async function submitAuth(): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    if (mode.value === 'register')
      await register(username.value, password.value, role.value, storeName.value);
    else await login(username.value, password.value);
    if (accountUser.value?.role === 'admin') {
      window.location.href = '/admin';
      return;
    }
    if (next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) {
      window.location.href = next;
      return;
    }
    if (mode.value === 'register' && role.value === 'seller' && accountUser.value?.can_sell) {
      location.href = '/seller/account';
      return;
    }
    await loadPurchases();
  } catch (caught) {
    error.value =
      (
        {
          username_already_exists: 'Этот логин уже занят. Войдите в аккаунт или выберите другой.',
          invalid_username_or_password: 'Неверный логин или пароль.',
          account_banned: 'Аккаунт заблокирован.',
          'Validation failed': 'Проверьте логин, пароль и ник продавца.',
        } as Record<string, string>
      )[(caught as Error).message] ?? 'Не удалось войти. Попробуйте ещё раз.';
  } finally {
    busy.value = false;
  }
}

async function signOut(): Promise<void> {
  await logout();
  purchases.value = [];
  orders.value = [];
  window.clearTimeout(pollTimer);
  mode.value = 'login';
}

onMounted(async () => {
  document.title = 'Личный кабинет — Game Goods';
  if (!authReady.value) await refreshAccount();
  try {
    await loadPurchases();
  } catch {
    error.value = 'Не удалось загрузить покупки. Обновите страницу.';
  }
});
onBeforeUnmount(() => {
  disposed = true;
  window.clearTimeout(pollTimer);
});
async function openOrderItem(id: string) {
  try {
    selectedPurchase.value = await authApi<Purchase>(`/api/account/purchases/${encodeURIComponent(id)}`);
  } catch {
    error.value = 'Не удалось открыть покупку.';
  }
}
</script>

<template>
  <div class="store-bg">
    <div class="storefront site-page">
      <SiteHeader v-model="search" />
      <main class="inner-page account-page">
        <nav class="breadcrumbs"><a href="/">Каталог</a><span>›</span><span>Личный кабинет</span></nav>

        <section v-if="authReady && !accountUser" class="auth-layout">
          <div class="auth-promo">
            <span>{{ role === 'seller' ? 'Твой магазин' : '5 000 ₽' }}</span>
            <h1>{{ role === 'seller' ? 'Продавай. Развивай репутацию.' : 'На первые впечатления' }}</h1>
            <p>
              {{
                role === 'seller'
                  ? 'Управляй предложениями, загружай ключи и общайся с покупателями в своём кабинете.'
                  : 'Создай аккаунт покупателя и получи 5 000 тестовых рублей на первую покупку.'
              }}
            </p>
            <ul>
              <li>
                {{ role === 'seller' ? 'Свой магазин и свои цены' : 'Сравнивай цены разных продавцов' }}
              </li>
              <li>
                {{ role === 'seller' ? 'Склад ключей и история продаж' : 'Баланс, СБП и криптовалюта' }}
              </li>
              <li>Отзывы только после реальной покупки</li>
            </ul>
          </div>
          <form class="auth-form" @submit.prevent="submitAuth">
            <div class="auth-tabs">
              <button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">
                Регистрация</button
              ><button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">
                Вход
              </button>
            </div>
            <h2>{{ mode === 'register' ? 'Создать аккаунт' : 'Войти в аккаунт' }}</h2>
            <p>
              {{
                mode === 'register'
                  ? 'Выберите, как хотите использовать Game Goods.'
                  : 'Один вход для покупателя, продавца и администратора.'
              }}
            </p>
            <fieldset v-if="mode === 'register'" class="role-selector">
              <legend>Тип аккаунта</legend>
              <label :class="{ active: role === 'buyer' }"
                ><input v-model="role" type="radio" value="buyer" name="role" /><strong>Я покупатель</strong
                ><small>Покупки и 5 000 ₽ на старт</small></label
              >
              <label :class="{ active: role === 'seller' }"
                ><input v-model="role" type="radio" value="seller" name="role" /><strong>Я продавец</strong
                ><small>Магазин, ключи и продажи</small></label
              >
            </fieldset>
            <label v-if="mode === 'register' && role === 'seller'"
              >Ник продавца<input
                v-model="storeName"
                required
                minlength="2"
                maxlength="100"
                placeholder="Как вас увидят покупатели"
                autocomplete="organization"
            /></label>
            <label
              >Логин<input
                v-model="username"
                minlength="3"
                maxlength="32"
                autocomplete="username"
                required
                placeholder="Ваш логин"
            /></label>
            <label
              >Пароль<input
                v-model="password"
                type="password"
                minlength="6"
                maxlength="128"
                :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
                required
                placeholder="Минимум 6 символов"
            /></label>
            <div v-if="error" class="inline-error">{{ error }}</div>
            <button class="auth-submit" :disabled="busy">
              {{
                busy
                  ? 'Подождите…'
                  : mode === 'register'
                    ? role === 'seller'
                      ? 'Зарегистрироваться как продавец'
                      : 'Зарегистрироваться как покупатель'
                    : 'Войти'
              }}
            </button>
            <small>Электронная почта не используется.</small>
          </form>
        </section>

        <template v-else-if="accountUser">
          <header class="profile-header">
            <div class="profile-avatar">{{ accountUser.username.slice(0, 1).toUpperCase() }}</div>
            <div>
              <small>ЛИЧНЫЙ КАБИНЕТ</small>
              <h1>{{ accountUser.username }}</h1>
              <p>Аккаунт создан {{ date(accountUser.created_at) }}</p>
            </div>
            <div class="profile-balance">
              <span>Баланс</span><strong>{{ money(accountUser.points_balance) }}</strong
              ><a href="/cart">Открыть корзину</a>
            </div>
            <button @click="signOut">Выйти</button>
          </header>

          <a v-if="accountUser.role === 'admin'" class="auth-submit" href="/admin"
            >Открыть панель управления</a
          >
          <a v-if="accountUser.can_sell" class="auth-submit" href="/seller/account"
            >Открыть кабинет продавца</a
          >
          <SellerActivation v-if="accountUser.can_become_seller" />
          <AccountWallet v-if="accountUser.can_buy" />
          <section v-if="accountUser.can_buy" class="purchases-section">
            <div class="section-title">
              <div>
                <h2>Мои покупки</h2>
                <p>От новых к старым. Нажмите товар, чтобы открыть его карточку и код.</p>
              </div>
              <span>{{ orders.length + purchases.length }} заказов</span>
            </div>
            <div v-if="error" class="inline-error" role="alert">{{ error }}</div>
            <OrderProgress v-for="order in orders" :key="order.id" :order="order" @open="openOrderItem" />
            <div v-if="!purchases.length && !orders.length" class="empty-purchases">
              <h3>Покупок пока нет</h3>
              <p>Добавьте товары в корзину и выберите удобный способ оплаты.</p>
              <a href="/">Открыть каталог</a>
            </div>
            <div v-if="purchases.length" class="purchase-list">
              <a
                v-for="(purchase, index) in purchases"
                :key="purchase.id"
                :href="`/purchase/${encodeURIComponent(purchase.id)}`"
                class="purchase-row"
                @click.prevent="openPurchase(purchase, index)"
              >
                <div class="purchase-thumb"><img :src="purchase.image" :alt="purchase.name" /></div>
                <div>
                  <span>{{ purchase.type }}</span>
                  <h3>{{ purchase.name }}</h3>
                  <code>{{ purchase.id }}</code>
                </div>
                <time :datetime="purchase.created_at">{{ date(purchase.created_at) }}</time
                ><strong>{{ money(purchase.amount) }}</strong
                ><b class="purchase-status" :data-status="purchase.status">{{
                  statusLabels[purchase.status] || purchase.status
                }}</b
                ><i>›</i>
              </a>
            </div>
          </section>
        </template>
      </main>
      <PurchaseModal
        v-if="selectedPurchase"
        :purchase="selectedPurchase"
        :index="selectedIndex"
        :total="purchases.length"
        @close="selectedPurchase = undefined"
        @refresh="refreshSelected"
        @previous="moveSelected(-1)"
        @next="moveSelected(1)"
      />
    </div>
  </div>
</template>
