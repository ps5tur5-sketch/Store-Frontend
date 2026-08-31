<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { accountUser, authReady, login, logout, refreshAccount, register } from '../auth';
import { authApi } from '../api';
import type { Purchase } from '../types';
import PurchaseModal from './PurchaseModal.vue';
import SiteHeader from './SiteHeader.vue';

const mode = ref<'login' | 'register'>('register');
const username = ref('');
const password = ref('');
const busy = ref(false);
const error = ref('');
const purchases = ref<Purchase[]>([]);
const selectedPurchase = ref<Purchase>();
const selectedIndex = ref(0);
const search = ref('');
const next = new URLSearchParams(window.location.search).get('next');

const statusLabels: Record<string, string> = {
  created: 'Создан', paid: 'Оплачен', delivering: 'Выдаётся', delivered: 'Выдан',
  payment_failed: 'Ошибка оплаты', out_of_stock: 'Ожидает пополнения', delivery_failed: 'Повторная выдача',
};

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' баллов';
}

function date(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

async function loadPurchases(): Promise<void> {
  if (!accountUser.value) return;
  const result = await authApi<{ purchases: Purchase[] }>('/api/account/purchases');
  purchases.value = result.purchases;
}

async function openPurchase(purchase: Purchase, index: number): Promise<void> {
  selectedIndex.value = index;
  selectedPurchase.value = await authApi<Purchase>(`/api/account/purchases/${encodeURIComponent(purchase.id)}`);
}

async function refreshSelected(): Promise<void> {
  if (!selectedPurchase.value) return;
  selectedPurchase.value = await authApi<Purchase>(`/api/account/purchases/${encodeURIComponent(selectedPurchase.value.id)}`);
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
    if (mode.value === 'register') await register(username.value, password.value);
    else await login(username.value, password.value);
    if (next?.startsWith('/')) {
      window.location.href = next;
      return;
    }
    await loadPurchases();
  } catch (caught) {
    error.value = (caught as Error).message;
  } finally {
    busy.value = false;
  }
}

async function signOut(): Promise<void> {
  await logout();
  purchases.value = [];
  mode.value = 'login';
}

onMounted(async () => {
  document.title = 'Личный кабинет — Game Goods';
  if (!authReady.value) await refreshAccount();
  await loadPurchases();
});
</script>

<template>
  <div class="store-bg"><div class="storefront site-page">
    <SiteHeader v-model="search" />
    <main class="inner-page account-page">
      <nav class="breadcrumbs"><a href="/">Каталог</a><span>›</span><span>Личный кабинет</span></nav>

      <section v-if="authReady && !accountUser" class="auth-layout">
        <div class="auth-promo"><span>5000</span><h1>Баллов сразу после регистрации</h1><p>Никакой почты, подтверждений и анкет. Только логин и пароль.</p><ul><li>Серверная корзина</li><li>Оплата баллами или кодом</li><li>История покупок с цифровыми ключами</li></ul></div>
        <form class="auth-form" @submit.prevent="submitAuth">
          <div class="auth-tabs"><button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">Регистрация</button><button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">Вход</button></div>
          <h2>{{ mode === 'register' ? 'Создать аккаунт' : 'Войти в аккаунт' }}</h2>
          <p>{{ mode === 'register' ? 'Получите 5000 баллов на покупки.' : 'Используйте логин и пароль.' }}</p>
          <label>Логин<input v-model="username" minlength="3" maxlength="32" pattern="[A-Za-zА-Яа-яЁё0-9_.-]+" autocomplete="username" required placeholder="Ваш логин"></label>
          <label>Пароль<input v-model="password" type="password" minlength="6" maxlength="128" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" required placeholder="Минимум 6 символов"></label>
          <div v-if="error" class="inline-error">{{ error }}</div>
          <button class="auth-submit" :disabled="busy">{{ busy ? 'Подождите…' : mode === 'register' ? 'Зарегистрироваться и получить 5000' : 'Войти' }}</button>
          <small>Электронная почта не используется.</small>
        </form>
      </section>

      <template v-else-if="accountUser">
        <header class="profile-header"><div class="profile-avatar">{{ accountUser.username.slice(0, 1).toUpperCase() }}</div><div><small>ЛИЧНЫЙ КАБИНЕТ</small><h1>{{ accountUser.username }}</h1><p>Аккаунт создан {{ date(accountUser.created_at) }}</p></div><div class="profile-balance"><span>Баланс</span><strong>{{ money(accountUser.points_balance) }}</strong><a href="/cart">Открыть корзину</a></div><button @click="signOut">Выйти</button></header>

        <section class="purchases-section">
          <div class="section-title"><div><h2>Мои покупки</h2><p>От новых к старым. Нажмите товар, чтобы открыть его карточку и код.</p></div><span>{{ purchases.length }} покупок</span></div>
          <div v-if="!purchases.length" class="empty-purchases"><h3>Покупок пока нет</h3><p>Добавьте товары в корзину и оплатите их баллами или кодом.</p><a href="/">Открыть каталог</a></div>
          <div v-else class="purchase-list">
            <a v-for="(purchase, index) in purchases" :key="purchase.id" :href="`/purchase/${encodeURIComponent(purchase.id)}`" class="purchase-row" @click.prevent="openPurchase(purchase, index)">
              <div class="purchase-thumb reference-cover"></div><div><span>{{ purchase.type }}</span><h3>{{ purchase.name }}</h3><code>{{ purchase.id }}</code></div><time :datetime="purchase.created_at">{{ date(purchase.created_at) }}</time><strong>{{ money(purchase.amount) }}</strong><b class="purchase-status" :data-status="purchase.status">{{ statusLabels[purchase.status] || purchase.status }}</b><i>›</i>
            </a>
          </div>
        </section>
      </template>
    </main>
    <PurchaseModal v-if="selectedPurchase" :purchase="selectedPurchase" :index="selectedIndex" :total="purchases.length" @close="selectedPurchase = undefined" @refresh="refreshSelected" @previous="moveSelected(-1)" @next="moveSelected(1)" />
  </div></div>
</template>
