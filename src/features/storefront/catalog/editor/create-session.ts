import { useCallback, useReducer } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CatalogItem } from "@/data/catalog";

export type CreateSessionMode = "structure" | "direct";

export type CreateSessionContext = {
  targetSectionId: string | null;
  returnSectionId?: string | null;
  returnItemId?: string | null;
  returnEditing?: boolean;
};

export type CreateSessionState = {
  mode: CreateSessionMode | null;
  draft: CatalogItem | null;
  context: CreateSessionContext | null;
  dirty: boolean;
  submitting: boolean;
  completedItemId: string | null;
};

export type CreateSessionAction =
  | { type: "begin"; mode: CreateSessionMode; draft: CatalogItem; context: CreateSessionContext; dirty?: boolean }
  | { type: "update-draft"; patch: Partial<CatalogItem> }
  | { type: "set-dirty"; value: SetStateAction<boolean> }
  | { type: "set-submitting"; value: SetStateAction<boolean> }
  | { type: "complete"; createdItemId: string }
  | { type: "cancel" };

const EMPTY_CREATE_SESSION: CreateSessionState = {
  mode: null,
  draft: null,
  context: null,
  dirty: false,
  submitting: false,
  completedItemId: null,
};

function resolveState<T>(value: SetStateAction<T>, current: T): T {
  return typeof value === "function" ? (value as (current: T) => T)(current) : value;
}

export function createSessionReducer(
  state: CreateSessionState,
  action: CreateSessionAction,
): CreateSessionState {
  if (action.type === "begin") {
    return {
      mode: action.mode,
      draft: action.draft,
      context: action.context,
      dirty: action.dirty ?? false,
      submitting: false,
      completedItemId: null,
    };
  }
  if (action.type === "update-draft") {
    return state.draft
      ? { ...state, draft: { ...state.draft, ...action.patch }, dirty: true }
      : state;
  }
  if (action.type === "set-dirty") return { ...state, dirty: resolveState(action.value, state.dirty) };
  if (action.type === "set-submitting") return { ...state, submitting: resolveState(action.value, state.submitting) };
  if (action.type === "complete") return { ...EMPTY_CREATE_SESSION, completedItemId: action.createdItemId };
  return EMPTY_CREATE_SESSION;
}

export function useCreateSession(initialState?: CreateSessionState) {
  const [state, dispatch] = useReducer(createSessionReducer, initialState ?? EMPTY_CREATE_SESSION);
  const begin = useCallback((input: {
    mode: CreateSessionMode;
    draft: CatalogItem;
    context: CreateSessionContext;
    dirty?: boolean;
  }) => dispatch({ type: "begin", ...input }), []);
  const updateDraft = useCallback((patch: Partial<CatalogItem>) => dispatch({ type: "update-draft", patch }), []);
  const setDirty = useCallback<Dispatch<SetStateAction<boolean>>>((value) => dispatch({ type: "set-dirty", value }), []);
  const setSubmitting = useCallback<Dispatch<SetStateAction<boolean>>>((value) => dispatch({ type: "set-submitting", value }), []);
  const complete = useCallback((createdItemId: string) => dispatch({ type: "complete", createdItemId }), []);
  const cancel = useCallback(() => dispatch({ type: "cancel" }), []);

  return {
    ...state,
    draftItem: state.draft,
    creationItemId: state.draft?.id ?? null,
    begin,
    updateDraft,
    setDirty,
    setSubmitting,
    complete,
    cancel,
  };
}
