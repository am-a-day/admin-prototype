import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { catalogItems, catalogSections, type CatalogItem, type CatalogSection } from "@/data/catalog";
import { catalogStorageKey } from "@/lib/catalog-preview";

export type CatalogSaveStatus = "idle" | "saving" | "saved" | "error";

export type CatalogAutosaveState = {
  status: CatalogSaveStatus;
  revision: number;
  savedAt: number | null;
};

type CatalogState = {
  sectionsById: Record<string, CatalogSection>;
  itemsById: Record<string, CatalogItem>;
  sectionOrder: string[];
  itemOrderBySection: Record<string, string[]>;
  autosaveByItem: Record<string, CatalogAutosaveState>;
  revision: number;
};

type CatalogAction =
  | { type: "update-item"; id: string; patch: Partial<CatalogItem>; autosave: boolean }
  | { type: "add-item"; item: CatalogItem }
  | { type: "delete-item"; id: string }
  | { type: "move-item"; id: string; sectionId: string; sectionName: string; index?: number }
  | { type: "set-item-order"; sectionId: string; ids: string[] }
  | { type: "replace-item-order"; order: Record<string, string[]> }
  | { type: "set-autosave"; id: string; status: CatalogSaveStatus };

const STATUS_STORAGE_KEY = catalogStorageKey("statusOverrides");
const SCHEDULE_STORAGE_KEY = catalogStorageKey("scheduleOverrides");
const ITEM_SECTION_STORAGE_KEY = catalogStorageKey("itemSectionOverrides");
const POSITION_ORDER_STORAGE_KEY = catalogStorageKey("positionOrderBySection");
const CREATED_ITEMS_STORAGE_KEY = catalogStorageKey("createdItems");

function readRecord<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function readCreatedItems(): CatalogItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(CREATED_ITEMS_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function buildInitialState(): CatalogState {
  const statusOverrides = readRecord<CatalogItem["status"]>(STATUS_STORAGE_KEY);
  const scheduledOverrides = readRecord<boolean>(SCHEDULE_STORAGE_KEY);
  const sectionOverrides = readRecord<string>(ITEM_SECTION_STORAGE_KEY);
  const storedOrder = readRecord<string[]>(POSITION_ORDER_STORAGE_KEY);
  const sectionsById = Object.fromEntries(catalogSections.map((section) => [section.id, section]));
  const sourceItems = [...catalogItems, ...readCreatedItems()].filter(
    (item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index,
  );
  const items = sourceItems.map((item) => {
    const sectionId = sectionOverrides[item.id] ?? item.sectionId;
    return {
      ...item,
      sectionId,
      sectionName: sectionsById[sectionId]?.name ?? item.sectionName,
      status: statusOverrides[item.id] ?? item.status,
      scheduled: scheduledOverrides[item.id] ?? item.scheduled,
    };
  });
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
  const itemOrderBySection: Record<string, string[]> = {};
  catalogSections.forEach((section) => {
    const actualIds = items.filter((item) => item.sectionId === section.id).map((item) => item.id);
    const persisted = storedOrder[section.id] ?? [];
    itemOrderBySection[section.id] = [
      ...persisted.filter((id) => actualIds.includes(id)),
      ...actualIds.filter((id) => !persisted.includes(id)),
    ];
  });
  return {
    sectionsById,
    itemsById,
    sectionOrder: [...catalogSections].sort((a, b) => a.sortOrder - b.sortOrder).map((section) => section.id),
    itemOrderBySection,
    autosaveByItem: {},
    revision: 0,
  };
}

function nextAutosave(
  current: Record<string, CatalogAutosaveState>,
  id: string,
  status: CatalogSaveStatus,
): Record<string, CatalogAutosaveState> {
  const previous = current[id] ?? { status: "idle", revision: 0, savedAt: null };
  return {
    ...current,
    [id]: {
      status,
      revision: status === "saving" ? previous.revision + 1 : previous.revision,
      savedAt: status === "saved" ? Date.now() : previous.savedAt,
    },
  };
}

function reducer(state: CatalogState, action: CatalogAction): CatalogState {
  if (action.type === "update-item") {
    const item = state.itemsById[action.id];
    if (!item) return state;
    return {
      ...state,
      itemsById: { ...state.itemsById, [action.id]: { ...item, ...action.patch } },
      autosaveByItem: action.autosave
        ? nextAutosave(state.autosaveByItem, action.id, "saving")
        : state.autosaveByItem,
      revision: state.revision + 1,
    };
  }
  if (action.type === "add-item") {
    const currentOrder = state.itemOrderBySection[action.item.sectionId] ?? [];
    return {
      ...state,
      itemsById: { ...state.itemsById, [action.item.id]: action.item },
      itemOrderBySection: {
        ...state.itemOrderBySection,
        [action.item.sectionId]: currentOrder.includes(action.item.id)
          ? currentOrder
          : [...currentOrder, action.item.id],
      },
      autosaveByItem: nextAutosave(state.autosaveByItem, action.item.id, "saved"),
      revision: state.revision + 1,
    };
  }
  if (action.type === "delete-item") {
    if (!state.itemsById[action.id]) return state;
    const itemsById = { ...state.itemsById };
    const autosaveByItem = { ...state.autosaveByItem };
    delete itemsById[action.id];
    delete autosaveByItem[action.id];
    return {
      ...state,
      itemsById,
      itemOrderBySection: Object.fromEntries(
        Object.entries(state.itemOrderBySection).map(([sectionId, ids]) => [
          sectionId,
          ids.filter((id) => id !== action.id),
        ]),
      ),
      autosaveByItem,
      revision: state.revision + 1,
    };
  }
  if (action.type === "move-item") {
    const item = state.itemsById[action.id];
    if (!item) return state;
    const sourceIds = (state.itemOrderBySection[item.sectionId] ?? []).filter((id) => id !== item.id);
    const targetIds = (state.itemOrderBySection[action.sectionId] ?? []).filter((id) => id !== item.id);
    targetIds.splice(Math.max(0, Math.min(action.index ?? targetIds.length, targetIds.length)), 0, item.id);
    return {
      ...state,
      itemsById: {
        ...state.itemsById,
        [item.id]: { ...item, sectionId: action.sectionId, sectionName: action.sectionName },
      },
      itemOrderBySection: {
        ...state.itemOrderBySection,
        [item.sectionId]: sourceIds,
        [action.sectionId]: targetIds,
      },
      revision: state.revision + 1,
    };
  }
  if (action.type === "set-item-order") {
    return {
      ...state,
      itemOrderBySection: { ...state.itemOrderBySection, [action.sectionId]: [...action.ids] },
      revision: state.revision + 1,
    };
  }
  if (action.type === "replace-item-order") {
    return { ...state, itemOrderBySection: action.order, revision: state.revision + 1 };
  }
  return {
    ...state,
    autosaveByItem: nextAutosave(state.autosaveByItem, action.id, action.status),
  };
}

type CatalogStoreValue = CatalogState & {
  sections: CatalogSection[];
  items: CatalogItem[];
  updateItem: (id: string, patch: Partial<CatalogItem>, options?: { autosave?: boolean }) => void;
  addItem: (item: CatalogItem) => void;
  deleteItem: (id: string) => void;
  moveItem: (id: string, sectionId: string, options?: { index?: number; sectionName?: string }) => void;
  archiveItem: (id: string) => void;
  setItemStatus: (id: string, status: CatalogItem["status"], scheduled?: boolean) => void;
  setItemOrder: (sectionId: string, ids: string[]) => void;
  replaceItemOrder: (order: Record<string, string[]>) => void;
  setAutosaveStatus: (id: string, status: CatalogSaveStatus) => void;
  activeEditorItemId: string | null;
  setActiveEditorItemId: (id: string | null) => void;
  mutations: CatalogMutationFacade;
};

export type CatalogMutationFacade = {
  createItem: (item: CatalogItem, order?: Record<string, string[]>) => void;
  updateItem: (id: string, patch: Partial<CatalogItem>, options?: { autosave?: boolean }) => void;
  deleteItem: (id: string) => void;
  deleteItems: (ids: Iterable<string>) => void;
  moveItem: (id: string, sectionId: string, options?: { index?: number; sectionName?: string }) => void;
  moveItems: (ids: Iterable<string>, sectionId: string, options?: { sectionName?: string }) => void;
  setItemStatus: (id: string, status: CatalogItem["status"], scheduled?: boolean) => void;
  reorderItems: (sectionId: string, ids: string[]) => void;
  replaceItemOrder: (order: Record<string, string[]>) => void;
};

const CatalogStoreContext = createContext<CatalogStoreValue | null>(null);

export function CatalogStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const [activeEditorItemId, setActiveEditorItemId] = useState<string | null>(null);

  useEffect(() => {
    const statuses: Record<string, CatalogItem["status"]> = {};
    const scheduled: Record<string, boolean> = {};
    const sections: Record<string, string> = {};
    Object.values(state.itemsById).forEach((item) => {
      statuses[item.id] = item.status;
      scheduled[item.id] = item.scheduled;
      sections[item.id] = item.sectionId;
    });
    window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(statuses));
    window.localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(scheduled));
    window.localStorage.setItem(ITEM_SECTION_STORAGE_KEY, JSON.stringify(sections));
    window.localStorage.setItem(POSITION_ORDER_STORAGE_KEY, JSON.stringify(state.itemOrderBySection));
    window.dispatchEvent(new Event("tasko-catalog-status-change"));
  }, [state.itemsById, state.itemOrderBySection]);

  const updateItem = useCallback((id: string, patch: Partial<CatalogItem>, options?: { autosave?: boolean }) => {
    dispatch({ type: "update-item", id, patch, autosave: options?.autosave ?? true });
  }, []);
  const addItem = useCallback((item: CatalogItem) => dispatch({ type: "add-item", item }), []);
  const deleteItem = useCallback((id: string) => dispatch({ type: "delete-item", id }), []);
  const moveItem = useCallback((id: string, sectionId: string, options?: { index?: number; sectionName?: string }) => {
    const sectionName = options?.sectionName ?? state.sectionsById[sectionId]?.name;
    if (!sectionName) return;
    dispatch({ type: "move-item", id, sectionId, sectionName, index: options?.index });
  }, [state.sectionsById]);
  const archiveItem = useCallback((id: string) => {
    dispatch({ type: "update-item", id, patch: { status: "archive" }, autosave: true });
  }, []);
  const setItemStatus = useCallback((id: string, status: CatalogItem["status"], scheduled?: boolean) => {
    dispatch({
      type: "update-item",
      id,
      patch: { status, ...(scheduled === undefined ? {} : { scheduled }) },
      autosave: true,
    });
  }, []);
  const setItemOrder = useCallback((sectionId: string, ids: string[]) => {
    dispatch({ type: "set-item-order", sectionId, ids });
  }, []);
  const replaceItemOrder = useCallback((order: Record<string, string[]>) => {
    dispatch({ type: "replace-item-order", order });
  }, []);
  const createItem = useCallback((item: CatalogItem, order?: Record<string, string[]>) => {
    dispatch({ type: "add-item", item });
    if (order) dispatch({ type: "replace-item-order", order });
  }, []);
  const deleteItems = useCallback((ids: Iterable<string>) => {
    for (const id of ids) dispatch({ type: "delete-item", id });
  }, []);
  const moveItems = useCallback((ids: Iterable<string>, sectionId: string, options?: { sectionName?: string }) => {
    const sectionName = options?.sectionName ?? state.sectionsById[sectionId]?.name;
    if (!sectionName) return;
    for (const id of ids) dispatch({ type: "move-item", id, sectionId, sectionName });
  }, [state.sectionsById]);
  const mutations = useMemo<CatalogMutationFacade>(() => ({
    createItem,
    updateItem,
    deleteItem,
    deleteItems,
    moveItem,
    moveItems,
    setItemStatus,
    reorderItems: setItemOrder,
    replaceItemOrder,
  }), [createItem, updateItem, deleteItems, moveItem, moveItems, setItemStatus, setItemOrder, replaceItemOrder]);
  const setAutosaveStatus = useCallback((id: string, status: CatalogSaveStatus) => {
    dispatch({ type: "set-autosave", id, status });
  }, []);

  const value = useMemo<CatalogStoreValue>(() => ({
    ...state,
    sections: state.sectionOrder.map((id) => state.sectionsById[id]).filter(Boolean),
    items: Object.values(state.itemsById),
    updateItem,
    addItem,
    deleteItem,
    moveItem,
    archiveItem,
    setItemStatus,
    setItemOrder,
    replaceItemOrder,
    setAutosaveStatus,
    activeEditorItemId,
    setActiveEditorItemId,
    mutations,
  }), [
    state,
    updateItem,
    addItem,
    deleteItem,
    moveItem,
    archiveItem,
    setItemStatus,
    setItemOrder,
    replaceItemOrder,
    setAutosaveStatus,
    activeEditorItemId,
    mutations,
  ]);

  return <CatalogStoreContext.Provider value={value}>{children}</CatalogStoreContext.Provider>;
}

export function useCatalogStore() {
  const value = useContext(CatalogStoreContext);
  if (!value) throw new Error("useCatalogStore must be used inside CatalogStoreProvider");
  return value;
}
