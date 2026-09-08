# Проверки интерфейса

Сборка: `npm ci && npm run build`. Vue/TypeScript и production-сборка nginx проверяются в GitHub Actions. Семь сценариев ниже прошли в настоящем Chrome на запущенных Docker-сервисах без ошибок JavaScript; это локальные результаты, опубликованные отдельно от статуса CI.

| Сценарий | Проверено | Результат |
| --- | --- | --- |
| `browser-smoke.mjs` | Покупка, отзыв 5, чат, возврат, скрытие ключа, баланс, бан/разбан | [Лог](verification/browser-workflow.txt) |
| `browser-payments.mjs` | Регистрация продавца, цена/закупка, СБП failure/retry, USDT, wallet, прибыль и возврат | [Лог](verification/browser-payments.txt) |
| `browser-account-modes.mjs` | Один аккаунт, подключение магазина, переключение, повторный вход | [Лог](verification/browser-account-modes.txt) |
| `browser-withdrawals.mjs` | Карта/USDT, резерв, отказ/освобождение и история | [Лог](verification/browser-withdrawals.txt) |
| `browser-layout.mjs` | Ширины 360/390/768/1440, вкладки кабинетов и отчёт | [Лог](verification/responsive-check.txt) |
| `browser-lots.mjs` | 1000 ключей, партии 200/400/400, три цены в корзине, выдача, неизменная прибыль | [Лог](verification/browser-lots.txt) |
| `browser-key-prices.mjs` | Два ключа по 1/2 ₽, независимая продажа, поиск, перезагрузка, резерв, выдача за 3 ₽ | [Лог](verification/browser-key-prices.txt) |

Запуск сценариев и переменные окружения описаны в [README](../README.md). Для их выполнения нужны оба сервиса; браузерная проверка создаёт собственные демо-аккаунты/заказы. [Backend: 71 интеграционный тест и гарантии](https://github.com/ps5tur5-sketch/Store-Backend/blob/main/docs/VERIFICATION.md).

## Снимки

[Цена каждого ключа](screenshots/seller-individual-prices.png) · [мобильная версия](screenshots/seller-individual-prices-mobile.png) · [распределение партии](screenshots/seller-split-1000.png) · [продажи и прибыль](screenshots/seller-sales-profit.png) · [баланс](screenshots/buyer-wallet.png).
