<script setup lang="ts">
import { computed } from 'vue';
import { Heart, LayoutGrid, Search, ShoppingCart, UserRound } from '@lucide/vue';
import { accountUser, cartCount } from '../auth';

const props = withDefaults(defineProps<{ modelValue?: string }>(), { modelValue: '' });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const searchValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
});

function submitSearch(): void {
  const query = searchValue.value.trim();
  if (window.location.pathname !== '/') window.location.href = query ? `/?q=${encodeURIComponent(query)}` : '/';
}
</script>

<template>
  <header class="store-header">
    <a class="catalog-button" href="/">
      <LayoutGrid :size="16" aria-hidden="true" />
      Каталог
    </a>
    <form class="search-box" @submit.prevent="submitSearch">
      <input v-model="searchValue" type="search" placeholder="Игра, приложение или услуга...">
      <span class="search-heart"><Heart :size="15" aria-hidden="true" /></span>
      <button class="search-submit" type="submit" aria-label="Найти"><Search :size="17" aria-hidden="true" /></button>
    </form>
    <a class="cart-button" href="/cart" aria-label="Корзина">
      <ShoppingCart :size="18" aria-hidden="true" />
      <b v-if="cartCount">{{ cartCount }}</b>
    </a>
    <a class="profile-button" href="/account" :aria-label="accountUser ? `Профиль ${accountUser.username}` : 'Войти'">
      <UserRound :size="18" aria-hidden="true" />
    </a>
  </header>
</template>
