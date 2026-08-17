# Position Editor · «Основное» — inline optional fields handoff

## Scope

Обновление таба `Основное` в Position Editor / Side Peek. Скидка и КБЖУ больше не представлены отдельными крупными `add-row` блоками: обе настройки занимают компактные inline-строки внутри основной формы.

Источник реализации:

- `src/features/storefront/catalog/editor/position-editor.tsx`
- `e2e/catalog-editor.spec.ts`

Целевой Figma-контекст: `Position editor · Main flow` в [NEW Админка](https://www.figma.com/design/vJsF007tTNiL73S40cW8NU/NEW-%D0%90%D0%B4%D0%BC%D0%B8%D0%BD%D0%BA%D0%B0?node-id=2307-92).

## Layout

Блок располагается после описания и отделяется тонким верхним divider.

| Element | Rule |
| --- | --- |
| Optional fields container | без отдельной карточки; `border-top`, внутренний top padding `8px` |
| Row | min-height `32px`, horizontal padding `4px`, gap `8px` |
| Label column | фиксированная компактная ширина `64px` |
| Add action | muted inline action with `+`; не резервирует отдельный большой блок |
| Remove action | visible icon action at the trailing edge; accessible label and tooltip/title обязательны |

## States to transfer

### Empty

- `Скидка` → `+ Добавить скидку`
- `КБЖУ` → `+ Добавить`
- оба действия остаются на одной базовой линии с label-ом;
- нет пустой карточки и нет лишнего вертикального отступа.

### Discount active

В строке скидки показывается один кликабельный trigger:

- neutral badge: `−18,6%` / `−10%`;
- рядом итоговая цена: `· 3 490 ₸`;
- корректный знак минус `−`, разделение тысяч сохраняется;
- вся связка открывает существующий Popover;
- справа отдельный remove-action `Убрать скидку`.

Внутри Popover остаются два связанных поля:

- `Размер скидки`;
- `Цена после скидки`;
- изменение одного поля пересчитывает второе;
- destructive action в нижней строке с divider: `Убрать скидку`.

Закрытие Popover не удаляет скидку и не закрывает Side Peek.

### КБЖУ active

В строке КБЖУ показываются:

- label `КБЖУ`;
- база расчёта (`На 100 г`, `На 100 мл` или `На позицию`);
- visible remove-action `Удалить КБЖУ`.

Редактор полей раскрывается сразу под строкой. Для компактного Side Peek 400–470px использовать 2×2:

`Калорийность | Белки`

`Жиры | Углеводы`

Четыре колонки допустимы только для более широкого контейнера, не для обычного Side Peek.

## Interaction contract

- autosave и текущая data model не меняются;
- добавление/изменение скидки сохраняет существующий Popover и двусторонний пересчёт;
- remove-action скидки очищает `hasDiscount` и `priceWithSale`;
- remove-action КБЖУ сохраняет существующее подтверждение удаления заполненных значений;
- отдельной кнопки `Готово` нет;
- переключение табов, закрытие Popover и работа с portal-overlay не влияют на Side Peek.

## Figma transfer checklist

- [ ] В `Position editor · Main flow` заменить старые add-row для discount/KBJU на две inline-строки.
- [ ] Добавить discount badge + итоговую цену и отдельный trailing remove-action.
- [ ] Оставить active/inactive states в одной геометрии, без layout jump.
- [ ] Показать expanded KBJU в 2×2 для 400px и 470px Side Peek.
- [ ] Сохранить Popover state для редактирования скидки и destructive row action внутри него.
- [ ] Вынести remove-actions в accessible named interactions, не использовать `×` как смысл удаления/закрытия Popover.
- [ ] Проверить empty, discount active, KBJU active и discount + KBJU active.

## Verification

- targeted Playwright: inline placement, discount Popover/edit/remove, persistence of discount + KBJU;
- TypeScript compiler check;
- visual check at compact Side Peek width;
- KBJU labels verified after switching from 4-column to 2×2 compact layout.
