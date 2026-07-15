# TASKO Admin Prototype v2

React + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui — кликабельный прототип для проверки IA, layout и contextual mobile preview.

## Стек

- React 19 + TypeScript
- Vite 6
- Tailwind CSS v4 (`@tailwindcss/vite`)
- shadcn/ui primitives (`Button`, `Switch`, `Card`, …)

## Запуск

```bash
npm install
npm run dev
```

Сборка:

```bash
npm run build
```

## Структура

```
src/
  App.tsx
  data/mock-data.ts
  components/layout/     — rail, header, catalog sidebar
  components/preview/    — mobile preview simulator
  components/ui/         — shadcn primitives
  components/workspace/  — общие блоки форм
  features/storefront/   — экраны витрины
  features/management/   — управление
  features/training/     — обучение официантов
```

## Навигация

**Rail:** Витрина · Заказы · Обучение · Аналитика · QR / инструменты · Управление

**Витрина:** Главная · Каталог · Рекомендации · Оформление · О заведении

**Обучение:** Тренажёр · Меню · Прогресс

**Управление:** Доставка и самовывоз · Уведомления · Тариф · Аккаунт · Импорт / экспорт · SEO

Левая панель только в «Каталог» и «Рекомендации». Mobile preview — контекстный симулятор гостя (без preview на служебных экранах).
