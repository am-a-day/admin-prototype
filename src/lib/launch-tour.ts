import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Лёгкий guided-тур первого запуска: только подсветка следующего шага.
 * Каждый шаг — 1–2 предложения. Подсвечиваются элементы по [data-tour].
 */
const STEPS: Record<string, DriveStep> = {
  "create-dish": {
    element: '[data-tour="create-dish"]',
    popover: {
      title: "Создайте первую позицию",
      description: "Добавьте блюдо или товар — с этого начинается меню.",
    },
  },
  "dish-fields": {
    element: '[data-tour="dish-fields"]',
    popover: {
      title: "Название и цена",
      description: "Заполните ключевые поля позиции — их увидят гости.",
    },
  },
  "nav-home": {
    element: '[data-tour="nav-home"]',
    popover: {
      title: "Главная витрины",
      description: "Здесь настраивается то, что гость видит первым.",
    },
  },
  "add-banner": {
    element: '[data-tour="add-banner"]',
    popover: {
      title: "Добавьте баннер",
      description: "Покажите акции и новости в верхней части главной.",
    },
  },
  "send-review": {
    element: '[data-tour="send-review"]',
    popover: {
      title: "Отправьте на проверку",
      description: "Передайте витрину менеджеру — он запустит её для гостей.",
    },
  },
};

/** Подсветить шаги, элементы которых сейчас есть в DOM. Возвращает true, если тур запустился. */
export function runTour(keys: string[]): boolean {
  const steps = keys
    .map((k) => STEPS[k])
    .filter((s) => s && document.querySelector(s.element as string));
  if (steps.length === 0) return false;
  driver({
    showProgress: steps.length > 1,
    allowClose: true,
    overlayOpacity: 0.55,
    nextBtnText: "Далее",
    prevBtnText: "Назад",
    doneBtnText: "Понятно",
    steps,
  }).drive();
  return true;
}
