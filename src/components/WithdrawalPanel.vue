<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { ArrowUpRight, Wallet, CheckCircle2 } from '@lucide/vue';
import { api, authApi } from '../api';
import { refreshAccount } from '../auth';
import { money, date } from '../format';
import type { Withdrawal } from '../types';
const emit = defineEmits<{ changed: [] }>();
const open = ref(false),
  busy = ref(false),
  error = ref('');
const amount = ref(1000),
  method = ref<'card' | 'crypto'>('card'),
  recipient = ref('0000 0000 0000 1234');
const methods = ref<{ id: string; name: string; description: string }[]>([]),
  withdrawals = ref<Withdrawal[]>([]),
  selected = ref<Withdrawal>();
const labels: Record<string, string> = {
  pending: 'Средства зарезервированы',
  paid: 'Тестовый перевод выполнен',
  failed: 'Отказ · деньги снова на балансе',
  cancelled: 'Отменён · деньги снова на балансе',
  expired: 'Истёк срок · деньги снова на балансе',
};
let requestBody:
  { withdrawal_id: string; method: 'card' | 'crypto'; amount: number; recipient: string } | undefined;
let timer: number | undefined;
let disposed = false;
watch(method, (value) => {
  recipient.value = value === 'card' ? '0000 0000 0000 1234' : 'DEMO-USDT-MY-WALLET';
});
async function load() {
  withdrawals.value = (await authApi<{ withdrawals: Withdrawal[] }>('/api/account/withdrawals')).withdrawals;
  if (selected.value)
    selected.value = withdrawals.value.find((w) => w.id === selected.value!.id) ?? selected.value;
  await refreshAccount();
  emit('changed');
}
async function create() {
  busy.value = true;
  error.value = '';
  requestBody ??= {
    withdrawal_id: `wd_${crypto.randomUUID()}`,
    method: method.value,
    amount: amount.value,
    recipient: recipient.value,
  };
  try {
    selected.value = await authApi<Withdrawal>('/api/account/withdrawals', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    requestBody = undefined;
    recipient.value = '';
    await load();
  } catch (caught) {
    const code = (caught as Error).message;
    error.value =
      code === 'insufficient_points'
        ? 'Недостаточно доступных средств.'
        : code === 'invalid_withdrawal_recipient'
          ? 'Проверьте реквизиты: карта — 16–19 цифр, криптокошелёк — от 10 символов.'
          : 'Не удалось создать вывод. Повтор не зарезервирует деньги дважды.';
    if (['insufficient_points', 'invalid_withdrawal_recipient'].includes(code)) requestBody = undefined;
  } finally {
    busy.value = false;
  }
}
async function simulate(outcome: 'paid' | 'failed' | 'cancelled') {
  if (!selected.value || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    selected.value = await authApi<Withdrawal>(`/api/account/withdrawals/${selected.value.id}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ event_id: `wd_event_${crypto.randomUUID()}`, outcome }),
    });
    await load();
  } catch {
    error.value = 'Не удалось подтвердить результат. Обновите историю; резерв сохранён в базе.';
  } finally {
    busy.value = false;
  }
}
onMounted(async () => {
  try {
    methods.value = (await api<{ methods: typeof methods.value }>('/api/withdrawal-methods')).methods;
    await load();
  } catch {
    error.value = 'Не удалось загрузить выводы.';
  }
  const poll = async () => {
    if (disposed) return;
    try {
      if (open.value) await load();
    } catch {}
    if (!disposed) timer = window.setTimeout(poll, 5000);
  };
  timer = window.setTimeout(poll, 5000);
});
onBeforeUnmount(() => {
  disposed = true;
  window.clearTimeout(timer);
});
</script>
<template>
  <section class="withdrawal-section">
    <button class="withdrawal-toggle" @click="open = !open">
      <ArrowUpRight :size="18" />Вывести средства <span>На карту или в криптовалюте</span>
    </button>
    <div v-if="open">
      <p class="withdrawal-note">
        Тестовый вывод без настоящего перевода. Сумма резервируется на балансе; при отказе, отмене или
        истечении срока резерв возвращается.
      </p>
      <div v-if="error" class="inline-error" role="alert">{{ error }}</div>
      <form class="withdrawal-form" @submit.prevent="create">
        <label
          >Сумма вывода, ₽<input
            v-model.number="amount"
            type="number"
            min="1"
            max="1000000"
            step="1"
            required
            :disabled="busy || !!requestBody" /></label
        ><label
          >Куда вывести<select v-model="method" :disabled="busy || !!requestBody">
            <option v-for="m in methods" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select></label
        ><label class="withdrawal-recipient"
          >{{ method === 'card' ? 'Номер тестовой карты' : 'Адрес тестового кошелька'
          }}<input
            v-model="recipient"
            minlength="10"
            maxlength="120"
            required
            autocomplete="off"
            :disabled="busy || !!requestBody" /></label
        ><button class="checkout-button" :disabled="busy">
          {{ busy ? 'Создаём заявку…' : 'Создать вывод' }}
        </button>
      </form>
      <section v-if="selected" class="payment-panel" aria-label="Заявка на вывод">
        <header>
          <Wallet :size="23" />
          <div>
            <span class="section-kicker">ТЕСТОВЫЙ ВЫВОД</span>
            <h3>{{ money(selected.amount) }} · {{ selected.method === 'card' ? 'На карту' : 'USDT' }}</h3>
          </div>
        </header>
        <p>{{ selected.recipient.display }}</p>
        <p v-if="selected.recipient.crypto_amount">
          {{ selected.recipient.crypto_amount }} USDT · {{ selected.recipient.network }}
        </p>
        <p class="withdrawal-state" role="status">{{ labels[selected.status] }}</p>
        <div v-if="selected.can_confirm" class="payment-actions">
          <button class="checkout-button" :disabled="busy" @click="simulate('paid')">
            <CheckCircle2 :size="18" />Имитировать успешный вывод
          </button>
          <div>
            <button :disabled="busy" @click="simulate('failed')">Имитировать отказ вывода</button
            ><button :disabled="busy" @click="simulate('cancelled')">Отменить вывод</button>
          </div>
        </div>
      </section>
      <details class="wallet-history" open>
        <summary>История вывода · {{ withdrawals.length }}</summary>
        <p v-if="!withdrawals.length">Заявок пока нет.</p>
        <button v-for="w in withdrawals" :key="w.id" class="wallet-payment-row" @click="selected = w">
          <div>
            <b>{{ w.method === 'card' ? 'Карта' : 'USDT' }} · {{ w.recipient.display }}</b
            ><small>{{ date(w.created_at) }} · {{ labels[w.status] }}</small>
          </div>
          <strong>{{ money(w.amount) }}</strong>
        </button>
      </details>
    </div>
  </section>
</template>
