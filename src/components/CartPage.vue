<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { accountUser, authReady, refreshAccount, refreshCartCount } from '../auth';
import { authApi } from '../api';
import type { Cart, CartQuote, Purchase } from '../types';
import PurchaseModal from './PurchaseModal.vue';
import SiteHeader from './SiteHeader.vue';

const search = ref('');
const cart = ref<Cart>({ items: [], item_count: 0, total_points: 0 });
const paymentCode = ref('');
const busy = ref(false);
const error = ref('');
const checkoutResult = ref<{ order_ids: string[]; total_points: number; balance_after: number }>();
const purchased = ref<Purchase[]>([]);
const popupIndex = ref(0);
const quote = ref<CartQuote>();
const quoteBusy = ref(false);
let quoteTimer: number | undefined;
const usesPaymentCode = computed(() => Boolean(paymentCode.value.trim()));
const normalizedPaymentCode = computed(() => paymentCode.value.trim().toUpperCase());
const quoteMatchesInput = computed(() => Boolean(quote.value && quote.value.code === normalizedPaymentCode.value));
const validCodeQuote = computed(() => quoteMatchesInput.value && quote.value?.code_status === 'valid');
const pointsToCharge = computed(() => validCodeQuote.value ? quote.value!.points_to_charge : cart.value.total_points);
const balanceAfterPreview = computed(() => accountUser.value
  ? accountUser.value.points_balance - pointsToCharge.value
  : 0);
const canCheckout = computed(() => {
  if (!cart.value.items.length || busy.value || quoteBusy.value) return false;
  if (!usesPaymentCode.value) return balanceAfterPreview.value >= 0;
  return Boolean(validCodeQuote.value && quote.value?.can_checkout);
});
const quoteMessage = computed(() => {
  if (!usesPaymentCode.value) return '';
  if (normalizedPaymentCode.value.length < 4) return 'Введите код полностью.';
  if (quoteBusy.value) return 'Проверяем код и его номинал в базе…';
  if (!quoteMatchesInput.value) return '';
  if (quote.value?.code_status === 'not_found') return checkoutErrors.payment_code_not_found;
  if (quote.value?.code_status === 'used') return checkoutErrors.payment_code_already_used;
  if (quote.value?.error === 'insufficient_points') {
    const source = quote.value.code_source_name ? ` для товара «${quote.value.code_source_name}»` : '';
    return `Код${source} действителен, его номинал ${money(quote.value.code_value_points)}, но баланса не хватает для оплаты остатка.`;
  }
  if (quote.value?.code_status === 'valid') {
    const source = quote.value.code_source_name ? ` Код добавлен для товара «${quote.value.code_source_name}».` : '';
    return `Код действителен. Номинал: ${money(quote.value.code_value_points)}.${source}`;
  }
  return '';
});

const checkoutErrors: Record<string, string> = {
  payment_code_not_found: 'Такого платёжного кода нет в базе. Проверьте ввод или используйте код из списка ТЗ.',
  payment_code_already_used: 'Этот платёжный код уже использован. Введите другой код.',
  insufficient_points: 'На балансе недостаточно баллов. Введите платёжный код или уменьшите корзину.',
  cart_is_empty: 'Корзина пуста.',
};

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' баллов';
}

async function loadCart(): Promise<void> {
  if (!accountUser.value) return;
  cart.value = await authApi<Cart>('/api/cart');
  await refreshCartCount();
  if (usesPaymentCode.value) await loadQuote();
}

async function loadQuote(): Promise<void> {
  const code = normalizedPaymentCode.value;
  if (!accountUser.value || code.length < 4) {
    quote.value = undefined;
    quoteBusy.value = false;
    return;
  }
  quoteBusy.value = true;
  try {
    const result = await authApi<CartQuote>('/api/cart/quote', {
      method: 'POST', body: JSON.stringify({ code }),
    });
    if (normalizedPaymentCode.value === code) quote.value = result;
  } catch (caught) {
    if (normalizedPaymentCode.value === code) {
      const message = (caught as Error).message;
      error.value = checkoutErrors[message] ?? message;
      quote.value = undefined;
    }
  } finally {
    if (normalizedPaymentCode.value === code) quoteBusy.value = false;
  }
}

function scheduleQuote(): void {
  if (quoteTimer) window.clearTimeout(quoteTimer);
  quote.value = undefined;
  error.value = '';
  if (!usesPaymentCode.value || normalizedPaymentCode.value.length < 4) {
    quoteBusy.value = false;
    return;
  }
  quoteBusy.value = true;
  quoteTimer = window.setTimeout(loadQuote, 300);
}

async function setQuantity(sku: string, quantity: number): Promise<void> {
  if (quantity < 1) return removeItem(sku);
  cart.value = await authApi<Cart>(`/api/cart/items/${encodeURIComponent(sku)}`, {
    method: 'PUT', body: JSON.stringify({ quantity }),
  });
  await refreshCartCount();
  if (usesPaymentCode.value) await loadQuote();
}

async function removeItem(sku: string): Promise<void> {
  cart.value = await authApi<Cart>(`/api/cart/items/${encodeURIComponent(sku)}`, { method: 'DELETE' });
  await refreshCartCount();
  if (usesPaymentCode.value) await loadQuote();
}

async function checkout(): Promise<void> {
  error.value = '';
  busy.value = true;
  try {
    const result = await authApi<{ order_ids: string[]; total_points: number; code_value_points: number; code_applied_points: number; points_charged: number; balance_after: number }>('/api/cart/checkout', {
      method: 'POST',
      body: JSON.stringify({
        checkout_id: `chk_${crypto.randomUUID().replaceAll('-', '')}`,
        ...(paymentCode.value.trim() ? { code: paymentCode.value.trim() } : {}),
      }),
    });
    checkoutResult.value = result;
    cart.value = { items: [], item_count: 0, total_points: 0 };
    await Promise.all([refreshAccount(), refreshCartCount()]);
    purchased.value = [];
    for (const orderId of result.order_ids) {
      let detail: Purchase | undefined;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        detail = await authApi<Purchase>(`/api/account/purchases/${encodeURIComponent(orderId)}`);
        if (detail.status === 'delivered' || ['out_of_stock', 'delivery_failed'].includes(detail.status)) break;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      if (detail) purchased.value.push(detail);
    }
    popupIndex.value = 0;
  } catch (caught) {
    const message = (caught as Error).message;
    error.value = checkoutErrors[message] ?? message;
  } finally {
    busy.value = false;
  }
}

async function refreshPopup(): Promise<void> {
  const current = purchased.value[popupIndex.value];
  if (!current) return;
  purchased.value[popupIndex.value] = await authApi<Purchase>(`/api/account/purchases/${encodeURIComponent(current.id)}`);
}

onMounted(async () => {
  document.title = 'Корзина — Game Goods';
  if (!authReady.value) await refreshAccount();
  if (accountUser.value) await loadCart();
});

watch(paymentCode, scheduleQuote);
onBeforeUnmount(() => { if (quoteTimer) window.clearTimeout(quoteTimer); });
</script>

<template>
  <div class="store-bg"><div class="storefront site-page">
    <SiteHeader v-model="search" />
    <main class="inner-page">
      <nav class="breadcrumbs"><a href="/">Каталог</a><span>›</span><span>Корзина</span></nav>
      <div class="page-title-row"><div><small>ВАШ ЗАКАЗ</small><h1>Корзина</h1><p>Сначала товары попадают сюда. Оплата выполняется только из корзины.</p></div><span class="cart-count-large">{{ cart.item_count }}</span></div>

      <section v-if="authReady && !accountUser" class="auth-required"><div class="auth-lock">●</div><h2>Сначала войдите в аккаунт</h2><p>Корзина хранится на сервере и привязана к логину.</p><a href="/account?next=/cart">Войти или зарегистрироваться</a></section>

      <section v-else-if="checkoutResult" class="checkout-complete"><span>✓</span><h2>Покупка оформлена</h2><p>Создано заказов: {{ checkoutResult.order_ids.length }}. Выдача выполняется автоматически.</p><strong>Остаток: {{ money(checkoutResult.balance_after) }}</strong><a href="/account">Открыть список покупок</a></section>

      <div v-else-if="accountUser" class="cart-layout">
        <section class="cart-items-panel">
          <div v-if="!cart.items.length" class="empty-cart"><h2>Корзина пуста</h2><p>Откройте карточку товара и добавьте его сюда.</p><a href="/">Перейти в каталог</a></div>
          <article v-for="item in cart.items" :key="item.sku" class="cart-line">
            <a :href="`/product/${encodeURIComponent(item.sku)}`" class="cart-thumb reference-cover"></a>
            <div class="cart-product"><span>{{ item.type }}</span><a :href="`/product/${encodeURIComponent(item.sku)}`">{{ item.name }}</a><code>{{ item.sku }}</code></div>
            <div class="quantity-control"><button @click="setQuantity(item.sku, item.quantity - 1)">−</button><b>{{ item.quantity }}</b><button @click="setQuantity(item.sku, item.quantity + 1)">+</button></div>
            <strong>{{ money(item.line_total) }}</strong><button class="remove-line" @click="removeItem(item.sku)">×</button>
          </article>
        </section>

        <aside class="checkout-panel">
          <div class="balance-line"><span>Ваш баланс</span><strong>{{ money(accountUser.points_balance) }}</strong></div>
          <h2>Оплата корзины</h2>
          <label class="payment-code-field">Есть код из списка ТЗ?<input v-model="paymentCode" placeholder="Введите код вручную или оставьте поле пустым" autocomplete="off" autocapitalize="characters" spellcheck="false"><small>Например: W67T-ZB0Q-1XKB. Если поле пустое, стоимость автоматически спишется с баланса.</small></label>
          <div v-if="quoteMessage" class="code-quote-status" :class="{ valid: validCodeQuote, invalid: quoteMatchesInput && !validCodeQuote }">{{ quoteMessage }}</div>
          <div v-if="error" class="inline-error">{{ error }}</div>
          <dl>
            <div><dt>Товаров</dt><dd>{{ cart.item_count }}</dd></div>
            <div><dt>Стоимость заказа</dt><dd>{{ money(cart.total_points) }}</dd></div>
            <div v-if="validCodeQuote"><dt>Номинал платёжного кода</dt><dd>{{ money(quote?.code_value_points ?? 0) }}</dd></div>
            <div v-if="validCodeQuote" class="code-coverage-row"><dt>Вычитает платёжный код</dt><dd>−{{ money(quote?.code_applied_points ?? 0) }}</dd></div>
            <div class="checkout-total-row"><dt>К списанию с баланса</dt><dd>{{ money(pointsToCharge) }}</dd></div>
            <div><dt>Баланс после покупки</dt><dd :class="{ 'negative-balance': balanceAfterPreview < 0 }">{{ balanceAfterPreview < 0 ? `Не хватает ${money(-balanceAfterPreview)}` : money(balanceAfterPreview) }}</dd></div>
          </dl>
          <button class="checkout-button" :disabled="!canCheckout" @click="checkout">{{ busy ? 'Оформляем…' : quoteBusy ? 'Проверяем код…' : validCodeQuote && pointsToCharge > 0 ? `Код + ${money(pointsToCharge)} с баланса` : validCodeQuote ? 'Оплатить кодом' : usesPaymentCode ? 'Введите действительный код' : 'Купить с баланса' }}</button>
          <p class="checkout-note">После подтверждения каждый товар станет отдельной покупкой и появится в истории по дате.</p>
        </aside>
      </div>
    </main>
    <PurchaseModal v-if="purchased[popupIndex]" :purchase="purchased[popupIndex]!" :index="popupIndex" :total="purchased.length" @close="purchased = []" @refresh="refreshPopup" @previous="popupIndex--" @next="popupIndex++" />
  </div></div>
</template>
