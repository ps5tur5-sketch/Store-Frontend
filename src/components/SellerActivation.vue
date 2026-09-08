<script setup lang="ts">
import { ref } from 'vue';
import { Store, ArrowRight } from '@lucide/vue';
import { becomeSeller } from '../auth';
const props = defineProps<{ expanded?: boolean }>();
const open = ref(props.expanded ?? false);
const name = ref('');
const busy = ref(false);
const error = ref('');
async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await becomeSeller(name.value);
    location.href = '/seller/account';
  } catch {
    error.value = 'Не удалось подключить магазин. Проверьте ник и повторите попытку.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="seller-activation">
    <div class="seller-activation-intro">
      <Store :size="28" />
      <div>
        <h2>Твой аккаунт может больше</h2>
        <p>Открой магазин в этом же аккаунте. Баланс и покупки сохранятся.</p>
      </div>
      <button v-if="!open" class="checkout-button" @click="open = true">
        Стать продавцом <ArrowRight :size="17" />
      </button>
    </div>
    <form v-if="open" @submit.prevent="submit">
      <label
        >Ник продавца<input
          v-model="name"
          minlength="2"
          maxlength="100"
          required
          placeholder="Как вас увидят покупатели"
          autocomplete="organization"
          :disabled="busy" /></label
      ><button class="checkout-button" :disabled="busy">
        {{ busy ? 'Подключаем магазин…' : 'Открыть магазин' }}
      </button>
    </form>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
  </section>
</template>
