<script setup lang="ts">
import { computed } from 'vue';
import { Gamepad2, LayoutGrid, Search, ShoppingBag, UserRound, Wallet } from '@lucide/vue';
import { accountUser, cartCount } from '../auth';
const location = window.location;
const props = withDefaults(defineProps<{ modelValue?: string }>(), { modelValue: '' });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const searchValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
});
function submitSearch() {
  if (window.location.pathname !== '/')
    window.location.href = `/?q=${encodeURIComponent(searchValue.value.trim())}`;
}
</script>
<template>
  <div class="top-bar">
    <span>Цифровые товары. Настоящие впечатления.</span
    ><span class="demo-label">Демо-магазин <i></i> Баланс · СБП · Крипта</span>
  </div>
  <header class="store-header">
    <a href="/" class="site-brand" aria-label="Game Goods — главная"
      ><span><Gamepad2 :size="25" /></span><b>game<span>goods</span><small>LEVEL UP YOUR GAME</small></b></a
    >
    <a href="/#catalog" class="catalog-button"><LayoutGrid :size="17" />Каталог</a>
    <form class="search-box" @submit.prevent="submitSearch">
      <Search :size="18" /><input
        v-model="searchValue"
        type="search"
        aria-label="Поиск товаров"
        placeholder="Найти игру, подписку или сервис"
      /><button type="submit" aria-label="Найти"><span>↵</span></button>
    </form>
    <a v-if="accountUser?.can_buy" href="/account" class="header-wallet"
      ><Wallet :size="17" /><span
        >{{ new Intl.NumberFormat('ru-RU').format(accountUser.points_balance) }} <small>₽</small></span
      ></a
    >
    <a v-if="accountUser?.role === 'admin'" href="/admin" class="header-wallet">Управление</a
    ><a v-if="accountUser?.can_sell" href="/seller/account" class="header-wallet">Продажи</a
    ><a href="/account" class="header-account"
      ><UserRound :size="20" /><span>{{ accountUser?.username || 'Войти' }}</span></a
    >
    <a v-if="!accountUser || accountUser.can_buy" class="cart-button" href="/cart" aria-label="Корзина"
      ><ShoppingBag :size="20" /><b v-if="cartCount">{{ cartCount }}</b></a
    >
  </header>
  <nav v-if="accountUser?.role !== 'admin'" class="market-mode-switch" aria-label="Купить или продать">
    <a href="/account" :class="{ active: !location.pathname.startsWith('/seller/account') }">Купить</a>
    <a
      :href="accountUser ? '/seller/account' : '/account?role=seller'"
      :class="{ active: location.pathname.startsWith('/seller/account') }"
      >Продать</a
    >
  </nav>
</template>
