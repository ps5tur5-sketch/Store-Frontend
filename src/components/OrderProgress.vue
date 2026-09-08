<script setup lang="ts">
import { CheckCircle2, Clock3, RotateCcw, ArrowUpRight } from '@lucide/vue';
import type { OrderGroup } from '../types';
import PaymentPanel from './PaymentPanel.vue';
import { money, statusLabels, date, refundDestination } from '../format';
defineProps<{ order: OrderGroup }>();
defineEmits<{ open: [id: string] }>();
</script>
<template>
  <section class="order-progress" :data-status="order.status">
    <header>
      <div>
        <span class="section-kicker">ЗАКАЗ · {{ date(order.created_at) }}</span>
        <h2>
          <CheckCircle2 v-if="order.terminal" :size="23" /><Clock3 v-else :size="23" />{{
            statusLabels[order.status] || order.status
          }}
        </h2>
        <code>{{ order.id }}</code>
      </div>
      <span class="order-progress-count"
        >{{ order.progress.completed }} / {{ order.progress.total }}<small>товаров обработано</small></span
      >
    </header>
    <PaymentPanel v-if="order.payment_id && order.payment_state !== 'paid'" :payment-id="order.payment_id" />
    <progress
      :value="order.progress.completed"
      :max="order.progress.total"
      aria-label="Прогресс заказа"
    ></progress>
    <div class="order-money">
      <div>
        <span>Оплачено</span><b>{{ money(order.money.paid) }}</b>
      </div>
      <div>
        <span>Выдано товаров на</span><b>{{ money(order.money.delivered) }}</b>
      </div>
      <div class="refund-total">
        <span>Возвращено</span><b>{{ money(order.money.refunded) }}</b>
      </div>
      <div>
        <span>Ожидает выдачи</span><b>{{ money(order.money.pending) }}</b>
      </div>
    </div>
    <p v-if="order.money.refunded" class="refund-explanation">
      <RotateCcw :size="16" />Средства возвращены {{ refundDestination(order.refund_destination) }}.
      {{
        order.refund_details?.revoked_keys
          ? 'Ранее выданные ключи возвращённых товаров отозваны.'
          : 'Ключи по возвращённым позициям не выдавались.'
      }}
    </p>
    <div class="order-items">
      <button v-for="item in order.items" :key="item.id" @click="$emit('open', item.id)">
        <img :src="item.image" :alt="item.name" />
        <div>
          <strong>{{ item.name }}</strong
          ><small class="order-seller"
            >{{ item.seller_name }}<template v-if="item.offer_name"> · {{ item.offer_name }}</template></small
          ><span class="purchase-status" :data-status="item.status">{{
            statusLabels[item.status] || item.status
          }}</span>
        </div>
        <b>{{ money(item.amount) }}</b
        ><ArrowUpRight :size="17" />
      </button>
    </div>
  </section>
</template>
