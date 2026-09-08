<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { authApi } from '../api';
import { money } from '../format';

interface Key {
  code: string;
  sku: string;
  name: string;
  image: string;
  price: number;
  active: boolean;
  can_edit_price: boolean;
  listing_label: string;
}
interface Result {
  items: Key[];
  pagination: { page: number; pages: number; total: number };
}
const emit = defineEmits<{ saved: []; upload: []; lots: [] }>();
const data = ref<Result>();
const page = ref(1),
  search = ref(''),
  status = ref('all');
const drafts = reactive<Record<string, { price: number; active: boolean; dirty: boolean }>>({});
const saving = ref(''),
  error = ref(''),
  notice = ref('');
let timer: number | undefined,
  disposed = false,
  generation = 0;
const messages: Record<string, string> = {
  inventory_price_locked: 'Ключ уже зарезервирован, продан или отозван. Его цену менять нельзя.',
  inventory_offer_changed: 'Ключ перемещён в другую партию. Данные обновлены, сохраните цену ещё раз.',
  inventory_key_not_found: 'Ключ не найден в вашем магазине.',
};
async function load() {
  const current = ++generation;
  try {
    const query = new URLSearchParams({
      page: String(page.value),
      search: search.value,
      status: status.value,
    });
    const fresh = await authApi<Result>(`/api/seller/inventory?${query}`);
    if (disposed || current !== generation) return;
    data.value = fresh;
    for (const key of fresh.items) {
      if (!drafts[key.code]?.dirty || !key.can_edit_price)
        drafts[key.code] = { price: key.price, active: key.active, dirty: false };
    }
  } catch (caught) {
    if (!disposed && current === generation) error.value = (caught as Error).message;
  }
}
async function filter() {
  page.value = 1;
  await load();
}
async function changePage(next: number) {
  page.value = next;
  await load();
}
async function save(key: Key) {
  saving.value = key.code;
  error.value = '';
  notice.value = '';
  const draft = drafts[key.code]!;
  try {
    await authApi(`/api/seller/inventory/${encodeURIComponent(key.code)}/price`, {
      method: 'PUT',
      body: JSON.stringify({ price: draft.price, active: draft.active }),
    });
    draft.dirty = false;
    await load();
    emit('saved');
    notice.value = `Цена ключа ${key.code} сохранена: ${money(draft.price)}. ${draft.active ? 'Продажа включена.' : 'Продажа выключена.'}`;
  } catch (caught) {
    const message = (caught as Error).message;
    error.value = messages[message] ?? message;
    await load();
  } finally {
    saving.value = '';
  }
}
onMounted(async () => {
  await load();
  const poll = async () => {
    await load();
    if (!disposed) timer = window.setTimeout(poll, 5000);
  };
  if (!disposed) timer = window.setTimeout(poll, 5000);
});
onBeforeUnmount(() => {
  disposed = true;
  window.clearTimeout(timer);
});
</script>

<template>
  <section class="seller-key-prices">
    <div class="seller-products-heading">
      <div>
        <h2>Мои товары · {{ data?.pagination.total ?? 0 }} ключей</h2>
        <p>У каждого ключа своя цена продажи. Меняйте её прямо в строке нужного ключа.</p>
      </div>
      <button class="primary-admin-button" @click="emit('upload')">Добавить ключи</button>
    </div>
    <div v-if="error" class="page-message error" role="alert">{{ error }}</div>
    <div v-if="notice" class="page-message success" role="status">{{ notice }}</div>
    <form class="key-price-filters" @submit.prevent="filter">
      <label
        >Найти ключ или товар<input
          v-model="search"
          type="search"
          maxlength="100"
          placeholder="Ключ, название или артикул"
      /></label>
      <label
        >Статус<select v-model="status" @change="filter">
          <option value="all">Все ключи</option>
          <option value="available">Свободные</option>
          <option value="reserved">В резерве</option>
          <option value="issued">Проданные</option>
          <option value="revoked">Отозванные</option>
        </select></label
      >
      <button class="secondary-button">Найти</button>
    </form>
    <div v-if="data && !data.items.length" class="admin-panel">
      <h3>Ключей не найдено</h3>
      <p>Добавьте ключи или измените условия поиска.</p>
    </div>
    <div class="key-price-list">
      <form
        v-for="key in data?.items"
        :key="key.code"
        :data-key="key.code"
        class="key-price-card"
        @submit.prevent="save(key)"
      >
        <img :src="key.image" :alt="key.name" />
        <div class="key-price-details">
          <span class="eyebrow">{{ key.listing_label }}</span>
          <h3>{{ key.name }}</h3>
          <small>{{ key.sku }}</small> <code>{{ key.code }}</code
          ><a :href="`/product/${key.sku}`">Открыть товар ↗</a>
        </div>
        <template v-if="key.can_edit_price">
          <label
            >Цена этого ключа, ₽<input
              v-model.number="drafts[key.code]!.price"
              :aria-label="`Цена продажи ${key.code}`"
              type="number"
              min="1"
              max="10000000"
              step="1"
              required
              :disabled="saving === key.code"
              @input="drafts[key.code]!.dirty = true"
          /></label>
          <label class="checkbox-label"
            ><input
              v-model="drafts[key.code]!.active"
              type="checkbox"
              :aria-label="`Продавать ${key.code}`"
              :disabled="saving === key.code"
              @change="drafts[key.code]!.dirty = true"
            />Продавать</label
          >
          <button class="primary-admin-button" :disabled="!!saving">
            {{ saving === key.code ? 'Сохранение…' : 'Сохранить цену' }}
          </button>
        </template>
        <div v-else class="key-price-locked">
          <p>Изменение цены недоступно</p>
          <small>Цена покупки и доход зафиксированы в разделе «Продажи и сообщения».</small>
        </div>
      </form>
    </div>
    <div v-if="data && data.pagination.pages > 1" class="seller-pagination">
      <button class="secondary-button" :disabled="page <= 1" @click="changePage(page - 1)">Назад</button>
      <span>{{ page }} / {{ data.pagination.pages }} · {{ data.pagination.total }} ключей</span>
      <button
        class="secondary-button"
        :disabled="page >= data.pagination.pages"
        @click="changePage(page + 1)"
      >
        Далее
      </button>
    </div>
    <div class="key-price-bulk">
      <div>
        <strong>Много ключей по разным ценам?</strong>
        <p>Распределите склад по количеству: например, 200 ключей по одной цене и 400 по другой.</p>
      </div>
      <button class="secondary-button" @click="emit('lots')">Управлять партиями</button>
    </div>
  </section>
</template>

<style scoped>
.seller-products-heading {
  flex-wrap: nowrap;
  margin: 16px 0;
}
.seller-products-heading > button {
  width: auto;
  flex-shrink: 0;
}
.key-price-filters input,
.key-price-filters select,
.key-price-card input[type='number'] {
  padding: 11px;
  min-width: 0;
  border-color: #3b4c3f;
  background: #111a14;
  color: #edf5ef;
}
.key-price-card input[type='checkbox'] {
  width: 17px;
  height: 17px;
  accent-color: #b9ee6e;
}
.key-price-filters {
  display: flex;
  align-items: end;
  gap: 16px;
  margin: 24px 0;
}
.key-price-filters label:first-child {
  flex: 1;
}
.key-price-filters label,
.key-price-card > label {
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: #bcc8c2;
}
.key-price-list {
  display: grid;
  gap: 14px;
}
.key-price-card {
  display: grid;
  grid-template-columns: 72px minmax(160px, 1fr) 165px 105px auto;
  align-items: center;
  gap: 20px;
  border: 1px solid #32413b;
  border-radius: 16px;
  padding: 22px;
  background: #15231e;
}
.key-price-card > img {
  width: 72px;
  height: 88px;
  object-fit: cover;
  border-radius: 8px;
}
.key-price-details {
  min-width: 0;
}
.key-price-details h3 {
  margin: 7px 0;
  font-size: 16px;
}
.key-price-details small {
  color: #a0b0a8;
}
.key-price-details code {
  display: block;
  overflow-wrap: anywhere;
  margin: 12px 0;
  color: #def0e4;
}
.key-price-details a {
  font-size: 12px;
  color: #c2ee78;
}
.key-price-card > label.checkbox-label {
  display: flex;
  align-items: center;
}
.key-price-card input[type='number'] {
  width: 100%;
  font-size: 20px;
  font-weight: 700;
}
.key-price-locked {
  grid-column: 3 / -1;
  color: #a0b0a8;
}
.key-price-bulk {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px;
  margin-top: 24px;
  border: 1px solid #32413b;
  border-radius: 14px;
}
.key-price-bulk p {
  color: #a0b0a8;
  font-size: 13px;
  margin-bottom: 0;
}
@media (max-width: 1100px) {
  .key-price-card {
    grid-template-columns: 60px minmax(120px, 1fr) 150px;
    gap: 16px;
  }
  .key-price-card > img {
    width: 60px;
    height: 76px;
  }
  .key-price-card > .checkbox-label {
    grid-column: 2;
  }
  .key-price-locked {
    grid-column: 2 / -1;
  }
}
@media (max-width: 600px) {
  .seller-products-heading {
    align-items: stretch;
    flex-direction: column;
  }
  .key-price-card {
    grid-template-columns: 48px minmax(0, 1fr);
    padding: 16px;
    gap: 14px;
  }
  .key-price-card > img {
    width: 48px;
    height: 64px;
  }
  .key-price-card > label:not(.checkbox-label) {
    grid-column: 1 / -1;
  }
  .key-price-card > .checkbox-label {
    grid-column: 1 / -1;
  }
  .key-price-card > button,
  .key-price-locked {
    grid-column: 1 / -1;
  }
  .key-price-filters,
  .key-price-bulk {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
