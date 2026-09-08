<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Users, ReceiptText, ScrollText, MessageCircle } from '@lucide/vue';
import { authApi } from '../api';
import type { AccountUser, Seller, PaymentIntent, Withdrawal } from '../types';
import { date, money, statusLabels, paymentStatusLabels } from '../format';
import OrderChat from './OrderChat.vue';
interface AdminOrder {
  id: string;
  name: string;
  amount: number;
  status: string;
  payment_state: string;
  refund_requested: boolean;
  created_at: string;
  buyer: string | null;
  seller_name: string;
  message_count: number;
}
interface Audit {
  event_type: string;
  order_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}
const tab = ref<'orders' | 'users' | 'audit' | 'payments' | 'withdrawals'>('orders');
const orders = ref<AdminOrder[]>([]);
const payments = ref<PaymentIntent[]>([]);
const withdrawals = ref<Withdrawal[]>([]);
const users = ref<AccountUser[]>([]);
const sellers = ref<Seller[]>([]);
const events = ref<Audit[]>([]);
const search = ref('');
const error = ref('');
const notice = ref('');
const busy = ref(false);
const selected = ref('');
const action = ref<{ kind: 'refund' | 'user' | 'seller'; id: string; label: string; banned?: boolean }>();
const reason = ref('');
const sellerAccount = ref({ username: '', password: '', provider: 'A' });
let timer: number | undefined;
let disposed = false;
async function load() {
  const user = await authApi<{ user: AccountUser }>('/api/account');
  if (user.user.role !== 'admin') return;
  const [o, u, s, a, p, w] = await Promise.all([
    authApi<{ orders: AdminOrder[] }>('/api/admin/orders'),
    authApi<{ users: AccountUser[] }>('/api/admin/users'),
    authApi<{ sellers: Seller[] }>('/api/sellers'),
    authApi<{ events: Audit[] }>('/api/admin/audit'),
    authApi<{ payments: PaymentIntent[] }>('/api/admin/payments'),
    authApi<{ withdrawals: Withdrawal[] }>('/api/admin/withdrawals'),
  ]);
  withdrawals.value = w.withdrawals;
  payments.value = p.payments;
  orders.value = o.orders;
  users.value = u.users;
  sellers.value = s.sellers;
  events.value = a.events;
}
function start(kind: 'refund' | 'user' | 'seller', id: string, label: string, banned?: boolean) {
  action.value = { kind, id, label, banned };
  reason.value = '';
  error.value = '';
  notice.value = '';
}
async function submit() {
  if (!action.value) return;
  busy.value = true;
  error.value = '';
  const a = action.value;
  try {
    const path =
      a.kind === 'refund'
        ? `/api/admin/orders/${encodeURIComponent(a.id)}/refund`
        : a.kind === 'user'
          ? `/api/admin/users/${encodeURIComponent(a.id)}/ban`
          : `/api/admin/sellers/${encodeURIComponent(a.id)}/ban`;
    await authApi(path, {
      method: 'POST',
      body: JSON.stringify(
        a.kind === 'refund' ? { reason: reason.value } : { banned: a.banned, reason: reason.value },
      ),
    });
    notice.value =
      a.kind === 'refund'
        ? 'Возврат принят. Статус обновится после подтверждения отмены или отзыва ключа.'
        : 'Решение сохранено в журнале.';
    action.value = undefined;
    await load();
  } catch (caught) {
    error.value = (caught as Error).message;
  } finally {
    busy.value = false;
  }
}
async function createAccount() {
  busy.value = true;
  error.value = '';
  try {
    await authApi('/api/admin/seller-accounts', {
      method: 'POST',
      body: JSON.stringify(sellerAccount.value),
    });
    sellerAccount.value = { username: '', password: '', provider: 'A' };
    notice.value = 'Аккаунт продавца создан.';
    await load();
  } catch (caught) {
    error.value = (caught as Error).message;
  } finally {
    busy.value = false;
  }
}
function matches(order: AdminOrder) {
  return `${order.id} ${order.name} ${order.buyer ?? ''} ${order.seller_name ?? ''}`
    .toLowerCase()
    .includes(search.value.toLowerCase());
}
onMounted(async () => {
  try {
    await load();
  } catch (caught) {
    error.value = (caught as Error).message;
  }
  const poll = async () => {
    if (disposed) return;
    try {
      await load();
    } catch {
      error.value = 'Не удалось обновить данные.';
    }
    if (!disposed) timer = window.setTimeout(poll, 6000);
  };
  timer = window.setTimeout(poll, 6000);
});
onBeforeUnmount(() => {
  disposed = true;
  window.clearTimeout(timer);
});
</script>
<template>
  <header class="admin-heading">
    <div>
      <span>ADMIN / OPERATIONS</span>
      <h1>Заказы и модерация</h1>
      <p>Решения с причиной, подтверждённые возвраты и помощь покупателям.</p>
    </div>
    <button @click="load">Обновить</button>
  </header>
  <div v-if="error" class="page-message error" role="alert">{{ error }}</div>
  <div v-if="notice" class="page-message success" role="status">{{ notice }}</div>
  <nav class="dashboard-tabs">
    <button :class="{ active: tab === 'orders' }" @click="tab = 'orders'">
      <ReceiptText :size="17" />Заказы</button
    ><button :class="{ active: tab === 'users' }" @click="tab = 'users'">
      <Users :size="17" />Пользователи и баны</button
    ><button :class="{ active: tab === 'audit' }" @click="tab = 'audit'">
      <ScrollText :size="17" />Журнал действий
    </button>
    <button :class="{ active: tab === 'payments' }" @click="tab = 'payments'">Платежи</button>
    <button :class="{ active: tab === 'withdrawals' }" @click="tab = 'withdrawals'">Выводы</button>
  </nav>
  <form v-if="action" class="admin-panel moderation-action" @submit.prevent="submit">
    <h2>
      {{
        action.kind === 'refund' ? 'Возврат по покупке' : action.banned ? 'Блокировка' : 'Снятие блокировки'
      }}
    </h2>
    <p>{{ action.label }}</p>
    <label
      >Причина решения<textarea
        v-model="reason"
        minlength="3"
        maxlength="1000"
        rows="3"
        required
        placeholder="Укажите результаты проверки и основание решения"
      />
    </label>
    <div class="form-actions">
      <button class="primary-admin-button" :disabled="busy">Подтвердить решение</button
      ><button type="button" class="secondary-button" @click="action = undefined">Отмена</button>
    </div>
  </form>
  <template v-if="tab === 'orders'"
    ><section class="admin-panel">
      <div class="panel-heading">
        <h2>Последние 300 покупок</h2>
        <input v-model="search" type="search" placeholder="ID, товар, покупатель" aria-label="Найти заказ" />
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Покупка</th>
              <th>Участники</th>
              <th>Стоимость</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders.filter(matches)" :key="order.id">
              <td>
                <b>{{ order.name }}</b
                ><code>{{ order.id }}</code
                ><small>{{ date(order.created_at) }}</small>
              </td>
              <td>
                {{ order.buyer || 'API-заказ' }}<small>{{ order.seller_name || 'Не назначен' }}</small>
              </td>
              <td>{{ money(order.amount) }}</td>
              <td>
                <span :class="{ 'seller-warning-text': order.status === 'refunded' }">{{
                  statusLabels[order.refund_requested ? 'refund_pending' : order.status]
                }}</span>
              </td>
              <td>
                <div class="table-actions">
                  <button v-if="order.buyer" class="secondary-button" @click="selected = order.id">
                    <MessageCircle :size="15" />{{ order.message_count }} · Переписка</button
                  ><button
                    v-if="
                      order.payment_state === 'paid' && order.status !== 'refunded' && !order.refund_requested
                    "
                    class="danger-button"
                    @click="start('refund', order.id, order.name + ' · ' + money(order.amount))"
                  >
                    Вернуть средства
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!orders.length" class="chat-empty">Покупок пока нет.</p>
    </section>
    <OrderChat v-if="selected" :key="selected" :order-id="selected" /></template
  ><template v-if="tab === 'users'"
    ><section class="admin-panel">
      <h2>Пользователи</h2>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Аккаунт</th>
              <th>Роль</th>
              <th>Баланс</th>
              <th>Статус</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>
                <b>{{ user.username }}</b
                ><small>{{ user.id }}</small>
              </td>
              <td>{{ { buyer: 'Покупатель', seller: 'Продавец', admin: 'Администратор' }[user.role] }}</td>
              <td>{{ money(user.points_balance) }}</td>
              <td>
                {{ user.banned_at ? 'Заблокирован' : 'Активен' }}<small>{{ user.ban_reason }}</small>
              </td>
              <td>
                <button
                  v-if="user.role !== 'admin'"
                  class="secondary-button"
                  @click="start('user', user.id, user.username, !user.banned_at)"
                >
                  {{ user.banned_at ? 'Разблокировать' : 'Заблокировать' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="admin-panel">
      <h2>Продавцы</h2>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Продавец</th>
              <th>Репутация</th>
              <th>Нарушения</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="seller in sellers" :key="seller.id">
              <td>
                <a :href="`/seller/${seller.id}`">{{ seller.name }}</a
                ><small>{{ seller.ban_reason }}</small>
              </td>
              <td>{{ seller.flag === 'red' ? '⚑ Красный флаг' : 'Без подтверждённых нарушений' }}</td>
              <td>{{ seller.confirmed_incidents }}</td>
              <td>
                <button
                  class="secondary-button"
                  @click="start('seller', seller.id, seller.name, !seller.banned_at)"
                >
                  {{ seller.banned_at ? 'Разблокировать' : 'Заблокировать' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <form class="admin-panel" @submit.prevent="createAccount">
      <h2>Доступ в кабинет продавца</h2>
      <p>Создайте аккаунт для существующего продавца.</p>
      <div class="admin-form-row">
        <label
          >Продавец<select v-model="sellerAccount.provider">
            <option v-for="seller in sellers.filter((s) => !s.banned_at)" :key="seller.id" :value="seller.id">
              {{ seller.name }}
            </option>
          </select></label
        ><label
          >Логин<input
            v-model="sellerAccount.username"
            minlength="3"
            maxlength="32"
            required
            autocomplete="off" /></label
        ><label
          >Пароль<input
            v-model="sellerAccount.password"
            minlength="10"
            maxlength="128"
            type="password"
            required
            autocomplete="new-password"
        /></label>
      </div>
      <button class="primary-admin-button" :disabled="busy">Создать аккаунт</button>
    </form></template
  >
  <section v-if="tab === 'withdrawals'" class="admin-panel">
    <h2>Тестовые выводы с баланса</h2>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Заявка</th>
            <th>Пользователь</th>
            <th>Куда</th>
            <th>Сумма</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in withdrawals" :key="w.id">
            <td>
              <code>{{ w.id }}</code
              ><small>{{ date(w.created_at) }}</small>
            </td>
            <td>{{ w.username }}</td>
            <td>
              {{ w.method === 'card' ? 'Карта' : 'USDT' }}<small>{{ w.recipient.display }}</small>
            </td>
            <td>{{ money(w.amount) }}</td>
            <td>
              {{
                {
                  pending: 'В резерве',
                  paid: 'Переведено',
                  failed: 'Отказ, резерв возвращён',
                  cancelled: 'Отменено, резерв возвращён',
                  expired: 'Истёк срок, резерв возвращён',
                }[w.status]
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!withdrawals.length">Выводов пока нет.</p>
  </section>
  <section v-if="tab === 'payments'" class="admin-panel">
    <h2>Тестовые платежи · СБП и крипта</h2>
    <p>Возвраты по покупкам оформляются во вкладке «Заказы».</p>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Платёж</th>
            <th>Покупатель</th>
            <th>Метод</th>
            <th>Сумма</th>
            <th>Статус</th>
            <th>Возвращено</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in payments" :key="p.id">
            <td>
              <code>{{ p.id }}</code
              ><small>{{ p.purpose === 'wallet_topup' ? 'Пополнение баланса' : 'Оплата заказа' }}</small
              ><small>{{ date(p.created_at) }}</small>
            </td>
            <td>{{ p.username }}</td>
            <td>{{ p.method === 'sbp' ? 'СБП' : 'USDT' }}</td>
            <td>{{ money(p.amount) }}</td>
            <td>{{ paymentStatusLabels[p.status] }}</td>
            <td>{{ money(p.refunded_amount) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!payments.length">Платежей пока нет.</p>
  </section>
  <section v-if="tab === 'audit'" class="admin-panel">
    <h2>Последние 200 событий</h2>
    <div class="audit-list">
      <details v-for="(event, index) in events" :key="index">
        <summary>
          <time>{{ date(event.created_at) }}</time
          ><b>{{ event.event_type }}</b
          ><code>{{ event.order_id }}</code>
        </summary>
        <pre>{{ JSON.stringify(event.payload, null, 2) }}</pre>
      </details>
    </div>
  </section>
</template>
