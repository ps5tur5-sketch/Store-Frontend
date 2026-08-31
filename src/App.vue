<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { refreshAccount } from './auth';
import AccountPage from './components/AccountPage.vue';
import AdminPage from './components/AdminPage.vue';
import CartPage from './components/CartPage.vue';
import ProductPage from './components/ProductPage.vue';
import PurchaseDetailPage from './components/PurchaseDetailPage.vue';
import StorefrontPage from './components/StorefrontPage.vue';

const path = window.location.pathname;
const page = computed(() => {
  if (/^\/admin\/?$/.test(path)) return AdminPage;
  if (/^\/product\/[^/]+\/?$/.test(path)) return ProductPage;
  if (/^\/purchase\/[^/]+\/?$/.test(path)) return PurchaseDetailPage;
  if (/^\/cart\/?$/.test(path)) return CartPage;
  if (/^\/account\/?$/.test(path)) return AccountPage;
  return StorefrontPage;
});

onMounted(refreshAccount);
</script>

<template>
  <component :is="page" />
</template>
