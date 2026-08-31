<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { accountUser, authReady, refreshAccount } from '../auth';
import { authApi } from '../api';
import type { Purchase } from '../types';
import SiteHeader from './SiteHeader.vue';

const orderId = decodeURIComponent(window.location.pathname.replace(/^\/purchase\//, '').replace(/\/$/, ''));
const purchase = ref<Purchase>();
const error = ref('');
const search = ref('');

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' баллов';
}

function date(value?: string): string {
  return value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function loadPurchase(): Promise<void> {
  purchase.value = await authApi<Purchase>(`/api/account/purchases/${encodeURIComponent(orderId)}`);
  document.title = `${purchase.value.name} — ваша покупка`;
}

onMounted(async () => {
  if (!authReady.value) await refreshAccount();
  if (!accountUser.value) {
    window.location.href = `/account?next=${encodeURIComponent(window.location.pathname)}`;
    return;
  }
  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await loadPurchase();
      if (purchase.value?.status === 'delivered' || ['out_of_stock', 'delivery_failed'].includes(purchase.value?.status ?? '')) break;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  } catch (caught) {
    error.value = (caught as Error).message;
  }
});
</script>

<template>
  <div class="store-bg"><div class="storefront site-page">
    <SiteHeader v-model="search" />
    <main class="inner-page">
      <nav class="breadcrumbs"><a href="/">Каталог</a><span>›</span><a href="/account">Мои покупки</a><span>›</span><span>{{ purchase?.name || orderId }}</span></nav>
      <div v-if="error" class="page-message error">{{ error }}</div>
      <section v-if="purchase" class="purchased-card">
        <div class="purchased-cover reference-cover"><span>Куплено</span></div>
        <div class="purchased-info"><span class="success-kicker">✓ ПОКУПКА ПОДТВЕРЖДЕНА</span><h1>Вы купили этот товар</h1><h2>{{ purchase.name }}</h2><p>{{ purchase.description }}</p><ul><li v-for="feature in purchase.features" :key="feature">{{ feature }}</li></ul><dl><div><dt>Дата покупки</dt><dd>{{ date(purchase.created_at) }}</dd></div><div><dt>Стоимость</dt><dd>{{ money(purchase.amount) }}</dd></div><div><dt>Статус</dt><dd>{{ purchase.status }}</dd></div><div><dt>Поставщик</dt><dd>{{ purchase.provider || 'ожидается' }}</dd></div></dl><div class="issued-key"><span>Ваш цифровой код</span><strong>{{ purchase.code || 'Код ещё выдаётся автоматически' }}</strong><small>Сохраните код. Он также останется в этой карточке покупки.</small></div><a class="back-purchases" href="/account">← Вернуться ко всем покупкам</a></div>
      </section>
    </main>
  </div></div>
</template>
