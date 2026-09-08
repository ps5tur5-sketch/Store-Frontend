<script setup lang="ts">
import { ref, watch } from 'vue';
import { Star, CheckCircle2 } from '@lucide/vue';
import { authApi } from '../api';
import type { Purchase } from '../types';
const props = defineProps<{ purchase: Purchase }>();
const emit = defineEmits<{ submitted: [] }>();
const rating = ref(0),
  comment = ref(''),
  busy = ref(false),
  error = ref(''),
  done = ref(false);
watch(
  () => props.purchase.id,
  () => {
    rating.value = 0;
    comment.value = '';
    error.value = '';
    done.value = false;
  },
);
async function submit() {
  busy.value = true;
  error.value = '';
  try {
    await authApi(`/api/account/purchases/${encodeURIComponent(props.purchase.id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating: rating.value, comment: comment.value }),
    });
    done.value = true;
    emit('submitted');
  } catch {
    error.value = 'Не удалось отправить оценку. Обновите покупку и попробуйте ещё раз.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section v-if="purchase.review || done" class="review-saved">
    <CheckCircle2 :size="18" /><span>{{
      purchase.review
        ? `Ваша оценка продавцу: ${purchase.review.rating} из 5`
        : 'Спасибо! Ваша оценка сохранена.'
    }}</span>
  </section>
  <form v-else-if="purchase.can_review" class="review-form" @submit.prevent="submit">
    <h3>Как прошла покупка?</h3>
    <p>Оцени продавца {{ purchase.seller?.name }}. Отзыв поможет другим покупателям.</p>
    <fieldset class="rating-stars">
      <legend class="sr-only">Оценка от 1 до 5</legend>
      <label v-for="n in 5" :key="n" :class="{ filled: rating >= n }"
        ><input
          v-model.number="rating"
          type="radio"
          name="rating"
          :value="n"
          :aria-label="`${n} из 5`"
          required /><Star :size="28" /></label
      ><span>{{ rating ? `${rating} / 5` : 'Твоя оценка' }}</span>
    </fieldset>
    <label class="sr-only" :for="`review-${purchase.id}`">Комментарий к покупке</label
    ><textarea
      :id="`review-${purchase.id}`"
      v-model="comment"
      maxlength="1000"
      rows="3"
      placeholder="Поделись впечатлениями (необязательно)"
    ></textarea
    ><small>Отзыв будет опубликован с вашим логином. Покупка подтверждается автоматически.</small>
    <p v-if="error" role="alert" class="inline-error">{{ error }}</p>
    <button type="submit" :disabled="busy || !rating">{{ busy ? 'Отправляем…' : 'Оставить отзыв' }}</button>
  </form>
</template>
