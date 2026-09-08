<script setup lang="ts">
import { ArrowUpRight, ShoppingCart } from '@lucide/vue';
import type { Product } from '../types';
import { money, typeLabels } from '../format';
defineProps<{ product: Product; busy?: boolean }>();
defineEmits<{ add: [product: Product] }>();
</script>
<template>
  <article class="product-card">
    <a :href="`/product/${encodeURIComponent(product.sku)}`" class="product-card-art"
      ><img :src="product.image" :alt="product.name" loading="lazy" /><span class="art-badge">{{
        typeLabels[product.type]
      }}</span
      ><span class="art-link"><ArrowUpRight :size="18" /></span
    ></a>
    <div class="product-card-body">
      <span class="stock-label" :class="{ unavailable: !product.available }"
        ><i></i>{{ product.available ? 'В наличии' : 'Скоро появится' }}</span
      ><a :href="`/product/${encodeURIComponent(product.sku)}`"
        ><h3>{{ product.name }}</h3></a
      >
      <div class="product-card-bottom">
        <div>
          <small>От {{ product.seller_count || 0 }} продавцов</small
          ><strong><span class="from-price">от </span>{{ money(product.price) }}</strong>
        </div>
        <a class="choose-seller-button" :href="`/product/${encodeURIComponent(product.sku)}#sellers`"
          ><ShoppingCart :size="17" />Выбрать</a
        >
      </div>
    </div>
  </article>
</template>
