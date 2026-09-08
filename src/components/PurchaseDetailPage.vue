<script setup lang="ts">
import { refundDestination } from '../format';
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { accountUser, authReady, refreshAccount } from '../auth';
import { authApi } from '../api';
import OrderChat from './OrderChat.vue';
import ReviewForm from './ReviewForm.vue';
import type { Purchase } from '../types';
import SiteHeader from './SiteHeader.vue';
import { statusLabels } from '../format';

const orderId = decodeURIComponent(window.location.pathname.replace(/^\/purchase\//, '').replace(/\/$/, ''));
const purchase = ref<Purchase>();
const error = ref('');
const search = ref('');
let timer: number | undefined;
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
  window.clearTimeout(timer);
});

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function date(value?: string): string {
  return value
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
    : '—';
}

async function loadPurchase(): Promise<void> {
  window.clearTimeout(timer);
  try {
    const previous = purchase.value?.status;
    purchase.value = await authApi<Purchase>(`/api/account/purchases/${encodeURIComponent(orderId)}`);
    document.title = `${purchase.value.name} — ваша покупка`;
    if (previous !== purchase.value.status) await refreshAccount();
    error.value = '';
  } catch {
    error.value = 'Не удалось обновить покупку. Повторяем запрос.';
  }
  if (!disposed && purchase.value?.status !== 'refunded')
    timer = window.setTimeout(loadPurchase, purchase.value?.status === 'delivered' ? 4000 : 1500);
}

onMounted(async () => {
  if (!authReady.value) await refreshAccount();
  if (!accountUser.value) {
    window.location.href = `/account?next=${encodeURIComponent(window.location.pathname)}`;
    return;
  }
  try {
    await loadPurchase();
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
          <a href="/">Каталог</a><span>›</span><a href="/account">Мои покупки</a><span>›</span
          ><span>{{ purchase?.name || orderId }}</span>
        </nav>
        <div v-if="error" class="page-message error">{{ error }}</div>
        <section v-if="purchase" class="purchased-card">
          <div class="purchased-cover">
            <img :src="purchase.image" :alt="purchase.name" /><span>{{ statusLabels[purchase.status] }}</span>
          </div>
          <div class="purchased-info">
            <span class="success-kicker">✓ ПОКУПКА ПОДТВЕРЖДЕНА</span>
            <h1>Вы купили этот товар</h1>
            <h2>{{ purchase.name }}</h2>
            <p v-if="purchase.offer_name" class="order-seller">{{ purchase.offer_name }}</p>
            <p>{{ purchase.description }}</p>
            <ul>
              <li v-for="feature in purchase.features" :key="feature">{{ feature }}</li>
            </ul>
            <dl>
              <div>
                <dt>Дата покупки</dt>
                <dd>{{ date(purchase.created_at) }}</dd>
              </div>
              <div>
                <dt>Стоимость</dt>
                <dd>{{ money(purchase.amount) }}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>{{ statusLabels[purchase.status] }}</dd>
              </div>
              <div>
                <dt>Поставщик</dt>
                <dd>{{ purchase.provider || 'ожидается' }}</dd>
              </div>
            </dl>
            <div class="issued-key">
              <span>Ваш цифровой код</span
              ><strong>{{
                purchase.code ||
                (purchase.status === 'refunded'
                  ? `Средства возвращены ${refundDestination(purchase.refund_destination)}`
                  : 'Код выдаётся автоматически')
              }}</strong
              ><small>Сохраните код. Он также останется в этой карточке покупки.</small>
            </div>
            <OrderChat :order-id="purchase.id" /><ReviewForm
              :purchase="purchase"
              @submitted="loadPurchase"
            /><a class="back-purchases" href="/account">← Вернуться ко всем покупкам</a>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
