import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Единый scroll-контейнер страницы.
 * Все full-page страницы используют его как корневой элемент.
 */
export function PageScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("min-w-0 flex-1 overflow-y-auto bg-white ", className)}>
      {children}
    </main>
  );
}

/**
 * Единый контейнер контента.
 * Фиксирует max-width и горизонтальные отступы для всех страниц.
 */
export function PageContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-5xl space-y-6 px-8 py-8 relative", className)}>
      {children}
    </div>
  );
}

