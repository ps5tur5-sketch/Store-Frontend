<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { Wallet, Landmark, Bitcoin, CheckCircle2, Clock3, RefreshCw } from '@lucide/vue';
import { authApi } from '../api';
import { refreshAccount } from '../auth';
import type { PaymentIntent } from '../types';
import { money, date, paymentStatusLabels } from '../format';
const props = defineProps<{ paymentId: string }>();
const emit = defineEmits<{ changed: [payment: PaymentIntent] }>();
const payment = ref<PaymentIntent>();
const busy = ref(false);
const error = ref('');
let currentId = '';
let timer: number | undefined;
let disposed = false;
let revision = 0;
function accept(p: PaymentIntent) {
  payment.value = p;
  currentId = p.id;
  emit('changed', p);
}
async function load() {
  const id = currentId;
  const version = revision;
  try {
    const result = await authApi<PaymentIntent>(`/api/payments/${encodeURIComponent(id)}`);
    if (!disposed && version === revision) payment.value = result;
  } catch {
    if (!disposed) error.value = 'Не удалось обновить платёж. Он сохранён в личном кабинете.';
  }
  if (!disposed && version === revision && payment.value?.status === 'pending')
    timer = window.setTimeout(load, 3000);
}
async function simulate(outcome: 'paid' | 'failed' | 'cancelled') {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  window.clearTimeout(timer);
  try {
    accept(
      await authApi<PaymentIntent>(`/api/payments/${currentId}/simulate`, {
        method: 'POST',
        body: JSON.stringify({ outcome, event_id: `sim_${crypto.randomUUID()}` }),
      }),
    );
    await refreshAccount();
  } catch {
    error.value = 'Не удалось подтвердить результат. Обновите статус: повтор не спишет деньги дважды.';
    await load();
  } finally {
    busy.value = false;
  }
}
async function retry() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    accept(
      await authApi<PaymentIntent>(`/api/payments/${currentId}/retry`, {
        method: 'POST',
        body: JSON.stringify({ retry_id: `pay_${crypto.randomUUID()}` }),
      }),
    );
    await load();
  } catch (caught) {
    error.value = ['lot_insufficient_stock', 'cart_offer_unavailable'].includes((caught as Error).message)
      ? 'Ключи этой партии закончились или предложение отключено. Выберите доступную партию в каталоге; деньги не списаны.'
      : 'Не удалось создать повторный платёж. Обновите статус и попробуйте снова.';
  } finally {
    busy.value = false;
  }
}
watch(
  () => props.paymentId,
  (id) => {
    revision++;
    currentId = id;
    payment.value = undefined;
    window.clearTimeout(timer);
    void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  disposed = true;
  window.clearTimeout(timer);
});
</script>
<template>
  <section class="payment-panel" aria-label="Тестовая оплата">
    <header>
      <div class="payment-symbol">
        <Landmark v-if="payment?.method === 'sbp'" :size="24" /><Bitcoin
          v-else-if="payment?.method === 'crypto'"
          :size="24"
        /><Wallet v-else :size="24" />
      </div>
      <div>
        <span class="section-kicker">БЕЗ НАСТОЯЩЕГО ПЕРЕВОДА</span>
        <h3>{{ payment?.details.title || 'Загружаем платёж…' }}</h3>
      </div>
      <span class="demo-pill">Демо</span>
    </header>
    <div v-if="error" class="inline-error" role="alert">{{ error }}</div>
    <template v-if="payment">
      <div class="payment-amount">
        <strong>{{ money(payment.amount) }}</strong
        ><span :data-status="payment.status"
          ><CheckCircle2 v-if="payment.status === 'paid'" :size="17" /><Clock3 v-else :size="17" />{{
            paymentStatusLabels[payment.status]
          }}</span
        >
      </div>
      <p>
        {{ payment.purpose === 'wallet_topup' ? 'Пополнение баланса личного кабинета' : 'Оплата заказа' }} ·
        {{ payment.method === 'crypto' ? 'USDT' : 'СБП' }}
      </p>
      <dl v-if="payment.status === 'pending'" class="payment-details">
        <div v-if="payment.details.crypto_amount">
          <dt>Сумма в USDT</dt>
          <dd>{{ payment.details.crypto_amount }} USDT</dd>
        </div>
        <div v-if="payment.details.network">
          <dt>Сеть</dt>
          <dd>{{ payment.details.network }}</dd>
        </div>
        <div>
          <dt>{{ payment.details.address ? 'Тестовый адрес' : 'Номер платежа' }}</dt>
          <dd>
            <code>{{ payment.details.address || payment.details.reference }}</code>
          </dd>
        </div>
        <div>
          <dt>Действует до</dt>
          <dd>{{ date(payment.expires_at) }}</dd>
        </div>
      </dl>
      <p v-if="payment.refunded_amount" class="refund-explanation">
        Зачислено на баланс личного кабинета: {{ money(payment.refunded_amount) }}.
      </p>
      <p v-if="payment.status === 'pending'" class="payment-instructions">
        {{ payment.details.instructions }}
      </p>
      <div v-if="payment.can_confirm" class="payment-actions">
        <button class="checkout-button" :disabled="busy" @click="simulate('paid')">
          <CheckCircle2 :size="18" />{{ busy ? 'Обрабатываем…' : 'Имитировать успешную оплату' }}
        </button>
        <div>
          <button :disabled="busy" @click="simulate('failed')">Проверить ошибку оплаты</button
          ><button :disabled="busy" @click="simulate('cancelled')">Отменить платёж</button>
        </div>
      </div>
      <button v-if="payment.can_retry" class="checkout-button" :disabled="busy" @click="retry">
        <RefreshCw :size="17" />Повторить оплату
      </button>
      <p v-if="payment.status === 'paid'" class="payment-success" role="status">
        {{
          payment.purpose === 'wallet_topup'
            ? 'Средства зачислены на баланс.'
            : 'Оплата подтверждена. Статус выдачи обновляется автоматически.'
        }}
      </p>
      <button class="payment-refresh" :disabled="busy" @click="load">Обновить статус</button>
    </template>
  </section>
</template>
