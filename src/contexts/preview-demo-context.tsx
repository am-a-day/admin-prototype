import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Demo-флаг для прототипа: показать витрину как «пустую», чтобы увидеть
 * административные плейсхолдеры незаполненных слотов в превью.
 * В реальном продукте это состояние выводится из данных каждого блока.
 */
type Ctx = {
  emptyVitrine: boolean;
  setEmptyVitrine: (v: boolean) => void;
};

const PreviewDemoContext = createContext<Ctx | null>(null);

export function PreviewDemoProvider({ children }: { children: ReactNode }) {
  const [emptyVitrine, setEmptyVitrine] = useState(false);
  return (
    <PreviewDemoContext.Provider value={{ emptyVitrine, setEmptyVitrine }}>
      {children}
    </PreviewDemoContext.Provider>
  );
}

export function usePreviewDemo() {
  const ctx = useContext(PreviewDemoContext);
  if (!ctx) throw new Error("usePreviewDemo must be used within PreviewDemoProvider");
  return ctx;
}
