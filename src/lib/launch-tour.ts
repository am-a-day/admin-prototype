import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Guided tour первого запуска.
 * Хранит один активный экземпляр driver.js — destroyTour() сбрасывает его.
 */

let _currentDriver: ReturnType<typeof driver> | null = null;

export function destroyTour(): void {
  try { _currentDriver?.destroy(); } catch { /* ignore */ }
  _currentDriver = null;
}

// ── Tour steps ────────────────────────────────────────────────────────────────

const STEPS: Record<string, DriveStep> = {
  // Обязательный flow: шаг 1 — создать раздел
  "create-section": {
    element: '[data-tour="create-section"]',
    popover: {
      title: "Создайте первый раздел",
      description:
        "Разделы помогают сгруппировать блюда: например, «Горячие блюда», «Напитки» или «Завтраки».",
    },
  },

  // Обязательный flow: шаг 2 — создать позицию
  "create-dish": {
    element: '[data-tour="create-dish"]',
    popover: {
      title: "Добавьте первую позицию",
      description:
        "Теперь добавьте блюдо в этот раздел. Оно сразу появится в предпросмотре витрины.",
    },
  },

  // После создания позиции — показать preview-panel со статусом
  "preview-panel": {
    element: '[data-tour="preview-panel"]',
    popover: {
      title: "Позиция появилась в предпросмотре",
      description:
        "Сейчас витрина доступна только вам. Позже добавьте цену, фото и описание.\n\nПосле проверки менеджер активирует публичную ссылку и QR-код — тогда гости смогут открыть меню.",
      side: "left",
    },
  },

  // Optional tours (из floating widget)
  "continue-catalog": {
    element: '[data-tour="dish-fields"]',
    popover: {
      title: "Добавьте детали позиции",
      description:
        "Заполните цену, фото и описание — карточка станет готовой для гостей.",
    },
  },
  "set-appearance": {
    element: '[data-tour="appearance-color"]',
    popover: {
      title: "Настройте стиль витрины",
      description:
        "Выберите акцентный цвет, стиль карточек и фон. Изменения сразу видны в предпросмотре.",
    },
  },
  "add-banner": {
    element: '[data-tour="add-banner"]',
    popover: {
      title: "Добавьте баннер",
      description:
        "Покажите акции и новости в верхней части главной витрины.",
    },
  },
  "upsell-step": {
    element: '[data-tour="upsell-setup"]',
    popover: {
      title: "Настройте рекомендации",
      description:
        "Предлагайте гостям дополнительные блюда в карточке блюда и в корзине.",
    },
  },
};

// ── runTour ───────────────────────────────────────────────────────────────────

/**
 * Подсветить шаги, элементы которых есть в DOM.
 * @param onDone — вызывается когда тур закрыт (кнопка «Понятно» или клик вне).
 * Возвращает true если тур запустился.
 */
export function runTour(keys: string[], onDone?: () => void): boolean {
  const steps = keys
    .map((k) => STEPS[k])
    .filter((s): s is DriveStep => !!s && !!document.querySelector(s.element as string));
  if (steps.length === 0) {
    onDone?.();
    return false;
  }
  destroyTour();
  _currentDriver = driver({
    showProgress: false,
    allowClose: true,
    overlayOpacity: 0.55,
    doneBtnText: "Понятно",
    nextBtnText: "Далее",
    prevBtnText: "Назад",
    showButtons: ["next"],
    onDestroyed: () => {
      _currentDriver = null;
      onDone?.();
    },
    steps,
  });
  _currentDriver.drive();
  return true;
}
