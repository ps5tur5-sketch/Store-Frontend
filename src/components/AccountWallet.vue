<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Wallet, ArrowDownLeft, ArrowUpRight } from '@lucide/vue';
import { authApi, api } from '../api';
import { accountUser, refreshAccount } from '../auth';
import { money, date, paymentStatusLabels } from '../format';
import type { PaymentIntent, PaymentMethod } from '../types';
import WithdrawalPanel from './WithdrawalPanel.vue';
import PaymentPanel from './PaymentPanel.vue';
const amount = ref(1000);
const method = ref<'sbp' | 'crypto'>('sbp');
const methods = ref<PaymentMethod[]>([]);
const busy = ref(false);
const error = ref('');
const selected = ref('');
const payments = ref<PaymentIntent[]>([]);
const transactions = ref<
  { id: string; kind: string; amount: number; balance_after: number; created_at: string }[]
>([]);
const labels: Record<string, string> = {
  registration_bonus: 'Приветственный бонус',
  wallet_topup: 'Пополнение баланса',
  cart_purchase: 'Оплата покупки',
  order_refund: 'Возврат за покупку',
  withdrawal_hold: 'Резервирование вывода',
  withdrawal_release: 'Возврат резерва вывода',
};
let pendingTopup: { payment_id: string; amount: number; method: 'sbp' | 'crypto' } | undefined;
async function load() {
  const [history, account] = await Promise.all([
    authApi<{ payments: PaymentIntent[] }>('/api/account/payments'),
    authApi<{ point_transactions: typeof transactions.value }>('/api/account'),
  ]);
  payments.value = history.payments;
  transactions.value = account.point_transactions;
  await refreshAccount();
}
async function topup() {
  busy.value = true;
  error.value = '';
  pendingTopup ??= { payment_id: `topup_${crypto.randomUUID()}`, amount: amount.value, method: method.value };
  try {
    const p = await authApi<PaymentIntent>('/api/account/topups', {
      method: 'POST',
      body: JSON.stringify(pendingTopup),
    });
    selected.value = p.id;
    pendingTopup = undefined;
    await load();
  } catch {
    error.value = 'Не удалось создать пополнение. Повторите попытку.';
  } finally {
    busy.value = false;
  }
}
async function changed(p: PaymentIntent) {
  selected.value = p.id;
  try {
    await load();
  } catch {
    error.value = 'Не удалось обновить историю баланса.';
  }
}
onMounted(async () => {
  try {
    methods.value = (await api<{ methods: PaymentMethod[] }>('/api/payment-methods')).methods.filter(
      (m) => m.external,
    );
    await load();
  } catch {
    error.value = 'Не удалось загрузить баланс и способы оплаты.';
  }
});
</script>
<template>
  <section class="wallet-section" aria-label="Баланс и платежи">
    <div class="wallet-overview">
      <div>
        <span class="section-kicker">ЛИЧНЫЙ БАЛАНС</span>
        <h2><Wallet :size="23" />{{ money(accountUser?.points_balance ?? 0) }}</h2>
        <p>Пополняй и оплачивай покупки в один шаг.</p>
      </div>
      <span class="demo-pill">Тестовые средства</span>
    </div>
    <div v-if="error" class="inline-error" role="alert">{{ error }}</div>
    <form class="wallet-topup" @submit.prevent="topup">
      <label
        >Сумма пополнения<input
          v-model.number="amount"
          :disabled="busy || !!pendingTopup"
          type="number"
          min="1"
          max="1000000"
          step="1"
          required /></label
      ><label
        >Способ оплаты<select v-model="method" :disabled="busy || !!pendingTopup">
          <option v-for="m in methods" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select></label
      ><button class="checkout-button" :disabled="busy || !methods.length">
        {{ busy ? 'Создаём платёж…' : 'Пополнить баланс' }}
      </button>
    </form>
    <WithdrawalPanel @changed="load" />
    <PaymentPanel v-if="selected" :payment-id="selected" @changed="changed" />
    <details class="wallet-history">
      <summary>История баланса · {{ transactions.length }}</summary>
      <div v-for="t in transactions" :key="t.id" class="wallet-transaction">
        <ArrowDownLeft v-if="t.amount > 0" :size="18" /><ArrowUpRight v-else :size="18" />
        <div>
          <b>{{ labels[t.kind] || t.kind }}</b
          ><small>{{ date(t.created_at) }} · Баланс после: {{ money(t.balance_after) }}</small>
        </div>
        <strong :class="{ 'credit-amount': t.amount > 0 }"
          >{{ t.amount > 0 ? '+' : '' }}{{ money(t.amount) }}</strong
        >
      </div>
    </details>
    <details class="wallet-history">
      <summary>СБП и криптоплатежи · {{ payments.length }}</summary>
      <p v-if="!payments.length">Здесь появятся платежи за заказы и пополнения.</p>
      <button v-for="p in payments" :key="p.id" class="wallet-payment-row" @click="selected = p.id">
        <div>
          <b
            >{{ p.method === 'sbp' ? 'СБП' : 'USDT' }} ·
            {{ p.purpose === 'wallet_topup' ? 'Пополнение' : 'Заказ' }}</b
          ><small>{{ date(p.created_at) }}</small>
        </div>
        <span>{{ paymentStatusLabels[p.status] }}</span
        ><strong
          >{{ money(p.amount)
          }}<small v-if="p.refunded_amount">На баланс: +{{ money(p.refunded_amount) }}</small></strong
        >
      </button>
    </details>
  </section>
</template>
