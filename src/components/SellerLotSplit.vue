<script setup lang="ts">
import { computed, ref } from 'vue';
import { authApi, ApiError } from '../api';
import { money } from '../format';
const props = defineProps<{
  source: { offer_id: string; name: string; offer_name: string; available: number; price: number };
}>();
const emit = defineEmits<{ close: []; saved: [] }>();
const parts = ref(
  [1, 2, 3].map((n) => ({ name: `Партия ${n}`, quantity: 0, price: props.source.price, active: true })),
);
const quantity = computed(() => parts.value.reduce((n, p) => n + (Number(p.quantity) || 0), 0));
const busy = ref(false);
const error = ref('');
const pending = ref('');
const errors: Record<string, string> = {
  lot_insufficient_free_keys:
    'Свободных ключей недостаточно. Часть могла попасть в заказ. Обновите остаток и уменьшите количество.',
  lot_request_conflict:
    'Этот запрос уже выполнен с другими параметрами. Закройте форму и проверьте созданные партии.',
  seller_offer_not_found: 'Исходная партия не найдена в вашем магазине.',
};
async function submit() {
  busy.value = true;
  error.value = '';
  pending.value ||= JSON.stringify({
    request_id: `split_${crypto.randomUUID()}`,
    source_offer_id: props.source.offer_id,
    parts: parts.value,
  });
  try {
    await authApi('/api/seller/lots/split', { method: 'POST', body: pending.value });
    pending.value = '';
    emit('saved');
  } catch (caught) {
    error.value =
      errors[(caught as Error).message] ??
      'Ответ не получен. Повторите запрос: те же ключи не распределятся дважды.';
    if (caught instanceof ApiError && caught.status < 500) pending.value = '';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="admin-panel lot-split-panel">
    <div class="panel-heading">
      <div>
        <span class="eyebrow">РАСПРЕДЕЛЕНИЕ СКЛАДА</span>
        <h2>Разделить на партии</h2>
      </div>
      <button type="button" :disabled="busy" @click="emit('close')">Закрыть</button>
    </div>
    <p>
      <b>{{ source.name }}</b> · {{ source.offer_name }}. Свободно: <b>{{ source.available }} ключей</b>.
    </p>
    <p>
      Задайте количество и цену для каждой партии. Например, из 1000 ключей: 200 по 100 ₽, 400 по 150 ₽ и 400
      по 200 ₽. Нераспределённые ключи останутся в исходной партии по её прежней цене
      {{ money(source.price) }}.
    </p>
    <form @submit.prevent="submit">
      <fieldset :disabled="busy || !!pending" class="lot-split-fields">
        <div v-for="(part, index) in parts" :key="index" class="lot-split-row">
          <label
            >Название партии<input
              v-model="part.name"
              required
              maxlength="80"
              :aria-label="`Название партии ${index + 1}`"
          /></label>
          <label
            >Ключей<input
              v-model.number="part.quantity"
              type="number"
              min="1"
              max="100000"
              required
              :aria-label="`Количество партии ${index + 1}`"
          /></label>
          <label
            >Цена одного ключа, ₽<input
              v-model.number="part.price"
              type="number"
              min="1"
              max="10000000"
              required
              :aria-label="`Цена партии ${index + 1}`"
          /></label>
          <label class="checkbox-label"><input v-model="part.active" type="checkbox" />В продаже</label>
          <button
            type="button"
            class="secondary-button"
            :disabled="parts.length === 1"
            :aria-label="`Убрать партию ${index + 1}`"
            @click="parts.splice(index, 1)"
          >
            Убрать
          </button>
        </div>
        <button
          type="button"
          class="secondary-button"
          :disabled="parts.length >= 20"
          @click="
            parts.push({ name: `Партия ${parts.length + 1}`, quantity: 0, price: source.price, active: true })
          "
        >
          Ещё партия
        </button>
      </fieldset>
      <p class="lot-split-total">
        Распределить: <b>{{ quantity }}</b> из {{ source.available }} свободных ключей.
      </p>
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <button
        class="primary-admin-button"
        :disabled="busy || (!pending && (!quantity || quantity > source.available))"
      >
        {{ busy ? 'Распределяем…' : pending ? 'Повторить запрос' : 'Создать партии' }}
      </button>
    </form>
  </section>
</template>
