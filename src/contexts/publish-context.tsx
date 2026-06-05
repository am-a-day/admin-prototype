import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

/** Staged apply flow for the «change model» experiment. */
export type ApplyPhase = "idle" | "saving" | "updating" | "done" | "error";

type ToastState = { id: number; text: string } | null;

type ChangeEntry = { page: PageKey; label: string; count: number };

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
  // ── «Change model» experiment — staged apply (save → update storefront) ──
  applyPhase: ApplyPhase;
  /** Run the staged apply: saving → updating → done | error. */
  apply: (opts?: { failUpdate?: boolean }) => void;
  /** Retry the storefront update after an error. */
  retryUpdate: () => void;
  /** Discard unsaved edits (Save + Live «Отменить»). */
  discardChanges: () => void;
  /** Счётчик «подёргиваний» save bar — растёт при попытке уйти без сохранения. */
  saveNudge: number;
  /** Заблокировать переход и привлечь внимание к save bar (shake + flash). */
  nudgeSave: () => void;
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

const PublishContext = createContext<PublishContextValue | null>(null);

export function PublishProvider({ children }: { children: ReactNode }) {
  const [changes, setChanges] = useState<Record<PageKey, number>>(emptyChanges);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishVersion, setPublishVersion] = useState(0);
  const [lastChangeAt, setLastChangeAt] = useState<number | null>(null);
  const [saveMode, setSaveMode] = useState<SaveMode>("toast");
  const [toast, setToast] = useState<ToastState>(null);
  const [applyPhase, setApplyPhase] = useState<ApplyPhase>("idle");
  const [saveNudge, setSaveNudge] = useState(0);
  const savingTimerRef = useRef<number | null>(null);
  const toastIdRef = useRef(0);
  const applyTimers = useRef<number[]>([]);

  const registerChange = useCallback(
    (page: PageKey) => {
      setChanges((prev) => ({ ...prev, [page]: prev[page] + 1 }));
      setLastChangeAt(Date.now());

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
    [saveMode],
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

  // ── Staged apply ──────────────────────────────────────────────────────────
  const clearApplyTimers = () => {
    applyTimers.current.forEach((t) => window.clearTimeout(t));
    applyTimers.current = [];
  };

  const finishUpdateSuccess = useCallback(() => {
    setChanges(emptyChanges());
    setLastChangeAt(null);
    setPublishVersion((v) => v + 1);
    setApplyPhase("done");
    applyTimers.current.push(
      window.setTimeout(() => setApplyPhase("idle"), 1600),
    );
  }, []);

  const apply = useCallback(
    (opts?: { failUpdate?: boolean }) => {
      clearApplyTimers();
      setApplyPhase("saving");
      applyTimers.current.push(
        window.setTimeout(() => setApplyPhase("updating"), 750),
      );
      applyTimers.current.push(
        window.setTimeout(() => {
          if (opts?.failUpdate) {
            setApplyPhase("error"); // changes kept — guests still on old version
          } else {
            finishUpdateSuccess();
          }
        }, 1650),
      );
    },
    [finishUpdateSuccess],
  );

  const retryUpdate = useCallback(() => {
    clearApplyTimers();
    setApplyPhase("updating");
    applyTimers.current.push(
      window.setTimeout(() => finishUpdateSuccess(), 950),
    );
  }, [finishUpdateSuccess]);

  const discardChanges = useCallback(() => {
    clearApplyTimers();
    setChanges(emptyChanges());
    setLastChangeAt(null);
    setApplyPhase("idle");
    setPublishVersion((v) => v + 1); // re-arm the change tracker
  }, []);

  const nudgeSave = useCallback(() => setSaveNudge((n) => n + 1), []);

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
      applyPhase,
      apply,
      retryUpdate,
      discardChanges,
      saveNudge,
      nudgeSave,
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
      applyPhase,
      apply,
      retryUpdate,
      discardChanges,
      saveNudge,
      nudgeSave,
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
