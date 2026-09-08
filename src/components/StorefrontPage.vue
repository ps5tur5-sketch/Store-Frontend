<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import steam from '@iconify-icons/logos/steam';
import discord from '@iconify-icons/logos/discord-icon';
import spotify from '@iconify-icons/logos/spotify-icon';
import youtube from '@iconify-icons/logos/youtube-icon';
import playstation from '@iconify-icons/arcticons/playstation-family';
import xbox from '@iconify-icons/arcticons/xbox';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Gamepad2,
  Gift,
  KeyRound,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from '@lucide/vue';
import { accountUser, refreshCartCount } from '../auth';
import { api, authApi } from '../api';
import type { Cart, Product } from '../types';
import SiteHeader from './SiteHeader.vue';
import ProductCard from './ProductCard.vue';
const services = [
  { name: 'Steam', icon: steam, q: 'Steam' },
  { name: 'PlayStation', icon: playstation, q: 'PlayStation' },
  { name: 'Xbox', icon: xbox, q: 'Xbox' },
  { name: 'Discord', icon: discord, q: 'Discord' },
  { name: 'Spotify', icon: spotify, q: 'Spotify' },
  { name: 'YouTube', icon: youtube, q: 'YouTube' },
];
const categories = [
  { value: '', label: 'Все товары' },
  { value: 'key', label: 'Ключи игр' },
  { value: 'topup', label: 'Пополнения' },
  { value: 'subscription', label: 'Подписки' },
  { value: 'giftcard', label: 'Подарочные карты' },
];
const products = ref<Product[]>([]);
const search = ref(new URLSearchParams(window.location.search).get('q') ?? '');
const activeType = ref('');
const sort = ref('default');
const busySku = ref('');
const notice = ref('');
const error = ref('');
const loading = ref(true);
let timer: number | undefined;
let noticeTimer: number | undefined;
let version = 0;
const featured = computed(() => products.value.find((p) => p.sku === 'STEAM-TOPUP-500'));
async function loadCatalog() {
  const current = ++version;
  loading.value = true;
  error.value = '';
  try {
    const query = new URLSearchParams({
      limit: '100',
      type: activeType.value,
      search: search.value,
      sort: sort.value,
    });
    const result = await api<{ items: Product[] }>(`/api/catalog?${query}`);
    if (current === version) products.value = result.items;
  } catch {
    if (current === version) error.value = 'Не удалось загрузить товары. Попробуйте ещё раз.';
  } finally {
    if (current === version) loading.value = false;
  }
}
async function addToCart(product: Product) {
  if (!accountUser.value) {
    window.location.href = `/account?next=${encodeURIComponent(`/product/${product.sku}`)}`;
    return;
  }
  busySku.value = product.sku;
  error.value = '';
  try {
    await authApi<Cart>('/api/cart/items', {
      method: 'POST',
      body: JSON.stringify({ sku: product.sku, quantity: 1 }),
    });
    await refreshCartCount();
    notice.value = `${product.name} — в корзине`;
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => (notice.value = ''), 4500);
  } catch {
    error.value = 'Не удалось добавить товар. Проверьте количество в корзине и попробуйте снова.';
  } finally {
    busySku.value = '';
  }
}
function selectService(q: string) {
  activeType.value = '';
  search.value = q;
  document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
}
watch([search, activeType, sort], () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(loadCatalog, 220);
});
onMounted(() => {
  document.title = 'Game Goods — твой следующий уровень игры';
  void loadCatalog();
});
onBeforeUnmount(() => {
  version++;
  window.clearTimeout(timer);
  window.clearTimeout(noticeTimer);
});
</script>
<template>
  <div class="store-bg">
    <div class="storefront">
      <SiteHeader v-model="search" />
      <main class="store-main">
        <div v-if="notice" role="status" class="store-toast success">
          <Check :size="18" />{{ notice }}<a href="/cart">Открыть <ArrowUpRight :size="14" /></a>
        </div>
        <div class="store-eyebrow">
          <span><span class="live-dot"></span> МАЛЕНЬКАЯ ПОКУПКА. БОЛЬШОЕ ПРИКЛЮЧЕНИЕ.</span
          ><span>Игры / Подписки / Пополнения</span>
        </div>
        <section class="hero-layout">
          <div class="main-hero">
            <div class="hero-copy">
              <span class="hero-kicker"><Sparkles :size="14" /> ТВОЙ МИР БЕЗ ОГРАНИЧЕНИЙ</span>
              <h1>Твой следующий<br /><em>уровень игры.</em></h1>
              <p>
                Ключи к новым мирам, любимые подписки<br class="desktop-break" />
                и пополнения — всё в одном месте.
              </p>
              <a href="#catalog" class="primary-link">Найти своё <ArrowUpRight :size="20" /></a>
              <div class="hero-benefits">
                <span><Zap :size="14" />Автоматическая выдача</span
                ><span><ShieldCheck :size="14" />Проверенные коды</span>
              </div>
            </div>
            <div class="hero-art" aria-hidden="true">
              <div class="orbit orbit-one"></div>
              <div class="orbit orbit-two"></div>
              <div class="art-spark spark-one">+</div>
              <div class="art-spark spark-two">+</div>
              <div class="floating-card back-card">
                <Gamepad2 :size="65" /><span>PLAY WITHOUT LIMITS</span>
              </div>
              <div class="floating-card front-card">
                <span class="card-topline">DIGITAL GIFT CARD <ArrowUpRight :size="15" /></span
                ><Icon :icon="steam" class="hero-steam" /><strong>STEAM</strong>
                <div class="card-bottomline"><span>WALLET CODE</span><b>500 ₽</b></div>
              </div>
              <div class="verified-float">
                <span><Check :size="16" /></span>
                <div>Можно играть<small>Ключ проверен</small></div>
              </div>
            </div>
          </div>
          <aside class="bonus-card">
            <span class="bonus-icon"><Gift :size="25" /></span
            ><span class="bonus-kicker">ХОРОШЕЕ НАЧАЛО</span>
            <h2>5 000<span>приветственных баллов</span></h2>
            <p>Создай аккаунт и попробуй<br />свою первую покупку.</p>
            <a href="/account"
              >{{ accountUser ? 'Мой аккаунт' : 'Забрать бонус' }}<ArrowUpRight :size="18" /></a
            ><small>Начисляются при регистрации</small>
          </aside>
        </section>
        <section class="platforms" aria-label="Популярные платформы">
          <button v-for="service in services" :key="service.name" @click="selectService(service.q)">
            <Icon :icon="service.icon" /><span>{{ service.name }}</span
            ><ArrowUpRight :size="14" />
          </button>
        </section>
        <section id="catalog" class="catalog-section">
          <header class="catalog-heading">
            <div>
              <span class="section-kicker">ВЫБИРАЙ СВОЁ</span>
              <h2>Всё для твоего digital-мира<span class="accent-dot">.</span></h2>
            </div>
            <span class="catalog-quantity">{{ products.length }} товаров</span>
          </header>
          <div class="catalog-toolbar">
            <div class="category-pills" aria-label="Категории">
              <button
                v-for="category in categories"
                :key="category.value"
                :class="{ active: activeType === category.value }"
                :aria-pressed="activeType === category.value"
                @click="activeType = category.value"
              >
                {{ category.label }}
              </button>
            </div>
            <select v-model="sort" aria-label="Сортировка товаров">
              <option value="default">По умолчанию</option>
              <option value="price_asc">Сначала дешевле</option>
              <option value="price_desc">Сначала дороже</option>
            </select>
          </div>
          <div v-if="error" class="catalog-empty" role="alert">
            <ShieldCheck :size="32" />
            <h3>Небольшая пауза</h3>
            <p>{{ error }}</p>
            <button @click="loadCatalog">Попробовать снова</button>
          </div>
          <div v-else-if="loading" class="product-grid" aria-label="Загрузка товаров">
            <div v-for="n in 8" :key="n" class="product-skeleton"></div>
          </div>
          <div v-else-if="products.length" class="product-grid">
            <ProductCard
              v-for="product in products"
              :key="product.sku"
              :product="product"
              :busy="busySku === product.sku"
              @add="addToCart"
            />
          </div>
          <div v-else class="catalog-empty">
            <Search :size="34" />
            <h3>Пока ничего не нашли</h3>
            <p>Попробуй другой запрос или открой все категории.</p>
            <button
              @click="
                search = '';
                activeType = '';
              "
            >
              Сбросить фильтры
            </button>
          </div>
        </section>
        <section v-if="featured" class="steam-banner">
          <div class="steam-banner-icon"><Icon :icon="steam" /></div>
          <div>
            <span class="section-kicker">ЕЩЁ БОЛЬШЕ ВОЗМОЖНОСТЕЙ</span>
            <h2>В списке желаемого что-то осталось?</h2>
            <p>Пополни Steam и забери игру, которую давно хотел.</p>
          </div>
          <a :href="`/product/${featured.sku}`">Пополнить Steam<ArrowRight :size="18" /></a>
        </section>
        <section id="how-it-works" class="how-section">
          <header class="catalog-heading">
            <div>
              <span class="section-kicker">ПРОСТО. ПОНЯТНО. ТВОЁ.</span>
              <h2>От выбора до игры — три шага</h2>
            </div>
          </header>
          <div class="how-grid">
            <article>
              <span class="step-number">01</span><Gamepad2 :size="23" />
              <h3>Найди своё</h3>
              <p>Выбери игры и сервисы. Добавь всё нужное в одну корзину.</p>
            </article>
            <article>
              <span class="step-number">02</span><ShieldCheck :size="23" />
              <h3>Оплати баллами</h3>
              <p>Используй баланс или платёжный код. Сумму увидишь до покупки.</p>
            </article>
            <article>
              <span class="step-number">03</span><KeyRound :size="23" />
              <h3>Забери свои ключи</h3>
              <p>Коды сохранятся в кабинете. За невыданный товар вернём баллы.</p>
            </article>
          </div>
        </section>
        <footer class="store-footer">
          <div>
            <a href="/" class="footer-brand">game<span>goods</span></a>
            <p>Больше игры. Больше впечатлений.</p>
          </div>
          <nav>
            <a href="/#catalog">Каталог</a><a href="/account">Мои покупки</a><a href="/cart">Корзина</a
            ><a href="#how-it-works">Как это работает</a>
          </nav>
          <div class="footer-bottom">
            <span>© 2026 Game Goods</span><span>Учебный магазин · Все платежи и коды эмулируются</span
            ><span>Сделано для тех, кто играет <Gamepad2 :size="14" /></span>
          </div>
        </footer>
      </main>
    </div>
  </div>
</template>
