import { useCallback, useReducer } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DescriptionAuditQueueState } from "./position-editor-host";

export type EditorSessionView = "editor" | "table";

export type EditorSessionState = {
  queue: DescriptionAuditQueueState | null;
  activePositionId: string | null;
  view: EditorSessionView;
};

export function getEditorSessionCurrentId(state: EditorSessionState) {
  return state.queue?.currentId ?? state.activePositionId;
}

type EditorSessionAction =
  | { type: "set-queue"; value: SetStateAction<DescriptionAuditQueueState | null> }
  | { type: "set-active-position"; value: SetStateAction<string | null> }
  | { type: "set-view"; value: SetStateAction<EditorSessionView> };

function resolveState<T>(value: SetStateAction<T>, current: T): T {
  return typeof value === "function" ? (value as (current: T) => T)(current) : value;
}

export function editorSessionReducer(
  state: EditorSessionState,
  action: EditorSessionAction,
): EditorSessionState {
  if (action.type === "set-queue") {
    return { ...state, queue: resolveState(action.value, state.queue) };
  }
  if (action.type === "set-active-position") {
    return { ...state, activePositionId: resolveState(action.value, state.activePositionId) };
  }
  return { ...state, view: resolveState(action.value, state.view) };
}

export function useEditorSession(initialState: EditorSessionState) {
  const [state, dispatch] = useReducer(editorSessionReducer, initialState);
  const setQueue = useCallback<Dispatch<SetStateAction<DescriptionAuditQueueState | null>>>(
    (value) => dispatch({ type: "set-queue", value }),
    [],
  );
  const setActivePositionId = useCallback<Dispatch<SetStateAction<string | null>>>(
    (value) => dispatch({ type: "set-active-position", value }),
    [],
  );
  const setView = useCallback<Dispatch<SetStateAction<EditorSessionView>>>(
    (value) => dispatch({ type: "set-view", value }),
    [],
  );

  return {
    ...state,
    currentId: getEditorSessionCurrentId(state),
    setQueue,
    setActivePositionId,
    setView,
  };
}
