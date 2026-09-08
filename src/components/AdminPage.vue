<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { Activity, Database, KeyRound, Store, Flag, Star } from '@lucide/vue';
import { authApi as api, apiBase } from '../api';
import type {
  InventoryKey,
  InventorySummary,
  PaymentCode,
  Product,
  Supplier,
  QueueReport,
  OrderGroup,
  Seller,
} from '../types';

import { refreshAccount } from '../auth';
import MoneyReport from './MoneyReport.vue';
import AdminModeration from './AdminModeration.vue';
type AdminTab = 'inventory' | 'payment-codes' | 'reliability' | 'sellers' | 'management';

const tab = ref<AdminTab>('management');
const queue = ref<QueueReport>({ providers: [], limits: [], unpaid: 0 });
const sellers = ref<Seller[]>([]);
const sellerForm = ref({ id: '', name: '' });
const offerForm = ref({ sku: '', provider: 'A', price: 500 });
const historyForm = ref({
  id: '',
  at: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
});
const history = ref<OrderGroup>();
let pollTimer: number | undefined;
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
  window.clearTimeout(pollTimer);
});
const products = ref<Product[]>([]);
const inventory = ref<{ summary: InventorySummary[]; keys: InventoryKey[] }>({ summary: [], keys: [] });
const suppliers = ref<Supplier[]>([]);
const reconciliation = ref<Record<string, unknown>>({});
const summary = ref<Record<string, any>>({});
const keyForm = ref({ provider: 'A', sku: '', codes: '' });
const paymentCodes = ref<PaymentCode[]>([]);
const paymentCodeForm = ref({ codes: '', value_points: 5000 });
const keySearch = ref('');
const notice = ref('');
const error = ref('');

const filteredKeys = computed(() => {
  const needle = keySearch.value.trim().toLowerCase();
  if (!needle) return inventory.value.keys;
  return inventory.value.keys.filter((key) =>
    `${key.code} ${key.provider} ${key.sku} ${key.offer_name} ${key.reserved_order_id ?? ''} ${key.claimed_by ?? ''}`
      .toLowerCase()
      .includes(needle),
  );
});

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function points(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
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
  const codes = keyForm.value.codes
    .split(/[\s,;]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  if (!codes.length) {
    error.value = 'Введите хотя бы один ключ.';
    return;
  }
  try {
    const result = await api<{
      inserted: string[];
      duplicates: string[];
      payment_codes_inserted: string[];
      payment_code_value_points: number;
    }>('/api/admin/inventory', {
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
  const codes = paymentCodeForm.value.codes
    .split(/[\s,;]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
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
        requests_per_minute: Number(supplier.requests_per_minute),
      }),
    });
    notice.value = `Настройки поставщика ${supplier.provider} сохранены.`;
    await refreshSuppliers();
  } catch (caught) {
    error.value = (caught as Error).message;
  }
}

async function refreshDashboard(): Promise<void> {
  [summary.value, reconciliation.value, queue.value] = await Promise.all([
    api<Record<string, any>>('/api/admin/summary'),
    api<Record<string, unknown>>('/api/reconciliation'),
    api<QueueReport>('/api/admin/queue'),
  ]);
}

async function recover(): Promise<void> {
  clearMessages();
  try {
    const result = await api<Record<string, number>>('/api/reconciliation/recover', {
      method: 'POST',
      body: '{}',
    });
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
  if (next === 'sellers') await refreshSellers();
  if (next === 'reliability') await Promise.all([refreshSuppliers(), refreshDashboard()]);
}

async function refreshSellers() {
  sellers.value = (await api<{ sellers: Seller[] }>('/api/sellers')).sellers;
}
async function createSeller() {
  clearMessages();
  try {
    await api('/api/admin/sellers', { method: 'POST', body: JSON.stringify(sellerForm.value) });
    sellerForm.value = { id: '', name: '' };
    await Promise.all([refreshSuppliers(), refreshSellers()]);
    notice.value = 'Продавец добавлен. Теперь создайте его предложения и пополните ключи.';
  } catch (caught) {
    error.value = (caught as Error).message;
  }
}
async function saveOffer() {
  clearMessages();
  try {
    await api(
      `/api/admin/offers/${encodeURIComponent(offerForm.value.sku)}/${encodeURIComponent(offerForm.value.provider)}`,
      { method: 'PUT', body: JSON.stringify({ price: offerForm.value.price }) },
    );
    notice.value = 'Предложение сохранено. Новая цена действует для следующих заказов.';
    await refreshCatalog();
  } catch (caught) {
    error.value = (caught as Error).message;
  }
}
async function loadHistory() {
  clearMessages();
  history.value = undefined;
  try {
    history.value = await api<OrderGroup>(
      `/api/orders/${encodeURIComponent(historyForm.value.id)}/history?at=${encodeURIComponent(new Date(historyForm.value.at).toISOString())}`,
    );
  } catch {
    error.value = 'На указанный момент заказ не найден. Проверьте ID и дату.';
  }
}

onMounted(async () => {
  document.title = 'Game Goods — администрирование';
  const user = await refreshAccount();
  if (!user) {
    location.href = '/account?next=/admin';
    return;
  }
  if (user.role !== 'admin') {
    error.value = 'Доступ разрешён только администратору.';
    return;
  }
  try {
    await Promise.all([
      refreshCatalog(),
      refreshInventory(),
      refreshPaymentCodes(),
      refreshSuppliers(),
      refreshDashboard(),
      refreshSellers(),
    ]);
    offerForm.value.sku = products.value[0]?.sku ?? '';
    const poll = async () => {
      if (disposed) return;
      try {
        if (tab.value === 'reliability') await refreshDashboard();
      } catch {}
      if (!disposed) pollTimer = window.setTimeout(poll, 5000);
    };
    pollTimer = window.setTimeout(poll, 5000);
  } catch (caught) {
    error.value = `API недоступен (${apiBase || 'same origin'}): ${(caught as Error).message}`;
  }
});
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="admin-brand">
        <span>GG</span>
        <div><b>Game Goods</b><small>CONTROL ROOM</small></div>
      </div>
      <nav>
        <button :class="{ active: tab === 'management' }" @click="switchTab('management')">
          <Store :size="18" />Заказы и модерация
        </button>
        <button :class="{ active: tab === 'inventory' }" @click="switchTab('inventory')">
          <Database :size="18" /> Ключи и остатки
        </button>
        <button :class="{ active: tab === 'payment-codes' }" @click="switchTab('payment-codes')">
          <KeyRound :size="18" /> Платёжные коды
        </button>
        <button :class="{ active: tab === 'sellers' }" @click="switchTab('sellers')">
          <Store :size="18" /> Продавцы
        </button>
        <button :class="{ active: tab === 'reliability' }" @click="switchTab('reliability')">
          <Activity :size="18" /> Надёжность
        </button>
      </nav>
      <div class="admin-api">
        <i></i>
        <div>
          <small>Backend API</small><b>{{ apiBase || 'same origin' }}</b>
        </div>
      </div>
      <a class="back-store" href="/">← Открыть витрину</a>
    </aside>

    <main class="admin-main">
      <div v-if="notice" class="admin-toast success">{{ notice }}</div>
      <div v-if="error" class="admin-toast error">{{ error }}</div>

      <AdminModeration v-if="tab === 'management'" />
      <template v-if="tab === 'inventory'">
        <header class="admin-heading">
          <div>
            <span>ADMIN / INVENTORY</span>
            <h1>Ключи и остатки</h1>
            <p>Пакетное пополнение базы и полный список кодов из PostgreSQL.</p>
          </div>
          <button @click="refreshInventory">Обновить данные</button>
        </header>

        <section class="admin-metrics">
          <article>
            <span>Доступно</span><strong>{{ summary.inventory?.available ?? 0 }}</strong
            ><small>готовы к выдаче</small>
          </article>
          <article>
            <span>Выдано</span><strong>{{ summary.inventory?.issued ?? 0 }}</strong
            ><small>закреплены за заказами</small>
          </article>
          <article>
            <span>Всего ключей</span><strong>{{ summary.inventory?.total ?? 0 }}</strong
            ><small>в базе данных</small>
          </article>
          <article>
            <span>В резерве</span><strong>{{ summary.inventory?.reserved ?? 0 }}</strong
            ><small>ожидают оплаты или выдачи</small>
          </article>
        </section>

        <section class="admin-grid">
          <form class="admin-panel add-key-panel" @submit.prevent="addKeys">
            <div class="panel-heading">
              <div>
                <small>DATABASE INPUT</small>
                <h2>Добавить ключи</h2>
              </div>
              <span>batch</span>
            </div>
            <label
              >Товар<select v-model="keyForm.sku">
                <option v-for="product in products" :key="product.sku" :value="product.sku">
                  {{ product.name }} · {{ product.sku }}
                </option>
              </select></label
            >
            <div class="admin-form-row">
              <label
                >Поставщик<select v-model="keyForm.provider">
                  <option v-for="supplier in suppliers" :key="supplier.provider" :value="supplier.provider">
                    {{ supplier.provider }}
                  </option>
                </select></label
              >
              <div class="admin-hint">
                Каждый ключ также станет одноразовым платёжным кодом с номиналом цены выбранного товара.
                Дубликаты не попадут в БД.
              </div>
            </div>
            <label
              >Коды<textarea
                v-model="keyForm.codes"
                rows="10"
                placeholder="ABCD-EFGH-IJKL&#10;MNOP-QRST-UVWX"
              ></textarea>
            </label>
            <button class="primary-admin-button" type="submit">Добавить ключи в базу</button>
          </form>

          <div class="admin-panel stock-panel">
            <div class="panel-heading">
              <div>
                <small>LIVE STOCK</small>
                <h2>Остатки по SKU</h2>
              </div>
              <span>{{ inventory.summary.length }} строк</span>
            </div>
            <div class="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Поставщик</th>
                    <th>Свободно</th>
                    <th>В резерве</th>
                    <th>Выдано</th>
                    <th>Всего</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in inventory.summary" :key="`${row.sku}-${row.provider}`">
                    <td>
                      <strong>{{ row.name }}</strong
                      ><code>{{ row.sku }}</code>
                    </td>
                    <td>
                      <b class="provider-chip">{{ row.provider }}</b>
                    </td>
                    <td class="positive">{{ row.available }}</td>
                    <td>{{ row.reserved }}</td>
                    <td>{{ row.issued }}</td>
                    <td>{{ row.total }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="admin-panel key-list-panel">
          <div class="panel-heading">
            <div>
              <small>RAW INVENTORY</small>
              <h2>Все ключи в базе</h2>
            </div>
            <label class="admin-search"
              >⌕<input v-model="keySearch" placeholder="Код, SKU или заказ"
            /></label>
          </div>
          <div class="admin-table-wrap keys-table">
            <table>
              <thead>
                <tr>
                  <th>Код</th>
                  <th>SKU</th>
                  <th>Поставщик</th>
                  <th>Состояние</th>
                  <th>Заказ</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="key in filteredKeys" :key="key.code">
                  <td>
                    <code class="raw-code">{{ key.code }}</code>
                  </td>
                  <td>
                    <code>{{ key.sku }}</code
                    ><small>{{ key.offer_name }}</small>
                  </td>
                  <td>
                    <b class="provider-chip">{{ key.provider }}</b>
                  </td>
                  <td>
                    <span class="key-state" :class="{ issued: key.claimed_by }">{{ key.status_label }}</span>
                  </td>
                  <td>
                    <code>{{ key.reserved_order_id || key.claimed_by || '—' }}</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-else-if="tab === 'payment-codes'">
        <header class="admin-heading">
          <div>
            <span>ADMIN / PAYMENT CODES</span>
            <h1>Платёжные коды</h1>
            <p>Коды, которые покупатель вводит вручную в корзине вместо списания баллов.</p>
          </div>
          <button @click="refreshPaymentCodes">Обновить данные</button>
        </header>

        <section class="admin-metrics">
          <article>
            <span>Всего кодов</span><strong>{{ paymentCodes.length }}</strong
            ><small>хранятся в PostgreSQL</small>
          </article>
          <article>
            <span>Доступно</span><strong>{{ paymentCodes.filter((code) => !code.used_at).length }}</strong
            ><small>можно применить</small>
          </article>
          <article>
            <span>Использовано</span><strong>{{ paymentCodes.filter((code) => code.used_at).length }}</strong
            ><small>повтор запрещён</small>
          </article>
          <article><span>Коды ТЗ</span><strong>50</strong><small>загружены автоматически</small></article>
        </section>

        <section class="admin-grid payment-code-admin-grid">
          <form class="admin-panel add-key-panel" @submit.prevent="addPaymentCodeBatch">
            <div class="panel-heading">
              <div>
                <small>MANUAL PAYMENT</small>
                <h2>Добавить платёжные коды</h2>
              </div>
              <span>batch</span>
            </div>
            <label
              >Номинал каждого кода, баллов<input
                v-model.number="paymentCodeForm.value_points"
                type="number"
                min="1"
                max="10000000"
                required
            /></label>
            <label
              >Коды<textarea
                v-model="paymentCodeForm.codes"
                rows="13"
                placeholder="LFXC-TNCS-BPCD&#10;P3EI-W8UO-9B4K"
              ></textarea>
            </label>
            <button class="primary-admin-button" type="submit">Добавить платёжные коды</button>
          </form>
          <section class="admin-panel key-list-panel payment-code-list">
            <div class="panel-heading">
              <div>
                <small>PAYMENT CODE DATABASE</small>
                <h2>Список кодов</h2>
              </div>
              <span>{{ paymentCodes.length }} строк</span>
            </div>
            <div class="admin-table-wrap keys-table">
              <table>
                <thead>
                  <tr>
                    <th>Код</th>
                    <th>Номинал</th>
                    <th>Источник</th>
                    <th>Статус</th>
                    <th>Пользователь</th>
                    <th>Использован</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="code in paymentCodes" :key="code.code">
                    <td>
                      <code class="raw-code">{{ code.code }}</code>
                    </td>
                    <td>{{ points(code.value_points) }}</td>
                    <td>
                      <span v-if="code.source_sku"
                        ><strong>{{ code.source_name }}</strong
                        ><code>{{ code.source_sku }}</code></span
                      ><span v-else>Ручной номинал</span>
                    </td>
                    <td>
                      <span class="key-state" :class="{ issued: code.used_at }">{{
                        code.used_at ? 'Использован' : 'Доступен'
                      }}</span>
                    </td>
                    <td>{{ code.used_by_username || '—' }}</td>
                    <td>{{ code.used_at ? new Date(code.used_at).toLocaleString('ru-RU') : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </template>

      <template v-else-if="tab === 'reliability'">
        <header class="admin-heading">
          <div>
            <span>ADMIN / RELIABILITY</span>
            <h1>Сбои и восстановление</h1>
            <p>Управление поставщиками и проверка целостности выдачи.</p>
          </div>
          <button @click="recover">Запустить сверку</button>
        </header>

        <section class="admin-metrics reliability-metrics">
          <article>
            <span>Оплачены, не выданы</span
            ><strong>{{ (reconciliation.paid_not_delivered as any[])?.length ?? 0 }}</strong>
          </article>
          <article>
            <span>Выданы, не оплачены</span
            ><strong>{{ (reconciliation.delivered_not_paid as any[])?.length ?? 0 }}</strong>
          </article>
          <article>
            <span>Дисбалансы ledger</span
            ><strong>{{ (reconciliation.ledger_imbalances as any[])?.length ?? 0 }}</strong>
          </article>
          <article>
            <span>Webhook ждут заказ</span
            ><strong>{{ (reconciliation.pending_webhooks as any[])?.length ?? 0 }}</strong>
          </article>
        </section>

        <section class="admin-panel queue-table">
          <div class="panel-heading">
            <div>
              <small>DELIVERY QUEUE</small>
              <h2>Очередь и лимиты</h2>
            </div>
            <span>Обновление каждые 5 секунд</span>
          </div>
          <div class="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Продавец</th>
                  <th>В очереди</th>
                  <th>Обработка</th>
                  <th>Выдано</th>
                  <th>Возвраты</th>
                  <th>Запросов / лимит</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="limit in queue.limits" :key="limit.provider">
                  <td>{{ limit.provider }}</td>
                  <td>{{ queue.providers.find((p) => p.provider === limit.provider)?.queued ?? 0 }}</td>
                  <td>{{ queue.providers.find((p) => p.provider === limit.provider)?.processing ?? 0 }}</td>
                  <td>{{ queue.providers.find((p) => p.provider === limit.provider)?.delivered ?? 0 }}</td>
                  <td>{{ queue.providers.find((p) => p.provider === limit.provider)?.refunded ?? 0 }}</td>
                  <td>{{ limit.requests_last_minute }} / {{ limit.requests_per_minute }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="admin-hint">
            Неоплаченных позиций: {{ queue.unpaid }}. Запросы поставщикам выполняются только для оплаченных
            заказов.
          </p>
        </section>

        <section class="supplier-admin-grid">
          <form
            v-for="supplier in suppliers"
            :key="supplier.provider"
            class="admin-panel supplier-admin"
            @submit.prevent="saveSupplier(supplier)"
          >
            <div class="supplier-admin-title">
              <b>{{ supplier.display_name?.slice(0, 2) || supplier.provider.slice(0, 2) }}</b>
              <div>
                <small>SUPPLIER</small>
                <h2>{{ supplier.display_name || supplier.provider }}</h2>
                <code>{{ supplier.provider }}</code>
              </div>
            </div>
            <label
              >Режим<select v-model="supplier.mode">
                <option value="normal">normal</option>
                <option value="always_fail">always_fail (5xx)</option>
                <option value="out_of_stock">out_of_stock</option>
                <option value="timeout_before_issue">timeout_before_issue</option>
                <option value="timeout_after_issue">timeout_after_issue</option>
                <option value="duplicate_code">duplicate_code · повторный код</option>
                <option value="wrong_code">wrong_code · чужой код</option>
                <option value="error_after_issue">error_after_issue · ошибка после выдачи</option>
              </select></label
            >
            <div class="admin-form-row">
              <label
                >Доля 5xx<input
                  v-model.number="supplier.failure_rate"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05" /></label
              ><label
                >Доля timeout<input
                  v-model.number="supplier.timeout_rate"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
              /></label>
            </div>
            <div class="admin-form-row">
              <label>Задержка, мс<input v-model.number="supplier.min_delay_ms" type="number" min="0" /></label
              ><label
                >Timeout, мс<input v-model.number="supplier.timeout_delay_ms" type="number" min="0"
              /></label>
            </div>
            <label
              >Лимит запросов в минуту<input
                v-model.number="supplier.requests_per_minute"
                type="number"
                min="1"
                max="100000"
                required
            /></label>
            <button class="primary-admin-button" type="submit">
              Сохранить поставщика {{ supplier.provider }}
            </button>
          </form>
        </section>

        <section class="admin-panel wallet-reconciliation">
          <h2>Баланс личных кабинетов</h2>
          <p>
            Баланс пользователей: {{ money((reconciliation.wallet as any)?.balances ?? 0) }} · В журнале:
            {{ money((reconciliation.wallet as any)?.ledger_balance ?? 0) }}
          </p>
          <strong>{{ (reconciliation.wallet as any)?.balanced ? 'Сходится' : 'Требует проверки' }}</strong>
        </section>
        <section class="admin-panel ledger-admin">
          <div>
            <small>DOUBLE-ENTRY LEDGER</small>
            <h2>Денежные счета</h2>
          </div>
          <div class="ledger-list">
            <article v-for="account in summary.ledger" :key="account.account">
              <span>{{ account.account }}</span
              ><strong>{{ money(account.balance) }}</strong>
            </article>
          </div>
        </section>
        <section class="admin-panel queue-table">
          <div class="panel-heading">
            <div>
              <small>SETTLEMENT</small>
              <h2>Сходятся ли деньги</h2>
            </div>
          </div>
          <div class="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>Оплачено</th>
                  <th>Выдано</th>
                  <th>Возвращено</th>
                  <th>Ожидает</th>
                  <th>Итог</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in reconciliation.money as any[]" :key="row.order_id">
                  <td>
                    <code>{{ row.order_id }}</code>
                  </td>
                  <td>{{ money(row.paid) }}</td>
                  <td>{{ money(row.delivered) }}</td>
                  <td>{{ money(row.refunded) }}</td>
                  <td>{{ money(row.pending) }}</td>
                  <td :class="{ 'money-row-ok': row.settled }">
                    {{ row.settled ? 'Сходится' : 'В обработке' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <MoneyReport />
        <section class="admin-panel history-panel">
          <div class="panel-heading">
            <div>
              <small>APPEND-ONLY HISTORY</small>
              <h2>Заказ на прошлый момент</h2>
            </div>
          </div>
          <form class="history-form" @submit.prevent="loadHistory">
            <label>ID заказа<input v-model="historyForm.id" required placeholder="ord_… или chk_…" /></label
            ><label>Дата и время<input v-model="historyForm.at" type="datetime-local" required /></label
            ><button type="submit" class="primary-admin-button">Восстановить</button>
          </form>
          <div v-if="history" class="history-result">
            <p>
              Состояние: <b>{{ history.status }}</b>
            </p>
            <div class="order-money">
              <div>
                <span>Оплачено</span><b>{{ money(history.money.paid) }}</b>
              </div>
              <div>
                <span>Выдано</span><b>{{ money(history.money.delivered) }}</b>
              </div>
              <div>
                <span>Возвращено</span><b>{{ money(history.money.refunded) }}</b>
              </div>
              <div>
                <span>Ожидает</span><b>{{ money(history.money.pending) }}</b>
              </div>
            </div>
          </div>
        </section>
      </template>
      <template v-else-if="tab === 'sellers'"
        ><header class="admin-heading">
          <div>
            <span>ADMIN / SELLERS</span>
            <h1>Продавцы и предложения</h1>
            <p>Цены, подтверждённые отзывы и автоматическая проверка репутации.</p>
          </div>
          <button @click="refreshSellers">Обновить</button>
        </header>
        <section class="admin-panel">
          <div class="panel-heading">
            <div>
              <small>SELLER DIRECTORY</small>
              <h2>Продавцы</h2>
            </div>
          </div>
          <div class="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Продавец</th>
                  <th>Оценка</th>
                  <th>Отзывы</th>
                  <th>Выдано</th>
                  <th>Нарушения</th>
                  <th>Репутация</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="seller in sellers" :key="seller.id">
                  <td>
                    <a :href="`/seller/${seller.id}`">{{ seller.name }} ↗</a><code>{{ seller.id }}</code>
                  </td>
                  <td>{{ seller.rating === null ? 'Нет оценок' : `${seller.rating} / 5` }}</td>
                  <td>{{ seller.review_count }}</td>
                  <td>{{ seller.delivered }}</td>
                  <td>{{ seller.confirmed_incidents }}</td>
                  <td>
                    <span v-if="seller.flag === 'red'" class="red-flag"><Flag :size="12" />Красный флаг</span
                    ><span v-else>Нарушений не выявлено</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section class="admin-panel history-panel">
          <h2>Добавить продавца</h2>
          <form class="seller-admin-form" @submit.prevent="createSeller">
            <label
              >ID<input
                v-model="sellerForm.id"
                pattern="[A-Za-z0-9_-]{1,48}"
                required
                placeholder="vendor_003" /></label
            ><label
              >Название<input
                v-model="sellerForm.name"
                minlength="2"
                maxlength="80"
                required
                placeholder="Название магазина" /></label
            ><button class="primary-admin-button">Добавить</button>
          </form>
        </section>
        <section class="admin-panel history-panel">
          <h2>Цена продавца на товар</h2>
          <form class="offer-admin-form" @submit.prevent="saveOffer">
            <label
              >Товар<select v-model="offerForm.sku" required>
                <option v-for="product in products" :key="product.sku" :value="product.sku">
                  {{ product.name }}
                </option>
              </select></label
            ><label
              >Продавец<select v-model="offerForm.provider">
                <option v-for="seller in sellers" :key="seller.id" :value="seller.id">
                  {{ seller.name }}
                </option>
              </select></label
            ><label
              >Цена<input
                v-model.number="offerForm.price"
                type="number"
                min="1"
                max="10000000"
                required /></label
            ><button class="primary-admin-button">Сохранить</button>
          </form>
        </section>
      </template>
    </main>
  </div>
</template>
