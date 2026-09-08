<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { MessageCircle, Send } from '@lucide/vue';
import { authApi } from '../api';
import { accountUser } from '../auth';
import { date } from '../format';
const props = defineProps<{ orderId: string }>();
interface Conversation {
  can_send: boolean;
  closed_reason: string | null;
  messages: {
    id: string;
    body: string;
    created_at: string;
    sender_id: string;
    username: string;
    role: string;
  }[];
}
const chat = ref<Conversation>();
const body = ref('');
const error = ref('');
const busy = ref(false);
const list = ref<HTMLElement>();
let timer: number | undefined;
let disposed = false;
let messageId = crypto.randomUUID();
let submittedBody = '';
async function load() {
  const id = props.orderId;
  try {
    const result = await authApi<Conversation>(`/api/orders/${encodeURIComponent(id)}/messages`);
    if (id === props.orderId) {
      const changed = result.messages.length !== chat.value?.messages.length;
      chat.value = result;
      error.value = '';
      if (changed) {
        await nextTick();
        list.value?.scrollTo(0, list.value.scrollHeight);
      }
    }
  } catch {
    error.value = 'Не удалось загрузить переписку.';
  }
}
async function poll() {
  await load();
  if (!disposed) timer = window.setTimeout(poll, 4000);
}
async function send() {
  if (busy.value || !body.value.trim()) return;
  busy.value = true;
  if (submittedBody !== body.value.trim()) {
    messageId = crypto.randomUUID();
    submittedBody = body.value.trim();
  }
  try {
    await authApi(`/api/orders/${encodeURIComponent(props.orderId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ id: messageId, body: body.value.trim() }),
    });
    body.value = '';
    messageId = crypto.randomUUID();
    await load();
  } catch {
    await load();
    error.value = 'Сообщение не отправлено. Возможно, заказ уже возвращён.';
  } finally {
    busy.value = false;
  }
}
watch(
  () => props.orderId,
  () => {
    chat.value = undefined;
    body.value = '';
    messageId = crypto.randomUUID();
    void load();
  },
);
onMounted(poll);
onBeforeUnmount(() => {
  disposed = true;
  window.clearTimeout(timer);
});
const roleNames: Record<string, string> = { buyer: 'Покупатель', seller: 'Продавец', admin: 'Поддержка' };
</script>
<template>
  <section class="order-chat">
    <header>
      <MessageCircle :size="20" />
      <div>
        <h3>Переписка по покупке</h3>
        <p>Покупатель, продавец и поддержка</p>
      </div>
    </header>
    <div v-if="error" class="inline-error" role="alert">{{ error }}</div>
    <div ref="list" class="chat-messages" aria-live="polite">
      <p v-if="chat && !chat.messages.length" class="chat-empty">Сообщений пока нет.</p>
      <article
        v-for="message in chat?.messages"
        :key="message.id"
        :class="{ mine: message.sender_id === accountUser?.id }"
      >
        <div>
          <b>{{ message.username }}</b
          ><span>{{ roleNames[message.role] }}</span
          ><time>{{ date(message.created_at) }}</time>
        </div>
        <p>{{ message.body }}</p>
      </article>
    </div>
    <p v-if="chat && !chat.can_send" class="chat-closed">
      {{
        chat.closed_reason === 'refunded'
          ? 'Средства возвращены. Переписка закрыта, история сохранена.'
          : 'Переписка доступна после оплаты покупки.'
      }}
    </p>
    <form v-else-if="chat" @submit.prevent="send">
      <textarea
        v-model="body"
        aria-label="Сообщение"
        rows="2"
        maxlength="2000"
        required
        placeholder="Опишите вопрос по этой покупке…"
      /><button :disabled="busy || !body.trim()" aria-label="Отправить сообщение"><Send :size="19" /></button>
    </form>
  </section>
</template>
