import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMockAuth } from "@/contexts/mock-auth-context";

export type PageKey =
  | "home"
  | "catalog"
  | "upsell"
  | "appearance"
  | "about"
  | "order-settings";

export const PAGE_LABELS: Record<PageKey, string> = {
  home: "Главная",
  catalog: "Каталог",
  upsell: "Рекомендации",
  appearance: "Оформление",
  about: "О заведении",
  "order-settings": "Настройка заказов",
};

const PAGE_ORDER: PageKey[] = [
  "home",
  "catalog",
  "upsell",
  "appearance",
  "about",
  "order-settings",
];

/** Длительность анимации «Сохранение…» в режиме Rail Status. */
export const SAVING_DURATION_MS = 900;

/** UX-эксперимент: способ обратной связи после автосохранения. */
export type SaveMode = "toast" | "rail";

export type PublishStatus = "published" | "saving" | "draft" | "publishing";

type ToastState = { id: number; text: string } | null;

type ChangeEntry = { page: PageKey; label: string; count: number };

export type PublishResult = "first-publish" | "update" | "error" | null;

type PublishContextValue = {
  status: PublishStatus;
  totalChanges: number;
  changeList: ChangeEntry[];
  /** Растёт при каждой публикации — слушатели сбрасывают свои dedupe-наборы. */
  publishVersion: number;
  /** Время последнего изменения (для строки в popover). */
  lastChangeAt: number | null;
  registerChange: (page: PageKey) => void;
  publish: () => void;
  /** Prototype tool: inject mock unpublished changes for demo. */
  injectDemoChanges: () => void;
  /** Prototype tool: instantly clear unpublished changes (demo). */
  clearChanges: () => void;
  /** Время последней успешной публикации (для статуса «Всё опубликовано»). */
  lastPublishedAt: number | null;
  // ── Публикация витрины (Publish model) ────────────────────────────────────
  /** Идёт ли публикация — фиксированный 3-сек loader поверх preview. */
  publishPhase: "idle" | "publishing";
  /** Результат последней публикации для toast. */
  publishResult: PublishResult;
  /** Запустить публикацию. opts.fail — смоделировать ошибку ревалидации. */
  startPublish: (opts?: { fail?: boolean; catalogHasVisibleItems?: boolean }) => void;
  /** Скрыть toast результата публикации. */
  dismissPublishResult: () => void;
  // UX-эксперимент
  saveMode: SaveMode;
  setSaveMode: (mode: SaveMode) => void;
  toast: ToastState;
};

const emptyChanges = (): Record<PageKey, number> => ({
  home: 0,
  catalog: 0,
  upsell: 0,
  appearance: 0,
  about: 0,
  "order-settings": 0,
});

const publishChangesKey = (accountId: string) => `tasko.publish.changes.${accountId}`;

function readStoredChanges(accountId: string | undefined) {
  if (!accountId || typeof window === "undefined") return emptyChanges();
  try {
    const raw = window.localStorage.getItem(publishChangesKey(accountId));
    return raw ? { ...emptyChanges(), ...JSON.parse(raw) } : emptyChanges();
  } catch {
    return emptyChanges();
  }
}

function writeStoredChanges(accountId: string | undefined, changes: Record<PageKey, number>) {
  if (!accountId || typeof window === "undefined") return;
  window.localStorage.setItem(publishChangesKey(accountId), JSON.stringify(changes));
}

const PublishContext = createContext<PublishContextValue | null>(null);

export function PublishProvider({ children }: { children: ReactNode }) {
  const {
    account,
    markDraftChanged,
    publishWorkspace,
  } = useMockAuth();
  const accountId = account?.id;
  const [changes, setChanges] = useState<Record<PageKey, number>>(() => readStoredChanges(accountId));
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishVersion, setPublishVersion] = useState(0);
  const [lastChangeAt, setLastChangeAt] = useState<number | null>(null);
  const [saveMode, setSaveMode] = useState<SaveMode>("toast");
  const [toast, setToast] = useState<ToastState>(null);
  const [publishPhase, setPublishPhase] = useState<"idle" | "publishing">("idle");
  const [publishResult, setPublishResult] = useState<PublishResult>(null);
  // Дефолт-мок: «сегодня в 10:42» — для состояния «Всё опубликовано».
  const [lastPublishedAt, setLastPublishedAt] = useState<number | null>(
    () => account?.workspace.publishedSnapshot?.publishedAt ?? null,
  );
  const savingTimerRef = useRef<number | null>(null);
  const toastIdRef = useRef(0);
  const publishTimers = useRef<number[]>([]);
  const lastCatalogHasVisibleItems = useRef(false);
  const isFirstPublication = useRef(false);

  useEffect(() => {
    setChanges(readStoredChanges(accountId));
    setLastPublishedAt(account?.workspace.publishedSnapshot?.publishedAt ?? null);
  }, [accountId, account?.workspace.publishedSnapshot?.publishedAt]);

  const registerChange = useCallback(
    (page: PageKey) => {
      setChanges((prev) => {
        const next = { ...prev, [page]: prev[page] + 1 };
        writeStoredChanges(accountId, next);
        return next;
      });
      setLastChangeAt(Date.now());
      markDraftChanged();

      if (saveMode === "toast") {
        // Режим 1 — toast после автосохранения.
        toastIdRef.current += 1;
        setToast({ id: toastIdRef.current, text: "✓ Черновик сохранён" });
      } else {
        // Режим 2 — анимация «Сохранение…» внутри индикатора в rail.
        setSaving(true);
        if (savingTimerRef.current) window.clearTimeout(savingTimerRef.current);
        savingTimerRef.current = window.setTimeout(() => setSaving(false), SAVING_DURATION_MS);
      }
    },
    [
      accountId,
      markDraftChanged,
      saveMode,
    ],
  );

  const totalChanges = useMemo(
    () => Object.values(changes).reduce((sum, n) => sum + n, 0),
    [changes],
  );

  const changeList = useMemo<ChangeEntry[]>(
    () =>
      PAGE_ORDER.filter((page) => changes[page] > 0).map((page) => ({
        page,
        label: PAGE_LABELS[page],
        count: changes[page],
      })),
    [changes],
  );

  const status: PublishStatus = publishing
    ? "publishing"
    : saving
      ? "saving"
      : totalChanges > 0
        ? "draft"
        : "published";

  const publish = useCallback(() => {
    setPublishing(true);
    window.setTimeout(() => {
      setChanges(emptyChanges());
      setLastChangeAt(null);
      setPublishing(false);
      setPublishVersion((v) => v + 1);
    }, 1500);
  }, []);

  const injectDemoChanges = useCallback(() => {
    setChanges({ home: 1, catalog: 1, upsell: 0, appearance: 0, about: 1, "order-settings": 0 });
    setLastChangeAt(Date.now());
  }, []);

  const clearChanges = useCallback(() => {
    const next = emptyChanges();
    setChanges(next);
    writeStoredChanges(accountId, next);
    setLastChangeAt(null);
  }, [accountId]);

  // ── Публикация витрины ──────────────────────────────────────────────────────
  // Ревалидация Next/cache почти мгновенна, но момент готовности неизвестен —
  // поэтому показываем фиксированный 3-сек loader, затем success toast.
  const startPublish = useCallback((opts?: { fail?: boolean; catalogHasVisibleItems?: boolean }) => {
    if (typeof opts?.catalogHasVisibleItems === "boolean") {
      lastCatalogHasVisibleItems.current = opts.catalogHasVisibleItems;
    }
    if (!lastCatalogHasVisibleItems.current) return;
    isFirstPublication.current = !account?.workspace.publishedSnapshot;
    publishTimers.current.forEach((t) => window.clearTimeout(t));
    publishTimers.current = [];
    setPublishResult(null);
    setPublishPhase("publishing");
    publishTimers.current.push(
      window.setTimeout(
        () => {
          if (opts?.fail) {
            // Ошибка — правки НЕ сбрасываем: гости видят прежнюю версию.
            setPublishPhase("idle");
            setPublishResult("error");
          } else {
            const next = emptyChanges();
            setChanges(next);
            writeStoredChanges(accountId, next);
            setLastChangeAt(null);
            setPublishVersion((v) => v + 1);
            setPublishPhase("idle");
            setPublishResult(isFirstPublication.current ? "first-publish" : "update");
            setLastPublishedAt(Date.now());
            publishWorkspace(true);
          }
        },
        opts?.fail ? 600 : 3000, // ошибку показываем сразу, успех — после 3 сек
      ),
    );
  }, [account?.workspace.publishedSnapshot, accountId, publishWorkspace]);

  const dismissPublishResult = useCallback(() => setPublishResult(null), []);

  const value = useMemo<PublishContextValue>(
    () => ({
      status,
      totalChanges,
      changeList,
      publishVersion,
      lastChangeAt,
      registerChange,
      publish,
      injectDemoChanges,
      clearChanges,
      lastPublishedAt,
      publishPhase,
      publishResult,
      startPublish,
      dismissPublishResult,
      saveMode,
      setSaveMode,
      toast,
    }),
    [
      status,
      totalChanges,
      changeList,
      publishVersion,
      lastChangeAt,
      registerChange,
      publish,
      injectDemoChanges,
      clearChanges,
      lastPublishedAt,
      publishPhase,
      publishResult,
      startPublish,
      dismissPublishResult,
      saveMode,
      toast,
    ],
  );

  return <PublishContext.Provider value={value}>{children}</PublishContext.Provider>;
}

export function usePublish() {
  const ctx = useContext(PublishContext);
  if (!ctx) {
    throw new Error("usePublish must be used within PublishProvider");
  }
  return ctx;
}
