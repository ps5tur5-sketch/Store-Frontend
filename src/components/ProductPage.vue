<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { accountUser, refreshCartCount } from '../auth';
import { api, authApi } from '../api';
import type { Cart, Product } from '../types';
import SiteHeader from './SiteHeader.vue';

const sku = decodeURIComponent(window.location.pathname.replace(/^\/product\//, '').replace(/\/$/, ''));
const product = ref<Product>();
const related = ref<Product[]>([]);
const busy = ref(false);
const notice = ref('');
const error = ref('');
const search = ref('');
const oldPrice = computed(() => product.value ? Math.round(product.value.price * 1.9) : 0);

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

async function addToCart(): Promise<void> {
  if (!product.value) return;
  if (!accountUser.value) {
    window.location.href = `/account?next=${encodeURIComponent(window.location.pathname)}`;
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const cart = await authApi<Cart>('/api/cart/items', {
      method: 'POST', body: JSON.stringify({ sku: product.value.sku, quantity: 1 }),
    });
    await refreshCartCount();
    notice.value = `Товар добавлен. В корзине ${cart.item_count}.`;
  } catch (caught) {
    error.value = (caught as Error).message;
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    product.value = await api<Product>(`/api/catalog/${encodeURIComponent(sku)}`);
    document.title = `${product.value.name} — Game Goods`;
    const catalog = await api<{ items: Product[] }>('/api/catalog?limit=100');
    related.value = catalog.items.filter((item) => item.sku !== sku && item.type === product.value?.type).slice(0, 4);
    if (related.value.length < 4) related.value.push(...catalog.items.filter((item) => item.sku !== sku && !related.value.some((current) => current.sku === item.sku)).slice(0, 4 - related.value.length));
  } catch (caught) {
    error.value = (caught as Error).message;
  }
});
</script>

<template>
  <div class="store-bg"><div class="storefront site-page">
    <SiteHeader v-model="search" />
    <main class="inner-page">
      <nav class="breadcrumbs"><a href="/">Каталог</a><span>›</span><span>{{ product?.name || sku }}</span></nav>
      <div v-if="error" class="page-message error">{{ error }}</div>
      <template v-if="product">
        <section class="product-detail">
          <div class="product-detail-cover reference-cover"><span>{{ product.type }}</span></div>
          <div class="product-detail-info">
            <span class="product-badge">Цифровой товар · мгновенная выдача</span>
            <h1>{{ product.name }}</h1>
            <code>{{ product.sku }}</code>
            <div class="detail-rating"><b>★★★★★</b><span>4.9 · 327 отзывов</span></div>
            <p>{{ product.description }}</p>
            <ul><li v-for="feature in product.features" :key="feature">{{ feature }}</li></ul>
            <div class="detail-buy-box"><div><b>{{ money(product.price) }}</b><del>{{ money(oldPrice) }}</del><small :class="{ empty: product.available === 0 }">{{ product.available ? `Доступно: ${product.available}` : 'Нет в наличии' }}</small></div><button :disabled="busy || product.available === 0" @click="addToCart">{{ busy ? 'Добавляем…' : 'Добавить в корзину' }}</button></div>
            <div v-if="notice" class="inline-success">{{ notice }} <a href="/cart">Перейти в корзину</a></div>
          </div>
        </section>

        <section class="description-panel"><h2>Описание товара</h2><p>{{ product.description }}</p><h3>Как получить товар</h3><ol><li>Войдите или зарегистрируйтесь по логину и паролю.</li><li>Добавьте товар в корзину.</li><li>Оплатите корзину баллами или одноразовым платёжным кодом.</li><li>Откройте «Мои покупки» и скопируйте выданный код.</li></ol></section>

        <section class="related-products"><div class="section-title"><h2>Похожие товары</h2><a href="/">Все товары</a></div><div class="related-grid"><a v-for="item in related" :key="item.sku" :href="`/product/${encodeURIComponent(item.sku)}`" class="related-card"><div class="reference-cover"></div><span>{{ item.type }}</span><h3>{{ item.name }}</h3><b>{{ money(item.price) }}</b></a></div></section>
      </template>
    </main>
  </div></div>
</template>
