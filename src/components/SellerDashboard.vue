<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { Store, PackageCheck, Wallet, Undo2, MessageCircle } from '@lucide/vue';
import { authApi } from '../api';
import { accountUser, logout } from '../auth';
import type { Seller } from '../types';
import { money, date, statusLabels } from '../format';
import SellerLotSplit from './SellerLotSplit.vue';
import SellerKeyPrices from './SellerKeyPrices.vue';
import SellerActivation from './SellerActivation.vue';
import SiteHeader from './SiteHeader.vue';
import OrderChat from './OrderChat.vue';
interface Offer {
  offer_id: string;
  offer_name: string;
  is_default: boolean;
  reserved: number;
  sku: string;
  name: string;
  image: string;
  price: number;
  active: boolean;
  is_mine: boolean;
  available: number;
  sold: number;
  refunds: number;
  net_income: number;
  profit: number | null;
  listing_status: string;
  listing_label: string;
}
interface Sale {
  offer_name: string | null;
  id: string;
  name: string;
  amount: number;
  status: string;
  refund_requested: boolean;
  created_at: string;
  buyer: string;
  can_chat: boolean;
  message_count: number;
  refunded_amount: number;
  net_income: number;
  cost_amount: number | null;
  profit: number | null;
}
interface StockKey {
  offer_id: string;
  offer_name: string;
  code: string;
  sku: string;
  name: string;
  status: string;
  unit_cost: number | null;
  can_edit_cost: boolean;
}
interface Dashboard {
  seller: Seller;
  offers: Offer[];
  orders: Sale[];
  inventory: StockKey[];
  summary: {
    orders: number;
    paid_orders: number;
    paid: number;
    refunded: number;
    refunds: number;
    net_income: number;
    pending: number;
    known_cost: number;
    unknown_cost_count: number;
    profit: number | null;
    commission: number;
  };
  products_summary: { total: number; lots: number; selling: number; available: number; reserved: number };
  pagination: { page: number; pages: number; total: number };
  accounting_note: string;
}
const data = ref<Dashboard>();
const splitSource = ref<Offer>();
const draftKey = (offer: Offer) => offer.offer_id || offer.sku;
const catalogProducts = computed(() => [
  ...new Map(data.value?.offers.map((o) => [o.sku, o]) ?? []).values(),
]);
const tab = ref<'offers' | 'lots' | 'sales' | 'inventory'>('offers');
const scope = ref('mine');
const search = ref('');
const page = ref(1);
const drafts = reactive<Record<string, { price: number; active: boolean }>>({});
const costs = reactive<Record<string, number | ''>>({});
const visibleOffers = computed(
  () =>
    data.value?.offers.filter(
      (o) =>
        (scope.value === 'catalog' || o.is_mine) &&
        (o.name + ' ' + o.sku + ' ' + o.offer_name).toLowerCase().includes(search.value.toLowerCase()),
    ) ?? [],
);
const error = ref('');
const notice = ref('');
const busy = ref(false);
const selected = ref('');
const stock = ref<{ sku: string; offer_id: string; codes: string; unit_cost: number | '' }>({
  sku: '',
  offer_id: '',
  codes: '',
  unit_cost: '',
});
const keyLabels: Record<string, string> = {
  available: 'Доступен',
  issued: 'Выдан',
  revoked: 'Отозван',
  reserved: 'В резерве заказа',
};
let timer: number | undefined;
let disposed = false;
let loadGeneration = 0;
async function load() {
  const current = ++loadGeneration;
  const fresh = await authApi<Dashboard>(`/api/seller/dashboard?page=${page.value}`);
  if (disposed || current !== loadGeneration) return;
  const previous = new Map(data.value?.offers.map((o) => [draftKey(o), o]) ?? []);
  for (const offer of fresh.offers) {
    const id = draftKey(offer),
      old = previous.get(id),
      draft = drafts[id];
    if (!draft || (old && draft.price === old.price && draft.active === old.active))
      drafts[id] = { price: offer.price, active: offer.active };
  }
  data.value = fresh;
  for (const key of fresh.inventory) if (!(key.code in costs)) costs[key.code] = key.unit_cost ?? '';
  if (!stock.value.sku) stock.value.sku = fresh.offers[0]?.sku ?? '';
}
async function refresh() {
  try {
    await load();
  } catch (caught) {
    error.value = (caught as Error).message;
  }
}
async function save(offer: Offer) {
  busy.value = true;
  notice.value = '';
  error.value = '';
  try {
    await authApi(
      offer.offer_id
        ? `/api/seller/lots/${encodeURIComponent(offer.offer_id)}`
        : `/api/seller/offers/${encodeURIComponent(offer.sku)}`,
      {
        method: 'PUT',
        body: JSON.stringify(drafts[draftKey(offer)]),
      },
    );
    await load();
    notice.value = 'Предложение сохранено.';
  } catch (caught) {
    error.value = (caught as Error).message;
  } finally {
    busy.value = false;
  }
}
async function addStock() {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = await authApi<{ inserted: string[]; duplicates: string[] }>('/api/seller/inventory', {
      method: 'POST',
      body: JSON.stringify({
        sku: stock.value.sku,
        offer_id: stock.value.offer_id || undefined,
        codes: stock.value.codes.split(/[\s,;]+/).filter(Boolean),
        unit_cost: stock.value.unit_cost === '' ? null : stock.value.unit_cost,
      }),
    });
    stock.value.codes = '';
    await load();
    notice.value = `Добавлено: ${result.inserted.length}. Дубликатов: ${result.duplicates.length}.`;
  } catch (caught) {
    error.value = (caught as Error).message;
  } finally {
    busy.value = false;
  }
}
async function saveCost(key: StockKey) {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await authApi(`/api/seller/inventory/${encodeURIComponent(key.code)}/cost`, {
      method: 'PUT',
      body: JSON.stringify({ unit_cost: costs[key.code] === '' ? null : costs[key.code] }),
    });
    await load();
    notice.value = 'Закупочная стоимость сохранена.';
  } catch (caught) {
    error.value = (caught as Error).message;
  } finally {
    busy.value = false;
  }
}
function addProduct() {
  tab.value = 'lots';
  scope.value = 'catalog';
  search.value = '';
}
function openStock(offer: Offer) {
  stock.value.sku = offer.sku;
  stock.value.offer_id = offer.is_default ? '' : offer.offer_id || '';
  tab.value = 'inventory';
}
async function lotsSaved() {
  splitSource.value = undefined;
  notice.value = 'Партии созданы. Количество и цена каждой сохранены.';
  await refresh();
}
async function changePage(next: number) {
  page.value = next;
  await refresh();
}
async function signOut() {
  await logout();
  location.href = '/account?next=/seller/account';
}
onMounted(async () => {
  document.title = 'Кабинет продавца — Game Goods';
  const user = accountUser.value;
  if (!user) {
    location.href = '/account?next=/seller/account';
    return;
  }
  if (!user.can_sell) return;
  await refresh();
  const poll = async () => {
    if (disposed) return;
    await refresh();
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
  <div class="store-bg">
    <div class="storefront site-page">
      <SiteHeader />
      <main class="inner-page seller-dashboard">
        <header class="dashboard-heading">
          <div>
            <span class="eyebrow">КАБИНЕТ ПРОДАВЦА</span>
            <h1>{{ data?.seller.name || 'Кабинет продавца' }}</h1>
            <p>Ваши товары, продажи и доход в одном месте.</p>
          </div>
          <button class="secondary-button" @click="signOut">Выйти</button>
        </header>
        <div v-if="error" class="page-message error" role="alert">{{ error }}</div>
        <div v-if="notice" class="page-message success" role="status">{{ notice }}</div>
        <SellerActivation v-if="accountUser?.can_become_seller" expanded />
        <p v-else-if="accountUser && !accountUser.can_sell" class="inline-error">
          Для продаж используйте обычный аккаунт покупателя.
        </p>
        <template v-if="data">
          <section class="seller-metrics">
            <article>
              <PackageCheck :size="20" /><strong>{{ data.products_summary.selling }}</strong
              ><span
                >Товаров в продаже · {{ data.products_summary.available }} ключей ·
                {{ data.products_summary.reserved }} в резерве</span
              >
            </article>
            <article data-metric="income">
              <Store :size="20" /><strong>{{ money(data.summary.net_income) }}</strong
              ><span>Доход после возвратов</span>
            </article>
            <article data-metric="profit">
              <Wallet :size="20" /><strong>{{
                data.summary.profit === null ? 'Не рассчитана' : money(data.summary.profit)
              }}</strong
              ><span>Прибыль после закупки ключей</span>
            </article>
            <article data-metric="refunds">
              <Undo2 :size="20" /><strong>{{ money(data.summary.refunded) }}</strong
              ><span>Возвращено покупателям · {{ data.summary.refunds }} шт.</span>
            </article>
          </section>
          <div class="seller-profile-strip">
            <span>Рейтинг {{ data.seller.rating ?? '—' }} / 5 · {{ data.seller.review_count }} отзывов</span
            ><a :href="`/seller/${data.seller.id}`">Мой магазин на витрине ↗</a>
          </div>
          <p v-if="data.seller.flag === 'red'" class="seller-warning">
            {{ data.seller.reputation_note }}.
            <a :href="`/seller/${data.seller.id}`">Посмотреть доказательства</a>
          </p>
          <nav class="dashboard-tabs" aria-label="Разделы кабинета продавца">
            <button
              :class="{ active: tab === 'offers' }"
              @click="
                tab = 'offers';
                scope = 'mine';
              "
            >
              Мои товары
            </button>
            <button
              :class="{ active: tab === 'lots' }"
              @click="
                tab = 'lots';
                scope = 'mine';
              "
            >
              Партии и массовые цены
            </button>
            <button :class="{ active: tab === 'sales' }" @click="tab = 'sales'">Продажи и сообщения</button>
            <button :class="{ active: tab === 'inventory' }" @click="tab = 'inventory'">
              Ключи и остатки
            </button>
          </nav>
          <template v-if="tab === 'offers'">
            <SellerKeyPrices
              @saved="refresh"
              @upload="tab = 'inventory'"
              @lots="
                tab = 'lots';
                scope = 'mine';
              "
            />
            <button class="secondary-button" style="margin-top: 16px" @click="addProduct">
              Добавить товар
            </button>
          </template>
          <section v-else-if="tab === 'lots'">
            <div class="seller-products-heading">
              <div>
                <h2>{{ scope === 'mine' ? 'Партии и массовые цены' : 'Каталог для продажи' }}</h2>
                <p>Цена здесь применяется ко всей партии. Для отдельного ключа откройте «Мои товары».</p>
              </div>
              <button class="secondary-button" @click="addProduct">Добавить товар</button>
            </div>
            <div class="seller-product-filters">
              <label
                >Показывать<select v-model="scope">
                  <option value="mine">Мои товары ({{ data.products_summary.total }})</option>
                  <option value="catalog">Весь каталог</option>
                </select></label
              ><label
                >Поиск товара<input v-model="search" type="search" placeholder="Название или артикул"
              /></label>
            </div>
            <div v-if="!visibleOffers.length" class="admin-panel">
              <h3>Товаров пока нет</h3>
              <p>Выберите товар из каталога, установите цену и добавьте ключи.</p>
              <button class="primary-admin-button" @click="addProduct">Выбрать товар</button>
            </div>
            <SellerLotSplit
              v-if="splitSource"
              :key="splitSource.offer_id"
              :source="splitSource"
              @close="splitSource = undefined"
              @saved="lotsSaved"
            />
            <div class="seller-offer-list">
              <form v-for="offer in visibleOffers" :key="draftKey(offer)" @submit.prevent="save(offer)">
                <img :src="offer.image" :alt="offer.name" />
                <div class="seller-product-details">
                  <span class="listing-badge" :class="offer.listing_status">{{ offer.listing_label }}</span>
                  <h3>{{ offer.name }}</h3>
                  <small>{{ offer.sku }}</small>
                  <p class="seller-lot-name">{{ offer.offer_name || 'Основная партия' }}</p>
                  <p>
                    {{ offer.available }} свободных · {{ offer.reserved }} в резерве · Купили
                    {{ offer.sold }} шт.
                  </p>
                  <p>Доход: {{ money(offer.net_income) }} · Возвратов: {{ offer.refunds }}</p>
                  <div class="seller-product-links">
                    <a :href="`/product/${offer.sku}`">Открыть товар ↗</a
                    ><button type="button" @click="openStock(offer)">Добавить ключи</button
                    ><button
                      v-if="offer.offer_id"
                      type="button"
                      :disabled="!offer.available"
                      @click="splitSource = offer"
                    >
                      Разделить на партии
                    </button>
                  </div>
                </div>
                <label
                  >Цена каждого ключа в партии, ₽<input
                    v-model.number="drafts[draftKey(offer)]!.price"
                    type="number"
                    min="1"
                    max="10000000"
                    required
                /></label>
                <label class="checkbox-label"
                  ><input v-model="drafts[draftKey(offer)]!.active" type="checkbox" />Продаётся</label
                >
                <button :disabled="busy" class="primary-admin-button">Сохранить</button>
              </form>
            </div>
          </section>
          <section v-else-if="tab === 'sales'" class="dashboard-sales">
            <div class="admin-panel seller-financial-summary">
              <h2>Результат продаж</h2>
              <dl>
                <div>
                  <dt>Оплачено покупателями</dt>
                  <dd>{{ money(data.summary.paid) }}</dd>
                </div>
                <div>
                  <dt>Ожидает выдачи</dt>
                  <dd>{{ money(data.summary.pending) }}</dd>
                </div>
                <div>
                  <dt>Комиссия площадки</dt>
                  <dd>{{ money(data.summary.commission) }}</dd>
                </div>
                <div>
                  <dt>Учтённая закупка ключей</dt>
                  <dd>{{ money(data.summary.known_cost) }}</dd>
                </div>
              </dl>
              <p>{{ data.accounting_note }}</p>
              <p v-if="data.summary.unknown_cost_count" class="seller-warning">
                У {{ data.summary.unknown_cost_count }} выданных ключей закупочная стоимость не была указана.
                Итоговая прибыль неизвестна. Укажите стоимость на складе до продажи следующих ключей.
              </p>
            </div>
            <div class="admin-panel">
              <div class="panel-heading">
                <h2>Продажи · {{ data.pagination.total }}</h2>
                <button @click="refresh">Обновить</button>
              </div>
              <p v-if="!data.orders.length" class="chat-empty">
                Продажи появятся здесь после первого заказа у вашего магазина.
              </p>
              <div v-else class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Что купили</th>
                      <th>Покупатель</th>
                      <th>Цена продажи</th>
                      <th>Возвращено</th>
                      <th>Мой доход</th>
                      <th>Закупка / прибыль</th>
                      <th>Статус</th>
                      <th>Переписка</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="sale in data.orders" :key="sale.id">
                      <td>
                        <b>{{ sale.name }}</b
                        ><small v-if="sale.offer_name">{{ sale.offer_name }}</small
                        ><small>{{ date(sale.created_at) }}</small
                        ><code>{{ sale.id }}</code>
                      </td>
                      <td>{{ sale.buyer || 'API-заказ' }}</td>
                      <td>{{ money(sale.amount) }}</td>
                      <td>{{ money(sale.refunded_amount) }}</td>
                      <td>
                        <b>{{ money(sale.net_income) }}</b>
                      </td>
                      <td>
                        {{ sale.cost_amount === null ? 'Закупка не указана' : money(sale.cost_amount)
                        }}<small
                          >Прибыль: {{ sale.profit === null ? 'неизвестна' : money(sale.profit) }}</small
                        >
                      </td>
                      <td>{{ statusLabels[sale.refund_requested ? 'refund_pending' : sale.status] }}</td>
                      <td>
                        <button v-if="sale.buyer" class="secondary-button" @click="selected = sale.id">
                          <MessageCircle :size="16" />{{ sale.message_count }} ·
                          {{ sale.can_chat ? 'Открыть' : 'История' }}</button
                        ><span v-else>—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="data.pagination.pages > 1" class="seller-pagination">
                <button class="secondary-button" :disabled="page <= 1" @click="changePage(page - 1)">
                  Назад</button
                ><span>{{ page }} / {{ data.pagination.pages }}</span
                ><button
                  class="secondary-button"
                  :disabled="page >= data.pagination.pages"
                  @click="changePage(page + 1)"
                >
                  Далее
                </button>
              </div>
            </div>
            <OrderChat v-if="selected" :key="selected" :order-id="selected" />
          </section>
          <section v-else class="admin-grid">
            <form class="admin-panel" @submit.prevent="addStock">
              <h2>Пополнить ключи</h2>
              <p>
                После загрузки назначьте цену каждому ключу во вкладке «Мои товары». Для массовых цен
                используйте партии.
              </p>
              <label
                >Товар<select aria-label="Товар" v-model="stock.sku" @change="stock.offer_id = ''">
                  <option v-for="offer in catalogProducts" :key="offer.sku" :value="offer.sku">
                    {{ offer.name }}
                  </option>
                </select></label
              ><label
                >Партия для загрузки<select aria-label="Партия для загрузки" v-model="stock.offer_id">
                  <option value="">Основная партия</option>
                  <option
                    v-for="offer in data.offers.filter(
                      (o) => o.sku === stock.sku && o.offer_id && !o.is_default,
                    )"
                    :key="offer.offer_id"
                    :value="offer.offer_id"
                  >
                    {{ offer.offer_name }} · {{ money(offer.price) }}
                  </option>
                </select></label
              ><label
                >Закупочная цена одного ключа, ₽<input
                  v-model.number="stock.unit_cost"
                  type="number"
                  min="0"
                  max="10000000"
                  placeholder="Не указана"
              /></label>
              <p>
                Необязательно. Нужна для расчёта прибыли; 0 означает бесплатный ключ. Покупатели эту цену не
                видят.
              </p>
              <label
                >Ключи, по одному в строке<textarea
                  v-model="stock.codes"
                  rows="8"
                  required
                  maxlength="100000"
                /></label
              ><button class="primary-admin-button" :disabled="busy">Добавить ключи</button
              ><button
                type="button"
                class="secondary-button"
                @click="
                  tab = 'offers';
                  scope = 'mine';
                "
              >
                Посмотреть мои товары
              </button>
            </form>
            <div class="admin-panel">
              <h2>Последние 500 ключей</h2>
              <p v-if="!data.inventory.length">Добавьте первую партию ключей.</p>
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Ключ / товар</th>
                      <th>Статус</th>
                      <th>Закупка, ₽</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="key in data.inventory" :key="key.code">
                      <td>
                        <code>{{ key.code }}</code
                        ><small>{{ key.name }}</small
                        ><small>{{ key.sku }} · {{ key.offer_name }}</small>
                      </td>
                      <td>{{ keyLabels[key.status] }}</td>
                      <td>
                        <form
                          v-if="key.can_edit_cost"
                          class="inventory-cost-form"
                          @submit.prevent="saveCost(key)"
                        >
                          <input
                            v-model.number="costs[key.code]"
                            :aria-label="`Закупка ${key.code}`"
                            type="number"
                            min="0"
                            max="10000000"
                            placeholder="Не указана"
                          /><button class="secondary-button" :disabled="busy">Сохранить</button>
                        </form>
                        <span v-else>{{ key.unit_cost === null ? 'Не указана' : money(key.unit_cost) }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.dashboard-heading {
  margin: 10px 0 20px;
}
.dashboard-heading h1 {
  font-size: clamp(28px, 3vw, 36px);
  margin: 8px 0;
}
.dashboard-heading p {
  margin: 6px 0;
}
.seller-metrics article {
  padding: 16px;
  gap: 8px;
}
.seller-profile-strip {
  margin: 16px 0;
}
.dashboard-tabs {
  margin: 18px 0;
}
</style>
