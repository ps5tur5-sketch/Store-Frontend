<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { accountUser, refreshCartCount } from '../auth';
import { api, authApi } from '../api';
import { Flag, Star, ShieldCheck } from '@lucide/vue';
import type { Cart, Product } from '../types';
import SiteHeader from './SiteHeader.vue';
import { typeLabels } from '../format';

const sku = decodeURIComponent(window.location.pathname.replace(/^\/product\//, '').replace(/\/$/, ''));
const product = ref<Product>();
const related = ref<Product[]>([]);
const busy = ref(false);
const notice = ref('');
const error = ref('');
const search = ref('');
const selectedOfferId = ref('');
const selectedOffer = computed(() =>
  product.value?.offers?.find((o) => o.offer_id === selectedOfferId.value),
);

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
      method: 'POST',
      body: JSON.stringify({
        sku: product.value.sku,
        quantity: 1,
        provider: selectedOffer.value?.provider,
        offer_id: selectedOfferId.value,
      }),
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
    product.value = await authApi<Product>(`/api/catalog/${encodeURIComponent(sku)}`);
    selectedOfferId.value = product.value.default_offer_id ?? '';
    document.title = `${product.value.name} — Game Goods`;
    const catalog = await api<{ items: Product[] }>('/api/catalog?limit=100');
    related.value = catalog.items
      .filter((item) => item.sku !== sku && item.type === product.value?.type)
      .slice(0, 4);
    if (related.value.length < 4)
      related.value.push(
        ...catalog.items
          .filter((item) => item.sku !== sku && !related.value.some((current) => current.sku === item.sku))
          .slice(0, 4 - related.value.length),
      );
  } catch (caught) {
    error.value = (caught as Error).message;
  }
});
</script>

<template>
  <div class="store-bg">
    <div class="storefront site-page">
      <SiteHeader v-model="search" />
      <main class="inner-page">
        <nav class="breadcrumbs">
          <a href="/">Каталог</a><span>›</span><span>{{ product?.name || sku }}</span>
        </nav>
        <div v-if="error" class="page-message error">{{ error }}</div>
        <template v-if="product">
          <section class="product-detail">
            <div class="product-detail-cover">
              <img :src="product.image" :alt="product.name" /><span>{{ typeLabels[product.type] }}</span>
            </div>
            <div class="product-detail-info">
              <span class="product-badge">Цифровой товар · автоматическая выдача</span>
              <h1>{{ product.name }}</h1>
              <code>{{ product.sku }}</code>
              <p>{{ product.description }}</p>
              <ul>
                <li v-for="feature in product.features" :key="feature">{{ feature }}</li>
              </ul>
              <section id="sellers" class="seller-offers">
                <h2>
                  Выбери предложение <span>{{ product.offers?.length }}</span>
                </h2>
                <p>У одного продавца могут быть партии с разными ценами. Выбери нужную перед покупкой.</p>
                <label
                  v-for="offer in product.offers"
                  :key="offer.offer_id"
                  class="seller-offer"
                  :class="{
                    selected: selectedOfferId === offer.offer_id,
                    flagged: offer.seller.flag === 'red',
                  }"
                  ><input
                    v-model="selectedOfferId"
                    type="radio"
                    name="seller"
                    :value="offer.offer_id"
                    :data-provider="offer.provider"
                    :disabled="!offer.available"
                  />
                  <div class="offer-seller">
                    <span v-if="offer.seller.demo_notice" class="demo-scenario-notice">{{
                      offer.seller.demo_notice
                    }}</span>
                    <span class="offer-lot-name">{{ offer.offer_name }}</span
                    ><a :href="`/seller/${offer.provider}`">{{ offer.seller.name }} ↗</a
                    ><span class="seller-rating"
                      ><Star :size="12" />{{
                        offer.seller.rating === null
                          ? 'Пока без оценок'
                          : `${offer.seller.rating} / 5 · ${offer.seller.review_count} отзывов`
                      }}</span
                    ><span v-if="offer.seller.flag === 'red'" class="red-flag"
                      ><Flag :size="12" />Подтверждённые нарушения</span
                    ><span v-else class="seller-neutral"
                      ><ShieldCheck :size="12" />Нарушений не выявлено</span
                    >
                  </div>
                  <div class="offer-price">
                    <b>{{ money(offer.price) }}</b
                    ><small>{{ offer.available ? `${offer.available} в наличии` : 'Нет в наличии' }}</small>
                  </div></label
                >
              </section>
              <div v-if="selectedOffer?.seller.flag === 'red'" class="seller-warning" role="note">
                <Flag :size="18" /><span
                  >У этого продавца есть подтверждённые нарушения.
                  <a :href="`/seller/${selectedOffer?.provider}`">Посмотреть доказательства</a></span
                >
              </div>
              <div class="detail-buy-box">
                <div>
                  <b>{{ money(selectedOffer?.price ?? product.price) }}</b
                  ><small :class="{ empty: !selectedOffer?.available }">{{
                    selectedOffer?.available ? `Доступно: ${selectedOffer.available}` : 'Нет в наличии'
                  }}</small>
                </div>
                <a v-if="accountUser && !accountUser.can_buy" href="/account">Войти как покупатель</a>
                <button
                  v-else
                  :disabled="busy || !selectedOffer?.available || selectedOffer?.purchasable === false"
                  @click="addToCart"
                >
                  {{
                    selectedOffer?.purchase_disabled_reason === 'own_store'
                      ? 'Это ваш магазин'
                      : busy
                        ? 'Добавляем…'
                        : 'Добавить в корзину'
                  }}
                </button>
              </div>
              <div v-if="notice" class="inline-success">
                {{ notice }} <a href="/cart">Перейти в корзину</a>
              </div>
            </div>
          </section>

          <section class="description-panel">
            <h2>Описание товара</h2>
            <p>{{ product.description }}</p>
            <h3>Как получить товар</h3>
            <ol>
              <li>Войдите или зарегистрируйтесь по логину и паролю.</li>
              <li>Добавьте товар в корзину.</li>
              <li>Оплатите с баланса, через СБП или криптовалютой. Доступен тестовый платёж.</li>
              <li>Откройте «Мои покупки» и скопируйте выданный код.</li>
            </ol>
          </section>

          <section class="related-products">
            <div class="section-title">
              <h2>Похожие товары</h2>
              <a href="/">Все товары</a>
            </div>
            <div class="related-grid">
              <a
                v-for="item in related"
                :key="item.sku"
                :href="`/product/${encodeURIComponent(item.sku)}`"
                class="related-card"
                ><img :src="item.image" :alt="item.name" /><span>{{ typeLabels[item.type] }}</span>
                <h3>{{ item.name }}</h3>
                <b>{{ money(item.price) }}</b></a
              >
            </div>
          </section>
        </template>
      </main>
    </div>
  </div>
</template>
