<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Flag, Star, ShieldCheck, CheckCircle2, FileCheck2 } from '@lucide/vue';
import { api } from '../api';
import type { Seller } from '../types';
import { date } from '../format';
import SiteHeader from './SiteHeader.vue';
const seller = ref<Seller>(),
  error = ref(''),
  search = ref('');
const id = decodeURIComponent(window.location.pathname.split('/')[2] ?? '');
const reasons: Record<string, string> = {
  duplicate_code: 'Прислал код, закреплённый за другим заказом',
  wrong_code: 'Прислал чужой или неподтверждённый код',
  error_after_issue: 'Сообщил об ошибке после фактической выдачи',
};
onMounted(async () => {
  try {
    seller.value = await api<Seller>(`/api/sellers/${encodeURIComponent(id)}`);
    document.title = `${seller.value.name} — репутация продавца`;
  } catch {
    error.value = 'Не удалось загрузить продавца.';
  }
});
</script>
<template>
  <div class="store-bg">
    <div class="storefront site-page">
      <SiteHeader v-model="search" />
      <main class="inner-page">
        <nav class="breadcrumbs"><a href="/">Каталог</a><span>/</span><span>Репутация продавца</span></nav>
        <div v-if="error" class="inline-error">{{ error }}</div>
        <template v-if="seller"
          ><header class="seller-profile-heading">
            <div class="seller-avatar">{{ seller.name.slice(0, 1) }}</div>
            <div>
              <span class="section-kicker">ПРОДАВЕЦ · {{ seller.id }}</span>
              <h1>{{ seller.name }}</h1>
              <span v-if="seller.flag === 'red'" class="red-flag"
                ><Flag :size="17" />Подтверждённые нарушения</span
              ><span v-else class="seller-neutral"
                ><ShieldCheck :size="17" />Нарушений за последние 30 дней не выявлено</span
              >
            </div>
          </header>
          <p v-if="seller.demo_notice" class="demo-scenario-banner">{{ seller.demo_notice }}</p>
          <section class="seller-metrics">
            <article>
              <Star :size="22" /><strong
                >{{ seller.rating === null ? '—' : seller.rating }}<small> / 5</small></strong
              ><span>{{ seller.review_count }} оценок покупателей</span>
            </article>
            <article>
              <CheckCircle2 :size="22" /><strong>{{ seller.delivered }}</strong
              ><span>товаров выдано</span>
            </article>
            <article>
              <FileCheck2 :size="22" /><strong>{{ seller.refunded }}</strong
              ><span>возвратов завершено</span>
            </article>
            <article :class="{ flagged: seller.flag === 'red' }">
              <Flag :size="22" /><strong>{{ seller.confirmed_incidents }}</strong
              ><span>подтверждённых нарушений</span>
            </article>
          </section>
          <section class="seller-evidence">
            <div class="section-title">
              <div>
                <span class="section-kicker">ПРОВЕРЕНО СИСТЕМОЙ</span>
                <h2>Факты, на которых строится доверие</h2>
                <p>
                  Проверяем товар, владельца кода и фактический результат выдачи. Оценки покупателей считаются
                  отдельно.
                </p>
              </div>
            </div>
            <div v-if="!seller.evidence.length" class="neutral-evidence">
              <ShieldCheck :size="24" />
              <p>
                Подтверждённых нарушений пока нет. Это отсутствие обнаруженных нарушений, а не гарантия
                будущих покупок.
              </p>
            </div>
            <article v-for="incident in seller.evidence" :key="incident.id" class="evidence-card">
              <Flag :size="20" />
              <div>
                <h3>{{ reasons[incident.kind] || incident.kind }}</h3>
                <p v-if="incident.kind === 'error_after_issue'">
                  Поставщик ответил ошибкой, но запись о выдаче уже была подтверждена. Система восстановила
                  результат без повторной выдачи.
                </p>
                <p v-else>
                  Ответ поставщика не прошёл проверку реестра ключей и принадлежности заказу. Подменённый код
                  не передан покупателю.
                </p>
                <small>Подтверждение #{{ incident.id }} · {{ date(incident.created_at) }}</small>
              </div>
            </article>
            <p class="seller-policy">
              Красный флаг действует при подтверждённых нарушениях за последние 30 дней. История доказательств
              сохраняется. Таймаут или отсутствие товара сами по себе не считаются доказательством обмана.
            </p>
          </section>
          <section class="seller-reviews">
            <div class="section-title">
              <h2>Отзывы после покупки</h2>
              <span>{{ seller.review_count }} отзывов</span>
            </div>
            <div v-if="!seller.reviews.length" class="neutral-evidence">
              <Star :size="23" />
              <p>Отзывов пока нет. Оценку может оставить только покупатель после выдачи или возврата.</p>
            </div>
            <div class="seller-review-grid">
              <article v-for="(review, i) in seller.reviews" :key="i" class="seller-review">
                <header>
                  <b>{{ review.buyer }}</b
                  ><time>{{ date(review.created_at) }}</time>
                </header>
                <span class="review-score"
                  ><Star v-for="n in 5" :key="n" :size="15" :class="{ filled: n <= review.rating }" />{{
                    review.rating
                  }}
                  / 5</span
                >
                <p>{{ review.comment || 'Покупатель оставил оценку без комментария.' }}</p>
                <small><CheckCircle2 :size="13" />Подтверждённая покупка</small>
              </article>
            </div>
          </section></template
        >
      </main>
    </div>
  </div>
</template>
