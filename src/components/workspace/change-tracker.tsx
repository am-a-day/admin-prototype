import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { usePublish, type PageKey } from "@/contexts/publish-context";

/**
 * Невидимая обёртка: ловит редактирование текстовых полей внутри страницы
 * через делегирование `input`-событий и регистрирует одно изменение на поле.
 * Кнопочные взаимодействия (переключатели, выбор стиля) страницы регистрируют
 * явно через usePublish().registerChange.
 */
export function ChangeTracker({
  pageKey,
  children,
}: {
  pageKey: PageKey | null;
  children: ReactNode;
}) {
  const { registerChange, publishVersion } = usePublish();
  const touched = useRef<WeakSet<Element>>(new WeakSet());

  useEffect(() => {
    touched.current = new WeakSet();
  }, [publishVersion]);

  const onInput = (e: FormEvent) => {
    if (!pageKey) return;
    const el = e.target as Element;
    const editable =
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement;
    if (!editable) return;
    if (touched.current.has(el)) return;
    touched.current.add(el);
    registerChange(pageKey);
  };

  return (
    <div style={{ display: "contents" }} onInput={onInput}>
      {children}
    </div>
  );
}
