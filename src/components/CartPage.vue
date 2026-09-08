<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ArrowRight, ShoppingBag, ShieldCheck, Trash2, Minus, Plus } from '@lucide/vue';
import { accountUser, authReady, refreshAccount, refreshCartCount } from '../auth';
import { api, authApi, ApiError } from '../api';
import type { Cart, CartQuote, Purchase, CheckoutResult, OrderGroup, PaymentMethod } from '../types';
import { points, typeLabels } from '../format';
import PurchaseModal from './PurchaseModal.vue';
import OrderProgress from './OrderProgress.vue';
import SiteHeader from './SiteHeader.vue';
const method = ref<'balance' | 'sbp' | 'crypto'>('balance');
const methods = ref<PaymentMethod[]>([]);
const search = ref(''),
  paymentCode = ref(''),
  error = ref('');
const cart = ref<Cart>({ items: [], item_count: 0, total_points: 0 });
const busy = ref(false),
  quoteBusy = ref(false),
  loading = ref(true);
const quote = ref<CartQuote>();
const order = ref<OrderGroup>();
const selected = ref<Purchase>();
const pendingCheckout = ref(false);
let quoteTimer: number | undefined, pollTimer: number | undefined;
let quoteVersion = 0,
  disposed = false;
const checkoutErrors: Record<string, string> = {
  cart_offer_unavailable:
    'Партия отключена, свободных ключей недостаточно или магазин заблокирован. Проверьте количество и выберите доступное предложение.',
  payment_code_not_found: 'Платёжный код не найден. Проверьте ввод.',
  payment_code_already_used: 'Этот код уже использован.',
  insufficient_points:
    'На балансе недостаточно средств. Пополните его в личном кабинете или выберите СБП / криптовалюту.',
  cart_is_empty: 'Корзина пуста.',
  lot_insufficient_stock:
    'Ключи этой партии уже заняты другим заказом. Обновите корзину и выберите доступную партию.',
  checkout_id_payload_conflict: 'Параметры покупки изменились. Обновите страницу, чтобы восстановить заказ.',
};
const canCheckout = computed(() => Boolean(quote.value?.can_checkout && !busy.value && !quoteBusy.value));
const pendingKey = () => `game_goods_pending_checkout:${accountUser.value?.id}`;
async function loadQuote() {
  const current = ++quoteVersion;
  quoteBusy.value = true;
  quote.value = undefined;
  try {
    const result = await authApi<CartQuote>('/api/cart/quote', {
      method: 'POST',
      body: JSON.stringify({
        method: method.value,
        code: method.value === 'balance' ? paymentCode.value.trim() || undefined : undefined,
      }),
    });
    if (current === quoteVersion) quote.value = result;
  } catch (caught) {
    if (current === quoteVersion)
      error.value =
        checkoutErrors[(caught as Error).message] ?? 'Не удалось рассчитать заказ. Попробуйте снова.';
  } finally {
    if (current === quoteVersion) quoteBusy.value = false;
  }
}
async function loadCart() {
  cart.value = await authApi<Cart>('/api/cart');
  await loadQuote();
}
async function changeItem(sku: string, quantity: number, provider: string, offerId: string) {
  if (busy.value || pendingCheckout.value) return;
  busy.value = true;
  error.value = '';
  try {
    cart.value = await authApi<Cart>(
      `/api/cart/items/${encodeURIComponent(sku)}?provider=${encodeURIComponent(provider)}&offer_id=${encodeURIComponent(offerId)}`,
      {
        method: quantity === 0 ? 'DELETE' : 'PUT',
        ...(quantity ? { body: JSON.stringify({ quantity }) } : {}),
      },
    );
    await Promise.all([refreshCartCount(), loadQuote()]);
  } catch {
    error.value = 'Не удалось обновить корзину. Попробуйте снова.';
  } finally {
    busy.value = false;
  }
}
async function pollOrder() {
  if (disposed || !order.value) return;
  try {
    order.value = await authApi<OrderGroup>(`/api/account/orders/${encodeURIComponent(order.value.id)}`);
    if (order.value.terminal) {
      await refreshAccount();
      if (order.value.status === 'refunded') return;
    }
  } catch {
    error.value = 'Не удалось обновить статус. Заказ сохранён, пробуем снова.';
  }
  if (!disposed) pollTimer = window.setTimeout(pollOrder, order.value?.terminal ? 5000 : 1500);
}
async function checkout() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  const saved = sessionStorage.getItem(pendingKey());
  const body =
    saved ||
    JSON.stringify({
      checkout_id: `chk_${crypto.randomUUID().replaceAll('-', '')}`,
      method: method.value,
      code: method.value === 'balance' ? paymentCode.value.trim() || undefined : undefined,
    });
  sessionStorage.setItem(pendingKey(), body);
  pendingCheckout.value = true;
  try {
    const result = await authApi<CheckoutResult>('/api/cart/checkout', { method: 'POST', body });
    order.value = result.order;
    history.replaceState(null, '', `/cart?order=${encodeURIComponent(result.order_id)}`);
    sessionStorage.removeItem(pendingKey());
    pendingCheckout.value = false;
    await Promise.all([refreshAccount(), refreshCartCount()]);
    await pollOrder();
  } catch (caught) {
    if (caught instanceof ApiError && caught.status < 500) {
      sessionStorage.removeItem(pendingKey());
      pendingCheckout.value = false;
    }
    error.value =
      checkoutErrors[(caught as Error).message] ??
      'Ответ не получен. Нажмите «Проверить покупку»: повтор не спишет баллы дважды.';
  } finally {
    busy.value = false;
  }
}
async function openPurchase(id: string) {
  try {
    selected.value = await authApi<Purchase>(`/api/account/purchases/${encodeURIComponent(id)}`);
  } catch {
    error.value = 'Не удалось открыть покупку.';
  }
}
watch([paymentCode, method], () => {
  quoteVersion++;
  quote.value = undefined;
  quoteBusy.value = true;
  window.clearTimeout(quoteTimer);
  quoteTimer = window.setTimeout(loadQuote, 300);
});
onMounted(async () => {
  document.title = 'Корзина — Game Goods';
  try {
    if (!authReady.value) await refreshAccount();
    methods.value = (await api<{ methods: PaymentMethod[] }>('/api/payment-methods')).methods;
    if (accountUser.value?.can_buy) {
      const savedOrder = new URLSearchParams(location.search).get('order');
      if (savedOrder) {
        order.value = await authApi<OrderGroup>(`/api/account/orders/${encodeURIComponent(savedOrder)}`);
        await pollOrder();
      } else if (sessionStorage.getItem(pendingKey())) await checkout();
      if (!order.value) await loadCart();
    }
  } catch {
    error.value = 'Не удалось загрузить корзину. Обновите страницу.';
  } finally {
    loading.value = false;
  }
});
onBeforeUnmount(() => {
  disposed = true;
  quoteVersion++;
  window.clearTimeout(quoteTimer);
  window.clearTimeout(pollTimer);
});
</script>
<template>
  <div class="store-bg">
    <div class="storefront site-page">
      <SiteHeader v-model="search" />
      <main class="inner-page">
        <nav class="breadcrumbs"><a href="/">Главная</a><span>/</span><span>Корзина</span></nav>
        <div class="page-title-row">
          <div>
            <span class="section-kicker">ДО НОВЫХ ВПЕЧАТЛЕНИЙ ОДИН ШАГ</span>
            <h1>{{ order ? 'Твой заказ' : 'Корзина' }}<span class="accent-dot">.</span></h1>
            <p>
              {{
                order
                  ? 'Статус обновляется автоматически. Все покупки сохранятся в кабинете.'
                  : 'Всё, что ты выбрал, — в одном заказе.'
              }}
            </p>
          </div>
          <ShoppingBag :size="40" />
        </div>
        <div v-if="error" class="inline-error" role="alert">{{ error }}</div>
        <div v-if="loading" class="catalog-empty">Загружаем корзину…</div>
        <section v-else-if="!accountUser" class="auth-required">
          <ShoppingBag :size="40" />
          <h2>Твоя корзина ждёт тебя</h2>
          <p>Войди в аккаунт, чтобы продолжить покупки.</p>
          <a href="/account?next=/cart">Войти или зарегистрироваться<ArrowRight :size="18" /></a>
        </section>
        <section v-else-if="!accountUser.can_buy" class="auth-required">
          <h2>Покупки в аккаунте покупателя</h2>
          <p>Сейчас вы вошли как администратор. Для покупок используйте отдельный аккаунт покупателя.</p>
          <a href="/account">Управление аккаунтом</a>
        </section>
        <template v-else-if="order"
          ><OrderProgress :order="order" @open="openPurchase" /><a class="back-purchases" href="/account"
            >Все мои покупки <ArrowRight :size="17" /></a
        ></template>
        <div v-else class="cart-layout">
          <section class="cart-items-panel">
            <div v-if="!cart.items.length" class="empty-cart">
              <ShoppingBag :size="40" />
              <h2>Здесь скоро будет что-то классное</h2>
              <p>Игры, подписки и пополнения ждут тебя в каталоге.</p>
              <a href="/">Перейти в каталог<ArrowRight :size="18" /></a>
            </div>
            <article v-for="item in cart.items" :key="item.offer_id" class="cart-line">
              <a :href="`/product/${item.sku}`" class="cart-thumb"
                ><img :src="item.image" :alt="item.name"
              /></a>
              <div class="cart-product">
                <span v-if="item.demo_notice" class="demo-scenario-notice">{{ item.demo_notice }}</span>
                <span>{{ typeLabels[item.type] }} · {{ item.offer_name }}</span
                ><a :href="`/product/${item.sku}`">{{ item.name }}</a
                ><span v-if="!item.purchasable" class="seller-warning-text">Предложение недоступно</span
                ><a class="cart-seller" :href="`/seller/${item.provider}`"
                  >{{ item.seller_name
                  }}<span v-if="item.seller_flag === 'red'" class="red-flag"> · Есть нарушения</span></a
                >
              </div>
              <div class="quantity-control">
                <button
                  :disabled="busy || pendingCheckout"
                  aria-label="Уменьшить количество"
                  @click="changeItem(item.sku, item.quantity - 1, item.provider, item.offer_id)"
                >
                  <Minus :size="13" /></button
                ><b>{{ item.quantity }}</b
                ><button
                  :disabled="
                    busy || pendingCheckout || item.quantity >= 10 || item.quantity >= item.available
                  "
                  aria-label="Увеличить количество"
                  @click="changeItem(item.sku, item.quantity + 1, item.provider, item.offer_id)"
                >
                  <Plus :size="13" />
                </button>
              </div>
              <strong>{{ points(item.line_total) }}</strong
              ><button
                class="remove-line"
                :disabled="busy || pendingCheckout"
                :aria-label="`Удалить ${item.name}`"
                @click="changeItem(item.sku, 0, item.provider, item.offer_id)"
              >
                <Trash2 :size="17" />
              </button>
            </article>
          </section>
          <aside class="checkout-panel">
            <div class="balance-line">
              <span>Твой баланс</span><strong>{{ points(accountUser.points_balance) }}</strong>
            </div>
            <h2>Как оплатим?</h2>
            <fieldset class="payment-methods">
              <legend class="sr-only">Способ оплаты</legend>
              <label v-for="m in methods" :key="m.id" :class="{ active: method === m.id }"
                ><input
                  v-model="method"
                  type="radio"
                  :value="m.id"
                  name="payment-method"
                  :disabled="busy || pendingCheckout"
                /><span
                  ><strong>{{ m.name }}</strong
                  ><small>{{ m.description }}</small></span
                ></label
              >
            </fieldset>
            <label v-if="method === 'balance'" class="payment-code-field"
              >Платёжный код<input
                v-model="paymentCode"
                :disabled="busy || pendingCheckout"
                placeholder="Если есть — введи сюда"
                autocomplete="off"
                spellcheck="false"
              /><small>Код покроет часть покупки. Остаток спишется с баланса.</small></label
            >
            <p v-if="quote?.error" class="code-quote-status invalid">
              {{ checkoutErrors[quote.error] || quote.error }}
            </p>
            <p v-else-if="quote?.code_status === 'valid'" class="code-quote-status valid">
              Код принят · {{ points(quote.code_value_points) }}
            </p>
            <dl v-if="quote">
              <div>
                <dt>Товары · {{ quote.item_count }}</dt>
                <dd>{{ points(quote.total_points) }}</dd>
              </div>
              <div v-if="quote.code_applied_points">
                <dt>Оплата кодом</dt>
                <dd>−{{ points(quote.code_applied_points) }}</dd>
              </div>
              <div v-if="quote.external_to_pay" class="checkout-total-row">
                <dt>К оплате {{ method === 'sbp' ? 'через СБП' : 'криптовалютой' }}</dt>
                <dd>{{ points(quote.external_to_pay) }}</dd>
              </div>
              <div v-if="method === 'balance'" class="checkout-total-row">
                <dt>С баланса</dt>
                <dd>{{ points(quote.points_to_charge) }}</dd>
              </div>
              <div>
                <dt>Баланс после покупки</dt>
                <dd :class="{ 'negative-balance': quote.balance_after < 0 }">
                  {{ points(quote.balance_after) }}
                </dd>
              </div>
            </dl>
            <p v-else class="checkout-note">Рассчитываем стоимость…</p>
            <button
              class="checkout-button"
              :disabled="pendingCheckout ? busy : !canCheckout"
              @click="checkout"
            >
              {{
                busy
                  ? 'Оформляем…'
                  : pendingCheckout
                    ? 'Проверить покупку'
                    : quoteBusy
                      ? 'Рассчитываем…'
                      : method === 'balance'
                        ? 'Подтвердить покупку'
                        : 'Перейти к оплате'
              }}<ArrowRight :size="17" />
            </button>
            <p class="checkout-note">
              <ShieldCheck :size="16" />Если товар не выдастся, его стоимость автоматически вернётся на баланс
              личного кабинета.
            </p>
          </aside>
        </div>
      </main>
      <PurchaseModal
        v-if="selected"
        :purchase="selected"
        @close="selected = undefined"
        @refresh="openPurchase(selected!.id)"
      />
    </div>
  </div>
</template>
