<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import steamIcon from '@iconify-icons/logos/steam';
import telegramIcon from '@iconify-icons/logos/telegram';
import appStoreIcon from '@iconify-icons/logos/apple-app-store';
import openaiIcon from '@iconify-icons/logos/openai-icon';
import tiktokIcon from '@iconify-icons/logos/tiktok-icon';
import robloxIcon from '@iconify-icons/arcticons/roblox';
import brawlStarsIcon from '@iconify-icons/arcticons/brawlstars';
import pubgIcon from '@iconify-icons/arcticons/pubg-mobile';
import playstationIcon from '@iconify-icons/arcticons/playstation-family';
import mobileLegendsIcon from '@iconify-icons/arcticons/mobile-legends-bang-bang';
import { CircleEllipsis } from '@lucide/vue';
import { accountUser, refreshCartCount } from '../auth';
import { api, apiBase, authApi } from '../api';
import type { Cart, Product } from '../types';
import SiteHeader from './SiteHeader.vue';

const services = [
  { name: 'Steam', icon: steamIcon, tone: 'steam' }, { name: 'Telegram', icon: telegramIcon, tone: 'telegram' },
  { name: 'Roblox', icon: robloxIcon, tone: 'roblox' }, { name: 'Brawl Stars', icon: brawlStarsIcon, tone: 'brawl' },
  { name: 'PUBG Mobile', icon: pubgIcon, tone: 'pubg' }, { name: 'App Store', icon: appStoreIcon, tone: 'appstore' },
  { name: 'ChatGPT', icon: openaiIcon, tone: 'chatgpt' }, { name: 'PlayStation', icon: playstationIcon, tone: 'playstation' },
  { name: 'TikTok', icon: tiktokIcon, tone: 'tiktok' }, { name: 'Mobile Legends', icon: mobileLegendsIcon, tone: 'mobile' },
];
const categoryFilters = [
  { value: '', label: 'Донат' }, { value: 'subscription', label: 'Подписки' },
  { value: 'topup', label: 'Пополнения' }, { value: 'giftcard', label: 'Подарочные карты' },
  { value: 'key', label: 'Ключи' },
];

const products = ref<Product[]>([]);
const search = ref(new URLSearchParams(window.location.search).get('q') ?? '');
const activeType = ref('');
const busySku = ref('');
const notice = ref('');
const error = ref('');
const steamLogin = ref('');

const availableTotal = computed(() => products.value.reduce((sum, product) => sum + product.available, 0));
const filteredProducts = computed(() => {
  const needle = search.value.trim().toLowerCase();
  return products.value.filter((product) => (!activeType.value || product.type === activeType.value)
    && (!needle || `${product.name} ${product.sku}`.toLowerCase().includes(needle)));
});
const quickProduct = computed(() => products.value.find((product) => product.sku === 'STEAM-TOPUP-500'));

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function sectionProducts(offset: number): Product[] {
  const source = filteredProducts.value;
  if (!source.length) return [];
  return Array.from({ length: Math.min(5, source.length) }, (_, index) => source[(offset + index) % source.length]);
}

function productHref(product: Product): string {
  return `/product/${encodeURIComponent(product.sku)}`;
}

async function addToCart(product: Product): Promise<void> {
  notice.value = '';
  error.value = '';
  if (!accountUser.value) {
    window.location.href = `/account?next=${encodeURIComponent(window.location.pathname)}`;
    return;
  }
  busySku.value = product.sku;
  try {
    const cart = await authApi<Cart>('/api/cart/items', {
      method: 'POST', body: JSON.stringify({ sku: product.sku, quantity: 1 }),
    });
    await refreshCartCount();
    notice.value = `${product.name} добавлен в корзину. В корзине: ${cart.item_count}.`;
  } catch (caught) {
    error.value = (caught as Error).message;
  } finally {
    busySku.value = '';
  }
}

onMounted(async () => {
  document.title = 'Game Goods — цифровые товары';
  try {
    const result = await api<{ items: Product[] }>('/api/catalog?limit=100');
    products.value = result.items;
  } catch (caught) {
    error.value = `API недоступен (${apiBase || 'same origin'}): ${(caught as Error).message}`;
  }
});
</script>

<template>
  <div class="store-bg">
    <div class="storefront">
      <SiteHeader v-model="search" />

      <main class="store-main">
        <div v-if="notice" class="store-toast success">{{ notice }} <a href="/cart">Открыть корзину</a></div>
        <div v-if="error" class="store-toast error">{{ error }}</div>

        <section class="reference-hero" aria-label="Промо-баннер">
          <button class="hero-arrows" type="button" aria-label="Следующий баннер">← &nbsp;&nbsp; →</button>
          <div class="hero-dots"><i class="active"></i><i></i><i></i><i></i><i></i><i></i></div>
        </section>

        <section class="services-strip" aria-label="Популярные сервисы">
          <article v-for="service in services" :key="service.name" class="service-item">
            <div class="service-icon" :data-tone="service.tone"><Icon :icon="service.icon" aria-hidden="true" /></div>
            <strong>{{ service.name }}</strong>
          </article>
          <article class="service-item more-service"><div class="service-icon"><CircleEllipsis :size="22" aria-hidden="true" /></div><strong>ещё 841</strong></article>
        </section>

        <form v-if="quickProduct" class="quick-payment" @submit.prevent="addToCart(quickProduct)">
          <div class="quick-service-icon"><Icon :icon="steamIcon" aria-hidden="true" /></div>
          <div class="quick-title"><strong>Пополнение Steam <em>5%</em></strong><button type="button">Ввести промокод⌄</button></div>
          <label class="quick-field"><span>♟</span><input v-model="steamLogin" placeholder="Логин Steam"><i>i</i></label>
          <div class="quick-field amount-field"><span>●</span><label><small>Сумма</small><b>500₽</b></label><i>$</i><i>₽</i></div>
          <button class="quick-pay" type="submit" :disabled="Boolean(busySku)">{{ busySku ? 'Добавляем…' : 'В корзину за 500₽' }}</button>
        </form>

        <div class="category-row">
          <h2>Популярные товары</h2>
          <div class="category-pills">
            <button v-for="category in categoryFilters" :key="category.value" type="button" :class="{ active: activeType === category.value }" @click="activeType = category.value">{{ category.label }}</button>
          </div>
        </div>

        <section v-if="filteredProducts.length" class="product-section">
          <div class="ref-product-grid">
            <article v-for="product in sectionProducts(0)" :key="`popular-${product.sku}`" class="ref-product-card">
              <a :href="productHref(product)" class="product-link"><div class="cover reference-cover"><span v-if="product.available === 0">Нет в наличии</span></div><div class="card-body"><small>💥 {{ product.type.toUpperCase() }} • STEAM KEY 🔑</small><h3>{{ product.name }}</h3><div class="card-price"><b>{{ money(product.price) }}</b><del>{{ money(Math.round(product.price * 1.9)) }}</del></div></div></a>
              <button class="card-cart-button" :disabled="Boolean(busySku) || product.available === 0" @click="addToCart(product)">{{ busySku === product.sku ? 'Добавляем…' : 'В корзину' }}</button>
            </article>
          </div>
        </section>
        <div v-else class="empty-search">По этому запросу товаров не найдено.</div>

        <section v-if="filteredProducts.length" class="product-section">
          <div class="section-title"><h2>Рекомендованные товары</h2><button type="button">Показать все</button></div>
          <div class="ref-product-grid">
            <article v-for="product in sectionProducts(5)" :key="`recommended-${product.sku}`" class="ref-product-card">
              <a :href="productHref(product)" class="product-link"><div class="cover reference-cover"></div><div class="card-body"><small>💥 {{ product.type.toUpperCase() }} • STEAM KEY 🔑</small><h3>{{ product.name }}</h3><div class="card-price"><b>{{ money(product.price) }}</b><del>{{ money(Math.round(product.price * 1.9)) }}</del></div></div></a>
              <button class="card-cart-button" :disabled="Boolean(busySku) || product.available === 0" @click="addToCart(product)">{{ busySku === product.sku ? 'Добавляем…' : 'В корзину' }}</button>
            </article>
          </div>
        </section>

        <section v-if="filteredProducts.length" class="product-section other-products">
          <div class="section-title"><h2>Другие товары</h2><button type="button">Показать все</button></div>
          <div class="ref-product-grid">
            <article v-for="product in sectionProducts(10)" :key="`other-${product.sku}`" class="ref-product-card">
              <a :href="productHref(product)" class="product-link"><div class="cover reference-cover"></div><div class="card-body"><small>💥 {{ product.type.toUpperCase() }} • STEAM KEY 🔑</small><h3>{{ product.name }}</h3><div class="card-price"><b>{{ money(product.price) }}</b><del>{{ money(Math.round(product.price * 1.9)) }}</del></div></div></a>
              <button class="card-cart-button" :disabled="Boolean(busySku) || product.available === 0" @click="addToCart(product)">{{ busySku === product.sku ? 'Добавляем…' : 'В корзину' }}</button>
            </article>
          </div>
        </section>

        <section class="reviews-section">
          <div class="section-title"><div><h2>Последние отзывы</h2><p>Все отзывы взяты с независимой площадки</p></div><button type="button">Показать все</button></div>
          <div class="reviews-grid">
            <article v-for="index in 3" :key="index" class="review-card">
              <header><div class="avatar">B</div><div><b>Bizidin</b><span>★★★★★ &nbsp; 5.0</span></div><time>Сегодня в 11:48</time></header>
              <p>Отзывчивый и приятный продавец, помог не только с товаром, но и с другим вопросом. Рекомендую!</p>
              <footer><div class="review-thumb reference-cover"></div><strong>FunTime | Полностью готовый сервер под ключ 🔑</strong><b>139₽</b></footer>
            </article>
          </div>
        </section>

        <footer class="store-footer">
          <nav><a href="#">Стать продавцом</a><a href="#">Бонусы</a><a href="#">Поддержка</a><a href="#">Гарантии</a><a href="#">Отзывы</a></nav>
          <div class="footer-middle"><div class="socials"><span>VK</span><span>➤</span><span>♪</span><span>▶</span></div><div class="payments"><b>VISA</b><b>МИР</b><b>●●</b></div></div>
          <nav class="legal"><a href="#">Политика конфиденциальности</a><a href="#">Соглашение</a><a href="#">Договор-оферта</a><span>В наличии: {{ availableTotal }} ключей</span></nav>
        </footer>
      </main>
    </div>
  </div>
</template>
