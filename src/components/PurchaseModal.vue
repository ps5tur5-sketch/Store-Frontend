<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, Copy, RefreshCw, X } from '@lucide/vue';
import type { Purchase } from '../types';

const props = withDefaults(defineProps<{ purchase: Purchase; index?: number; total?: number }>(), {
  index: 0,
  total: 1,
});
const emit = defineEmits<{ close: []; previous: []; next: []; refresh: [] }>();
const copied = ref(false);

const delivered = computed(() => props.purchase.status === 'delivered' && Boolean(props.purchase.code));

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' баллов';
}

function date(value?: string): string {
  return value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function copyCode(): Promise<void> {
  if (!props.purchase.code) return;
  await navigator.clipboard.writeText(props.purchase.code);
  copied.value = true;
  window.setTimeout(() => { copied.value = false; }, 1600);
}
</script>

<template>
  <div class="purchase-modal-backdrop" role="presentation" @click.self="emit('close')">
    <article class="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-modal-title">
      <button class="purchase-modal-close" type="button" aria-label="Закрыть карточку" @click="emit('close')">
        <X :size="20" aria-hidden="true" />
      </button>
      <div class="purchase-modal-cover reference-cover"><span><Check :size="18" aria-hidden="true" /> Куплено</span></div>
      <div class="purchase-modal-content">
        <span class="success-kicker">ПОКУПКА ПОДТВЕРЖДЕНА</span>
        <h1 id="purchase-modal-title">Вы купили этот товар</h1>
        <h2>{{ purchase.name }}</h2>
        <p>{{ purchase.description }}</p>
        <ul><li v-for="feature in purchase.features" :key="feature">{{ feature }}</li></ul>
        <div class="purchase-modal-meta"><span><small>Дата</small>{{ date(purchase.created_at) }}</span><span><small>Стоимость</small>{{ money(purchase.amount) }}</span><span><small>Поставщик</small>{{ purchase.provider || 'ожидается' }}</span></div>
        <div class="popup-issued-key" :class="{ pending: !delivered }">
          <span>{{ delivered ? 'Ваш случайный цифровой код из пула ТЗ' : 'Код выдаётся' }}</span>
          <strong>{{ purchase.code || 'Подождите несколько секунд…' }}</strong>
          <button v-if="delivered" type="button" @click="copyCode">
            <Copy :size="16" aria-hidden="true" />{{ copied ? 'Скопировано' : 'Скопировать код' }}
          </button>
          <button v-else type="button" @click="emit('refresh')"><RefreshCw :size="16" aria-hidden="true" />Обновить статус</button>
        </div>
        <div v-if="total > 1" class="popup-pagination">
          <button type="button" :disabled="index === 0" @click="emit('previous')">← Предыдущая</button><span>{{ index + 1 }} / {{ total }}</span><button type="button" :disabled="index + 1 >= total" @click="emit('next')">Следующая →</button>
        </div>
      </div>
    </article>
  </div>
</template>
