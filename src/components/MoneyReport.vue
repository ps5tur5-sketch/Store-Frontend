<script setup lang="ts">
import { ref } from 'vue';
import { authApi } from '../api';
import { money } from '../format';
function localTime(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const from = ref(localTime(new Date(Date.now() - 86400000))),
  to = ref(localTime(new Date(Date.now() + 60000)));
const error = ref('');
const busy = ref(false);
const report = ref<{
  accounts: { account: string; currency: string; opening: number; movement: number; closing: number }[];
}>();
async function load() {
  busy.value = true;
  error.value = '';
  try {
    report.value = await authApi(
      `/api/admin/money?from=${encodeURIComponent(new Date(from.value).toISOString())}&to=${encodeURIComponent(new Date(to.value).toISOString())}`,
    );
  } catch {
    error.value = 'Не удалось получить отчёт. Проверьте границы периода.';
  } finally {
    busy.value = false;
  }
}
const names: Record<string, string> = {
  cash: 'Поступления',
  customer_clearing: 'Обязательства по выдаче',
  sales: 'Продажи',
  wallet: 'Возвраты на баланс',
};
</script>
<template>
  <section class="admin-panel history-panel">
    <div class="panel-heading">
      <div>
        <small>PERIOD REPORT</small>
        <h2>Деньги за период</h2>
      </div>
    </div>
    <form class="history-form" @submit.prevent="load">
      <label>Начало периода<input v-model="from" type="datetime-local" required /></label
      ><label>Конец, не включая<input v-model="to" type="datetime-local" required /></label
      ><button class="primary-admin-button" :disabled="busy">Построить отчёт</button>
    </form>
    <p v-if="error" class="inline-error">{{ error }}</p>
    <div v-if="report" class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Счёт</th>
            <th>На начало</th>
            <th>Движение</th>
            <th>На конец</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in report.accounts" :key="row.account + row.currency">
            <td>
              {{ names[row.account] || row.account }}<small>{{ row.account }} · {{ row.currency }}</small>
            </td>
            <td>{{ money(row.opening) }}</td>
            <td>{{ money(row.movement) }}</td>
            <td>{{ money(row.closing) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="admin-hint">
        Знаки отражают дебет и кредит. Сумма движений по всем счетам одной валюты равна нулю.
      </p>
    </div>
  </section>
</template>
