# Документация Happy Calendar

Happy Calendar — приватный планировщик совместных мероприятий для пар, семей и компаний друзей. Состояние группы хранится в переносимой строке сессии, а не в backend или базе данных.

## Область продукта

- Общий календарь праздников и семейных событий.
- Бюджеты подарков для каждого события.
- Формат события: организуем праздник, можно просто приехать, удалённо, только подарок.
- Псевдонимные профили с ником и пиксельным аватаром.
- Личные вишлисты и обновления после мероприятий.
- Без аккаунтов, backend, базы данных и обязательных персональных данных.

## Гайд разработчика

Требования: Node.js 20+ и npm 10+.

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

## Структура

```text
src/app                    React entrypoint и глобальные стили
src/pages/landing           Responsive landing page
src/widgets/session-preview  Demo data для UI
src/entities/session         Pure functional domain model
src/shared/digitable         Локальный Digitable UI adapter и tokens
src/test                     Vitest setup
```

## Правила функционального программирования

- Доменный слой состоит из pure functions.
- UI получает immutable props.
- Трансформации состояния возвращают новые значения.
- Landing-срез не использует backend calls, database writes, localStorage или sessionStorage.
- Генерация строки сессии должна быть детерминированной.

Mermaid-схемы лежат в [architecture.md](./architecture.md).
