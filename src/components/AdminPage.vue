<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Activity, Database, KeyRound } from '@lucide/vue';
import { api, apiBase } from '../api';
import type { InventoryKey, InventorySummary, PaymentCode, Product, Supplier } from '../types';

type AdminTab = 'inventory' | 'payment-codes' | 'reliability';

const tab = ref<AdminTab>('inventory');
const products = ref<Product[]>([]);
const inventory = ref<{ summary: InventorySummary[]; keys: InventoryKey[] }>({ summary: [], keys: [] });
const suppliers = ref<Supplier[]>([]);
const reconciliation = ref<Record<string, unknown>>({});
const summary = ref<Record<string, any>>({});
const keyForm = ref({ provider: 'A' as 'A' | 'B', sku: '', codes: '' });
const paymentCodes = ref<PaymentCode[]>([]);
const paymentCodeForm = ref({ codes: '', value_points: 5000 });
const keySearch = ref('');
const notice = ref('');
const error = ref('');

const filteredKeys = computed(() => {
  const needle = keySearch.value.trim().toLowerCase();
  if (!needle) return inventory.value.keys;
  return inventory.value.keys.filter((key) => `${key.code} ${key.provider} ${key.sku} ${key.claimed_by ?? ''}`.toLowerCase().includes(needle));
});

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function points(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' баллов';
}

function clearMessages(): void {
  notice.value = '';
  error.value = '';
}

async function refreshCatalog(): Promise<void> {
  const result = await api<{ items: Product[] }>('/api/catalog?limit=100');
  products.value = result.items;
  if (!keyForm.value.sku && result.items[0]) keyForm.value.sku = result.items[0].sku;
}

async function refreshInventory(): Promise<void> {
  inventory.value = await api('/api/admin/inventory');
}

async function addKeys(): Promise<void> {
  clearMessages();
  const codes = keyForm.value.codes.split(/[\s,;]+/).map((code) => code.trim().toUpperCase()).filter(Boolean);
  if (!codes.length) {
    error.value = 'Введите хотя бы один ключ.';
    return;
  }
  try {
    const result = await api<{ inserted: string[]; duplicates: string[]; payment_codes_inserted: string[]; payment_code_value_points: number }>('/api/admin/inventory', {
      method: 'POST',
      body: JSON.stringify({ provider: keyForm.value.provider, sku: keyForm.value.sku, codes }),
    });
    keyForm.value.codes = '';
    notice.value = `Добавлено ключей: ${result.inserted.length}; дубликатов: ${result.duplicates.length}. Как платёжные коды добавлено: ${result.payment_codes_inserted.length}, номинал ${points(result.payment_code_value_points)}.`;
    await Promise.all([refreshInventory(), refreshPaymentCodes(), refreshCatalog(), refreshDashboard()]);
  } catch (caught) {
    error.value = (caught as Error).message;
  }
}

async function refreshPaymentCodes(): Promise<void> {
  paymentCodes.value = (await api<{ codes: PaymentCode[] }>('/api/admin/payment-codes')).codes;
}

async function addPaymentCodeBatch(): Promise<void> {
  clearMessages();
  const codes = paymentCodeForm.value.codes.split(/[\s,;]+/).map((code) => code.trim().toUpperCase()).filter(Boolean);
  if (!codes.length) {
    error.value = 'Введите хотя бы один платёжный код.';
    return;
  }
  try {
    const result = await api<{ inserted: string[]; duplicates: string[] }>('/api/admin/payment-codes', {
      method: 'POST',
      body: JSON.stringify({ codes, value_points: Number(paymentCodeForm.value.value_points) }),
    });
    paymentCodeForm.value.codes = '';
    notice.value = `Платёжных кодов добавлено: ${result.inserted.length}; дубликатов: ${result.duplicates.length}.`;
    await refreshPaymentCodes();
  } catch (caught) {
    error.value = (caught as Error).message;
  }
}

async function refreshSuppliers(): Promise<void> {
  const result = await api<{ suppliers: Supplier[] }>('/api/admin/suppliers');
  suppliers.value = result.suppliers;
}

async function saveSupplier(supplier: Supplier): Promise<void> {
  clearMessages();
  try {
    await api(`/api/admin/suppliers/${supplier.provider}`, {
      method: 'PUT',
      body: JSON.stringify({
        mode: supplier.mode,
        failure_rate: Number(supplier.failure_rate),
        timeout_rate: Number(supplier.timeout_rate),
        min_delay_ms: Number(supplier.min_delay_ms),
        timeout_delay_ms: Number(supplier.timeout_delay_ms),
      }),
    });
    notice.value = `Настройки поставщика ${supplier.provider} сохранены.`;
    await refreshSuppliers();
  } catch (caught) {
    error.value = (caught as Error).message;
  }
}

async function refreshDashboard(): Promise<void> {
  [summary.value, reconciliation.value] = await Promise.all([
    api<Record<string, any>>('/api/admin/summary'),
    api<Record<string, unknown>>('/api/reconciliation'),
  ]);
}

async function recover(): Promise<void> {
  clearMessages();
  try {
    const result = await api<Record<string, number>>('/api/reconciliation/recover', { method: 'POST', body: '{}' });
    await api('/api/admin/workers/run', { method: 'POST', body: JSON.stringify({ limit: 100 }) });
    notice.value = `Сверка: запланировано ${result.scheduledOrders ?? 0}, разблокировано ${result.unlockedJobs ?? 0}.`;
    await Promise.all([refreshDashboard(), refreshInventory(), refreshCatalog()]);
  } catch (caught) {
    error.value = (caught as Error).message;
  }
}

async function switchTab(next: AdminTab): Promise<void> {
  tab.value = next;
  clearMessages();
  if (next === 'inventory') await refreshInventory();
  if (next === 'payment-codes') await refreshPaymentCodes();
  if (next === 'reliability') await Promise.all([refreshSuppliers(), refreshDashboard()]);
}

onMounted(async () => {
  document.title = 'Game Goods — администрирование';
  try {
    await Promise.all([refreshCatalog(), refreshInventory(), refreshPaymentCodes(), refreshSuppliers(), refreshDashboard()]);
  } catch (caught) {
    error.value = `API недоступен (${apiBase || 'same origin'}): ${(caught as Error).message}`;
  }
});
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="admin-brand"><span>GG</span><div><b>Game Goods</b><small>CONTROL ROOM</small></div></div>
      <nav>
        <button :class="{ active: tab === 'inventory' }" @click="switchTab('inventory')"><Database :size="18" /> Ключи и остатки</button>
        <button :class="{ active: tab === 'payment-codes' }" @click="switchTab('payment-codes')"><KeyRound :size="18" /> Платёжные коды</button>
        <button :class="{ active: tab === 'reliability' }" @click="switchTab('reliability')"><Activity :size="18" /> Надёжность</button>
      </nav>
      <div class="admin-api"><i></i><div><small>Backend API</small><b>{{ apiBase || 'same origin' }}</b></div></div>
      <a class="back-store" href="/">← Открыть витрину</a>
    </aside>

    <main class="admin-main">
      <div v-if="notice" class="admin-toast success">{{ notice }}</div>
      <div v-if="error" class="admin-toast error">{{ error }}</div>

      <template v-if="tab === 'inventory'">
        <header class="admin-heading"><div><span>ADMIN / INVENTORY</span><h1>Ключи и остатки</h1><p>Пакетное пополнение базы и полный список кодов из PostgreSQL.</p></div><button @click="refreshInventory">Обновить данные</button></header>

        <section class="admin-metrics">
          <article><span>Доступно</span><strong>{{ summary.inventory?.available ?? 0 }}</strong><small>готовы к выдаче</small></article>
          <article><span>Выдано</span><strong>{{ summary.inventory?.issued ?? 0 }}</strong><small>закреплены за заказами</small></article>
          <article><span>Всего ключей</span><strong>{{ Number(summary.inventory?.available ?? 0) + Number(summary.inventory?.issued ?? 0) }}</strong><small>в базе данных</small></article>
          <article><span>Товаров</span><strong>{{ products.length }}</strong><small>активных SKU</small></article>
        </section>

        <section class="admin-grid">
          <form class="admin-panel add-key-panel" @submit.prevent="addKeys">
            <div class="panel-heading"><div><small>DATABASE INPUT</small><h2>Добавить ключи</h2></div><span>batch</span></div>
            <label>Товар<select v-model="keyForm.sku"><option v-for="product in products" :key="product.sku" :value="product.sku">{{ product.name }} · {{ product.sku }}</option></select></label>
            <div class="admin-form-row"><label>Поставщик<select v-model="keyForm.provider"><option>A</option><option>B</option></select></label><div class="admin-hint">Каждый ключ также станет одноразовым платёжным кодом с номиналом цены выбранного товара. Дубликаты не попадут в БД.</div></div>
            <label>Коды<textarea v-model="keyForm.codes" rows="10" placeholder="ABCD-EFGH-IJKL&#10;MNOP-QRST-UVWX"></textarea></label>
            <button class="primary-admin-button" type="submit">Добавить ключи в базу</button>
          </form>

          <div class="admin-panel stock-panel">
            <div class="panel-heading"><div><small>LIVE STOCK</small><h2>Остатки по SKU</h2></div><span>{{ inventory.summary.length }} строк</span></div>
            <div class="admin-table-wrap"><table><thead><tr><th>Товар</th><th>Поставщик</th><th>Свободно</th><th>Выдано</th><th>Всего</th></tr></thead><tbody><tr v-for="row in inventory.summary" :key="`${row.sku}-${row.provider}`"><td><strong>{{ row.name }}</strong><code>{{ row.sku }}</code></td><td><b class="provider-chip">{{ row.provider }}</b></td><td class="positive">{{ row.available }}</td><td>{{ row.issued }}</td><td>{{ row.total }}</td></tr></tbody></table></div>
          </div>
        </section>

        <section class="admin-panel key-list-panel">
          <div class="panel-heading"><div><small>RAW INVENTORY</small><h2>Все ключи в базе</h2></div><label class="admin-search">⌕<input v-model="keySearch" placeholder="Код, SKU или заказ"></label></div>
          <div class="admin-table-wrap keys-table"><table><thead><tr><th>Код</th><th>SKU</th><th>Поставщик</th><th>Состояние</th><th>Заказ</th></tr></thead><tbody><tr v-for="key in filteredKeys" :key="key.code"><td><code class="raw-code">{{ key.code }}</code></td><td><code>{{ key.sku }}</code></td><td><b class="provider-chip">{{ key.provider }}</b></td><td><span class="key-state" :class="{ issued: key.claimed_by }">{{ key.claimed_by ? 'Выдан' : 'Доступен' }}</span></td><td><code>{{ key.claimed_by || '—' }}</code></td></tr></tbody></table></div>
        </section>
      </template>

      <template v-else-if="tab === 'payment-codes'">
        <header class="admin-heading"><div><span>ADMIN / PAYMENT CODES</span><h1>Платёжные коды</h1><p>Коды, которые покупатель вводит вручную в корзине вместо списания баллов.</p></div><button @click="refreshPaymentCodes">Обновить данные</button></header>

        <section class="admin-metrics">
          <article><span>Всего кодов</span><strong>{{ paymentCodes.length }}</strong><small>хранятся в PostgreSQL</small></article>
          <article><span>Доступно</span><strong>{{ paymentCodes.filter((code) => !code.used_at).length }}</strong><small>можно применить</small></article>
          <article><span>Использовано</span><strong>{{ paymentCodes.filter((code) => code.used_at).length }}</strong><small>повтор запрещён</small></article>
          <article><span>Коды ТЗ</span><strong>50</strong><small>загружены автоматически</small></article>
        </section>

        <section class="admin-grid payment-code-admin-grid">
          <form class="admin-panel add-key-panel" @submit.prevent="addPaymentCodeBatch">
            <div class="panel-heading"><div><small>MANUAL PAYMENT</small><h2>Добавить платёжные коды</h2></div><span>batch</span></div>
            <label>Номинал каждого кода, баллов<input v-model.number="paymentCodeForm.value_points" type="number" min="1" max="10000000" required></label>
            <label>Коды<textarea v-model="paymentCodeForm.codes" rows="13" placeholder="LFXC-TNCS-BPCD&#10;P3EI-W8UO-9B4K"></textarea></label>
            <button class="primary-admin-button" type="submit">Добавить платёжные коды</button>
          </form>
          <section class="admin-panel key-list-panel payment-code-list">
            <div class="panel-heading"><div><small>PAYMENT CODE DATABASE</small><h2>Список кодов</h2></div><span>{{ paymentCodes.length }} строк</span></div>
            <div class="admin-table-wrap keys-table"><table><thead><tr><th>Код</th><th>Номинал</th><th>Источник</th><th>Статус</th><th>Пользователь</th><th>Использован</th></tr></thead><tbody><tr v-for="code in paymentCodes" :key="code.code"><td><code class="raw-code">{{ code.code }}</code></td><td>{{ points(code.value_points) }}</td><td><span v-if="code.source_sku"><strong>{{ code.source_name }}</strong><code>{{ code.source_sku }}</code></span><span v-else>Ручной номинал</span></td><td><span class="key-state" :class="{ issued: code.used_at }">{{ code.used_at ? 'Использован' : 'Доступен' }}</span></td><td>{{ code.used_by_username || '—' }}</td><td>{{ code.used_at ? new Date(code.used_at).toLocaleString('ru-RU') : '—' }}</td></tr></tbody></table></div>
          </section>
        </section>
      </template>

      <template v-else>
        <header class="admin-heading"><div><span>ADMIN / RELIABILITY</span><h1>Сбои и восстановление</h1><p>Управление двумя поставщиками и проверка целостности выдачи.</p></div><button @click="recover">Запустить сверку</button></header>

        <section class="admin-metrics reliability-metrics">
          <article><span>Оплачены, не выданы</span><strong>{{ (reconciliation.paid_not_delivered as any[])?.length ?? 0 }}</strong></article>
          <article><span>Выданы, не оплачены</span><strong>{{ (reconciliation.delivered_not_paid as any[])?.length ?? 0 }}</strong></article>
          <article><span>Дисбалансы ledger</span><strong>{{ (reconciliation.ledger_imbalances as any[])?.length ?? 0 }}</strong></article>
          <article><span>Webhook ждут заказ</span><strong>{{ (reconciliation.pending_webhooks as any[])?.length ?? 0 }}</strong></article>
        </section>

        <section class="supplier-admin-grid">
          <form v-for="supplier in suppliers" :key="supplier.provider" class="admin-panel supplier-admin" @submit.prevent="saveSupplier(supplier)">
            <div class="supplier-admin-title"><b>{{ supplier.provider }}</b><div><small>SUPPLIER</small><h2>{{ supplier.provider === 'A' ? 'Основной поставщик' : 'Резервный поставщик' }}</h2></div></div>
            <label>Режим<select v-model="supplier.mode"><option value="normal">normal</option><option value="always_fail">always_fail (5xx)</option><option value="out_of_stock">out_of_stock</option><option value="timeout_before_issue">timeout_before_issue</option><option value="timeout_after_issue">timeout_after_issue</option></select></label>
            <div class="admin-form-row"><label>Доля 5xx<input v-model.number="supplier.failure_rate" type="number" min="0" max="1" step="0.05"></label><label>Доля timeout<input v-model.number="supplier.timeout_rate" type="number" min="0" max="1" step="0.05"></label></div>
            <div class="admin-form-row"><label>Задержка, мс<input v-model.number="supplier.min_delay_ms" type="number" min="0"></label><label>Timeout, мс<input v-model.number="supplier.timeout_delay_ms" type="number" min="0"></label></div>
            <button class="primary-admin-button" type="submit">Сохранить поставщика {{ supplier.provider }}</button>
          </form>
        </section>

        <section class="admin-panel ledger-admin">
          <div><small>DOUBLE-ENTRY LEDGER</small><h2>Денежные счета</h2></div>
          <div class="ledger-list"><article v-for="account in summary.ledger" :key="account.account"><span>{{ account.account }}</span><strong>{{ money(account.balance) }}</strong></article></div>
        </section>
      </template>
    </main>
  </div>
</template>
