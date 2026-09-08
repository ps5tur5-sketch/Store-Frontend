<script setup lang="ts">
import { refundDestination } from '../format';
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Check, Copy, RefreshCw, X } from '@lucide/vue';
import { statusLabels } from '../format';
import OrderChat from './OrderChat.vue';
import ReviewForm from './ReviewForm.vue';
import type { Purchase } from '../types';

const props = withDefaults(defineProps<{ purchase: Purchase; index?: number; total?: number }>(), {
  index: 0,
  total: 1,
});
const emit = defineEmits<{ close: []; previous: []; next: []; refresh: [] }>();
const copied = ref(false);
const copyError = ref('');
const dialog = ref<HTMLElement>();
let previousFocus: HTMLElement | null = null;
let refreshTimer: number | undefined;
const keydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close');
  if (event.key === 'Tab') {
    const nodes = dialog.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled)',
    );
    if (!nodes?.length) return;
    const first = nodes[0]!,
      last = nodes[nodes.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
};
onMounted(() => {
  previousFocus = document.activeElement as HTMLElement;
  dialog.value?.querySelector('button')?.focus();
  document.addEventListener('keydown', keydown);
  document.body.style.overflow = 'hidden';
  refreshTimer = window.setInterval(() => {
    if (props.purchase.status !== 'refunded') emit('refresh');
  }, 4000);
});
onBeforeUnmount(() => {
  window.clearInterval(refreshTimer);
  document.removeEventListener('keydown', keydown);
  document.body.style.overflow = '';
  previousFocus?.focus();
});
watch(
  () => props.purchase.id,
  () => {
    copied.value = false;
    copyError.value = '';
  },
);

const delivered = computed(() => props.purchase.status === 'delivered' && Boolean(props.purchase.code));

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function date(value?: string): string {
  return value
    ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
    : '—';
}

async function copyCode(): Promise<void> {
  if (!props.purchase.code) return;
  try {
    await navigator.clipboard.writeText(props.purchase.code);
    copied.value = true;
  } catch {
    copyError.value = 'Выделите код и скопируйте его вручную.';
  }
  window.setTimeout(() => {
    copied.value = false;
  }, 1600);
}
</script>

<template>
  <div class="purchase-modal-backdrop" role="presentation" @click.self="emit('close')">
    <article
      ref="dialog"
      class="purchase-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-modal-title"
    >
      <button class="purchase-modal-close" type="button" aria-label="Закрыть карточку" @click="emit('close')">
        <X :size="20" aria-hidden="true" />
      </button>
      <div class="purchase-modal-cover">
        <img :src="purchase.image" :alt="purchase.name" /><span>{{ statusLabels[purchase.status] }}</span>
      </div>
      <div class="purchase-modal-content">
        <span class="success-kicker">ТВОЯ ПОКУПКА</span>
        <h1 id="purchase-modal-title">{{ statusLabels[purchase.status] }}</h1>
        <h2>{{ purchase.name }}</h2>
        <p v-if="purchase.offer_name" class="order-seller">{{ purchase.offer_name }}</p>
        <p>{{ purchase.description }}</p>
        <ul>
          <li v-for="feature in purchase.features" :key="feature">{{ feature }}</li>
        </ul>
        <div class="purchase-modal-meta">
          <span><small>Дата</small>{{ date(purchase.created_at) }}</span
          ><span><small>Стоимость</small>{{ money(purchase.amount) }}</span
          ><span><small>Поставщик</small>{{ purchase.provider || 'ожидается' }}</span>
        </div>
        <div class="popup-issued-key" :class="{ pending: !delivered }">
          <span>{{
            delivered
              ? 'Ваш цифровой код'
              : purchase.status === 'refunded'
                ? 'Возврат завершён'
                : 'Готовим ваш код'
          }}</span>
          <strong>{{
            purchase.code ||
            (purchase.status === 'refunded'
              ? `Средства возвращены ${refundDestination(purchase.refund_destination)}`
              : 'Выдача выполняется автоматически')
          }}</strong>
          <button v-if="delivered" type="button" @click="copyCode">
            <Copy :size="16" aria-hidden="true" />{{ copied ? 'Скопировано' : 'Скопировать код' }}
          </button>
          <button v-else-if="purchase.status !== 'refunded'" type="button" @click="emit('refresh')">
            <RefreshCw :size="16" aria-hidden="true" />Обновить статус
          </button>
        </div>
        <p v-if="copyError" role="alert">{{ copyError }}</p>
        <OrderChat :order-id="purchase.id" /><ReviewForm :purchase="purchase" @submitted="emit('refresh')" />
        <div v-if="total > 1" class="popup-pagination">
          <button type="button" :disabled="index === 0" @click="emit('previous')">← Предыдущая</button
          ><span>{{ index + 1 }} / {{ total }}</span
          ><button type="button" :disabled="index + 1 >= total" @click="emit('next')">Следующая →</button>
        </div>
      </div>
    </article>
  </div>
</template>
