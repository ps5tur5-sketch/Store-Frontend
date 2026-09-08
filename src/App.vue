<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { refreshAccount } from './auth';
import AccountPage from './components/AccountPage.vue';
import AdminPage from './components/AdminPage.vue';
import CartPage from './components/CartPage.vue';
import ProductPage from './components/ProductPage.vue';
import PurchaseDetailPage from './components/PurchaseDetailPage.vue';
import SellerDashboard from './components/SellerDashboard.vue';
import SellerPage from './components/SellerPage.vue';
import StorefrontPage from './components/StorefrontPage.vue';

const path = window.location.pathname;
const page = computed(() => {
  if (/^\/admin\/?$/.test(path)) return AdminPage;
  if (/^\/product\/[^/]+\/?$/.test(path)) return ProductPage;
  if (/^\/purchase\/[^/]+\/?$/.test(path)) return PurchaseDetailPage;
  if (path === '/seller/account') return SellerDashboard;
  if (/^\/seller\/[^/]+\/?$/.test(path)) return SellerPage;
  if (/^\/cart\/?$/.test(path)) return CartPage;
  if (/^\/account\/?$/.test(path)) return AccountPage;
  return StorefrontPage;
});

const ready = ref(false),
  startupError = ref('');
onMounted(async () => {
  try {
    await refreshAccount();
    ready.value = true;
  } catch {
    startupError.value = 'Не удалось загрузить аккаунт. Проверьте соединение и обновите страницу.';
  }
});
</script>

<template>
  <component v-if="ready" :is="page" />
  <main v-else class="store-bg startup-screen">
    <h1>Game Goods</h1>
    <p>{{ startupError || 'Загружаем ваш аккаунт…' }}</p>
    <a v-if="startupError" href="">Повторить</a>
  </main>
</template>
