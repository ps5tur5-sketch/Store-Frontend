export const money = (value: number) => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
export const points = money;
export const paymentStatusLabels: Record<string, string> = {
  pending: 'Ожидает оплаты',
  paid: 'Оплачен',
  failed: 'Ошибка оплаты',
  cancelled: 'Отменён',
  expired: 'Время оплаты истекло',
};
export const refundDestination = (method?: string) =>
  method === 'sbp'
    ? 'в тестовый платёж СБП'
    : method === 'crypto'
      ? 'в тестовый криптоплатёж'
      : 'на баланс личного кабинета';
export const date = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const typeLabels: Record<string, string> = {
  topup: 'Пополнение',
  key: 'Ключ игры',
  subscription: 'Подписка',
  giftcard: 'Подарочная карта',
};
export const statusLabels: Record<string, string> = {
  created: 'Ожидает оплаты',
  paid: 'Оплачен',
  processing: 'Выдаём товары',
  delivering: 'Выдаём товар',
  delivered: 'Выдан',
  refund_pending: 'Возврат обрабатывается',
  refunded: 'Деньги возвращены',
  partially_refunded: 'Частичный возврат',
  payment_failed: 'Ошибка оплаты',
  out_of_stock: 'Ожидает пополнения',
  delivery_failed: 'Повторная выдача',
};
