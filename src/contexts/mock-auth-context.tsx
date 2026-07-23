import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MOCK_USER } from "@/data/mock-data";

export type MockWorkspaceStatus = "draft" | "published" | "changes";

export type PublishedMenuSnapshot = {
  version: number;
  publishedAt: number;
  name: string;
  catalogPhase: "empty" | "has-sections" | "has-items";
  catalogSnapshot: Record<string, string>;
};

export type MockWorkspace = {
  name: string;
  status: MockWorkspaceStatus;
  technicalAddress: string;
  webAddress: string;
  privatePreviewAvailable: boolean;
  contactVerified: boolean;
  primaryLanguage: string;
  currency: string;
  timezone: string;
  firstEntry: boolean;
  publishedSnapshot: PublishedMenuSnapshot | null;
};

export type MockAccount = {
  id: string;
  contact: string;
  password?: string | null;
  displayName: string;
  role: string;
  workspace: MockWorkspace;
  catalogSnapshot: Record<string, string>;
};

export type AuthContactKind = "phone" | "email";

type AuthError = { ok: false; error: string };
type ValidatedContact = { ok: true; contact: string };
type AuthSuccess = { ok: true; account: MockAccount };

type MockAuthContextValue = {
  account: MockAccount | null;
  isAuthenticated: boolean;
  validateAuthContact: (contact: string, kind: AuthContactKind) => ValidatedContact | AuthError;
  verifyCode: (contact: string, kind: AuthContactKind, code: string) => AuthSuccess | AuthError;
  loginWithPassword: (contact: string, kind: AuthContactKind, password: string) => AuthSuccess | AuthError;
  logout: () => void;
  resetTestAccount: () => void;
  updateWorkspace: (patch: Partial<MockWorkspace>) => void;
  markDraftChanged: () => void;
  publishWorkspace: (catalogHasVisibleItems: boolean) => boolean;
  choosePrettyAddress: () => void;
  getAccountById: (accountId: string) => MockAccount | null;
};

const AUTH_STATE_KEY = "tasko.mockAuth.v1";
const SESSION_KEY = "tasko.mockAuth.session.v1";
const LOGGED_OUT_SESSION = "__logged_out__";
const SEED_ACCOUNT_ID = "seed-owner";
const DEFAULT_EXISTING_PASSWORD = "tasko123";
const CATALOG_KEY_PREFIX = "tasko.catalog.";

type StoredAuthState = {
  accounts: Record<string, MockAccount>;
  contactIndex: Record<string, string>;
};

function stableMenuId(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36).padStart(6, "0").slice(0, 6);
}

function getBrowserTimezone() {
  if (typeof Intl === "undefined") return "Asia/Almaty";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Almaty";
}

const createWorkspace = (firstEntry: boolean, seed: string): MockWorkspace => ({
  name: firstEntry ? "Новое меню" : "Kimchi Astana",
  status: firstEntry ? "draft" : "published",
  technicalAddress: `tasko.menu/m/${stableMenuId(seed)}`,
  webAddress: firstEntry ? "" : "kimchi.tasko.app",
  privatePreviewAvailable: true,
  contactVerified: !firstEntry,
  primaryLanguage: "ru",
  currency: "KZT",
  timezone: getBrowserTimezone(),
  firstEntry,
  publishedSnapshot: firstEntry
    ? null
    : {
        version: 1,
        publishedAt: Date.now(),
        name: "Kimchi Astana",
        catalogPhase: "has-items",
        catalogSnapshot: {},
      },
});

const createSeedAccount = (): MockAccount => ({
  id: SEED_ACCOUNT_ID,
  contact: MOCK_USER.email,
  password: DEFAULT_EXISTING_PASSWORD,
  displayName: MOCK_USER.name,
  role: MOCK_USER.role,
  workspace: createWorkspace(false, MOCK_USER.email),
  catalogSnapshot: {},
});

const createAccount = (contact: string): MockAccount => {
  const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    contact,
    password: null,
    displayName: contact.includes("@") ? contact : `Пользователь ${contact.slice(-4)}`,
    role: "Владелец",
    workspace: {
      ...createWorkspace(true, contact),
      contactVerified: true,
    },
    catalogSnapshot: {},
  };
};

function normalizeContact(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed.replace(/\s+/g, "");
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function validateContact(value: string, kind: AuthContactKind): ValidatedContact | AuthError {
  const contact = normalizeContact(value);
  if (kind === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)
      ? { ok: true, contact }
      : { ok: false, error: "Введите корректный email." };
  }
  const phoneDigits = contact.replace(/\D/g, "");
  return phoneDigits.length >= 10 && phoneDigits.length <= 15
    ? { ok: true, contact }
    : { ok: false, error: "Введите номер телефона: от 10 до 15 цифр." };
}

function readAuthState(): StoredAuthState {
  if (typeof window === "undefined") {
    const seed = createSeedAccount();
    return { accounts: { [seed.id]: seed }, contactIndex: { [normalizeContact(seed.contact)]: seed.id } };
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredAuthState;
      if (parsed.accounts && parsed.contactIndex) {
        const accounts = Object.fromEntries(
          Object.entries(parsed.accounts).map(([id, account]) => {
            const fallback = createWorkspace(account.workspace.firstEntry ?? false, account.contact || id);
            const legacyStatus = account.workspace.status as string;
            const status: MockWorkspaceStatus =
              legacyStatus === "published"
                ? "published"
                : legacyStatus === "changes"
                  ? "changes"
                  : "draft";
            const publishedSnapshot =
              account.workspace.publishedSnapshot ??
              (status === "published"
                ? {
                    version: 1,
                    publishedAt: Date.now(),
                    name: account.workspace.name || fallback.name,
                    catalogPhase: "has-items" as const,
                    catalogSnapshot: account.catalogSnapshot ?? {},
                  }
                : null);
            return [
              id,
              {
                ...account,
                password: Object.prototype.hasOwnProperty.call(account, "password")
                  ? account.password
                  : account.workspace.contactVerified
                    ? DEFAULT_EXISTING_PASSWORD
                    : null,
                workspace: {
                  ...fallback,
                  ...account.workspace,
                  status,
                  technicalAddress: account.workspace.technicalAddress || fallback.technicalAddress,
                  currency: account.workspace.currency || fallback.currency,
                  timezone: account.workspace.timezone || fallback.timezone,
                  publishedSnapshot,
                },
              },
            ];
          }),
        );
        const contactIndex = Object.fromEntries(
          Object.values(accounts).map((account) => [normalizeContact(account.contact), account.id]),
        );
        const migrated = { ...parsed, accounts, contactIndex };
        writeAuthState(migrated);
        return migrated;
      }
    }
  } catch {
    // Ignore malformed prototype state.
  }

  const seed = createSeedAccount();
  return { accounts: { [seed.id]: seed }, contactIndex: { [normalizeContact(seed.contact)]: seed.id } };
}

function writeAuthState(state: StoredAuthState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(state));
}

function readSessionId() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(SESSION_KEY);
  if (stored === LOGGED_OUT_SESSION) return null;
  return stored;
}

function writeSessionId(accountId: string | null) {
  if (typeof window === "undefined") return;
  if (accountId) window.localStorage.setItem(SESSION_KEY, accountId);
  else window.localStorage.setItem(SESSION_KEY, LOGGED_OUT_SESSION);
}

function snapshotCatalog() {
  const snapshot: Record<string, string> = {};
  if (typeof window === "undefined") return snapshot;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(CATALOG_KEY_PREFIX)) continue;
    const value = window.localStorage.getItem(key);
    if (value != null) snapshot[key] = value;
  }
  return snapshot;
}

function clearCatalogState() {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(CATALOG_KEY_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
}

function restoreCatalogState(snapshot: Record<string, string>) {
  if (typeof window === "undefined") return;
  clearCatalogState();
  Object.entries(snapshot).forEach(([key, value]) => window.localStorage.setItem(key, value));
}

function upsertAccountWithSnapshot(state: StoredAuthState, account: MockAccount | null) {
  if (!account) return state;
  const next = {
    ...state,
    accounts: {
      ...state.accounts,
      [account.id]: { ...account, catalogSnapshot: snapshotCatalog() },
    },
  };
  writeAuthState(next);
  return next;
}

const MockAuthContext = createContext<MockAuthContextValue | null>(null);

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<StoredAuthState>(() => readAuthState());
  const [sessionId, setSessionId] = useState<string | null>(() => readSessionId());
  const account = sessionId ? authState.accounts[sessionId] ?? null : null;

  const setActiveAccount = useCallback((nextAccount: MockAccount) => {
    setAuthState((prev) => {
      const next = {
        accounts: { ...prev.accounts, [nextAccount.id]: nextAccount },
        contactIndex: { ...prev.contactIndex, [normalizeContact(nextAccount.contact)]: nextAccount.id },
      };
      writeAuthState(next);
      return next;
    });
    restoreCatalogState(nextAccount.catalogSnapshot);
    setSessionId(nextAccount.id);
    writeSessionId(nextAccount.id);
  }, []);

  const validateAuthContact = useCallback(
    (rawContact: string, kind: AuthContactKind) => validateContact(rawContact, kind),
    [],
  );

  const verifyCode = useCallback(
    (rawContact: string, kind: AuthContactKind, code: string) => {
      const validation = validateContact(rawContact, kind);
      if (!validation.ok) return validation;
      if (!/^\d{6}$/.test(code)) {
        return { ok: false as const, error: "Введите полный шестизначный код." };
      }

      const currentState = upsertAccountWithSnapshot(authState, account);
      const existingId = currentState.contactIndex[validation.contact];
      const nextAccount = existingId
        ? currentState.accounts[existingId]
        : createAccount(validation.contact);
      setAuthState(currentState);
      const verifiedAccount = {
        ...nextAccount,
        workspace: { ...nextAccount.workspace, contactVerified: true },
      };
      setActiveAccount(verifiedAccount);
      return { ok: true as const, account: verifiedAccount };
    },
    [account, authState, setActiveAccount],
  );

  const loginWithPassword = useCallback(
    (rawContact: string, kind: AuthContactKind, password: string) => {
      const validation = validateContact(rawContact, kind);
      if (!validation.ok) return validation;

      const currentState = upsertAccountWithSnapshot(authState, account);
      const existingId = currentState.contactIndex[validation.contact];
      const existingAccount = existingId ? currentState.accounts[existingId] : null;
      if (!existingAccount) {
        return { ok: false as const, error: "Аккаунт не найден. Войдите по коду, чтобы создать его." };
      }
      if (!existingAccount.workspace.contactVerified) {
        return { ok: false as const, error: "Сначала подтвердите контакт кодом." };
      }
      if (!existingAccount.password) {
        return { ok: false as const, error: "Для этого аккаунта пароль не настроен. Войдите по коду." };
      }
      if (existingAccount.password !== password) {
        return { ok: false as const, error: "Неверный пароль." };
      }

      setAuthState(currentState);
      setActiveAccount(existingAccount);
      return { ok: true as const, account: existingAccount };
    },
    [account, authState, setActiveAccount],
  );

  const logout = useCallback(() => {
    setAuthState((prev) => upsertAccountWithSnapshot(prev, account));
    setSessionId(null);
    writeSessionId(null);
  }, [account]);

  const resetTestAccount = useCallback(() => {
    if (!account) return;
    setAuthState((prev) => {
      const accounts = { ...prev.accounts };
      const contactIndex = { ...prev.contactIndex };
      delete accounts[account.id];
      delete contactIndex[normalizeContact(account.contact)];
      const next = { accounts, contactIndex };
      writeAuthState(next);
      return next;
    });
    clearCatalogState();
    window.localStorage.removeItem(`tasko.publish.changes.${account.id}`);
    setSessionId(null);
    writeSessionId(null);
    window.localStorage.removeItem("tasko.firstEntryChecklist.dismissed");
  }, [account]);

  const updateWorkspace = useCallback(
    (patch: Partial<MockWorkspace>) => {
      if (!account) return;
      setAuthState((prev) => {
        const current = prev.accounts[account.id];
        if (!current) return prev;
        const nextAccount = {
          ...current,
          workspace: { ...current.workspace, ...patch },
        };
        const next = { ...prev, accounts: { ...prev.accounts, [account.id]: nextAccount } };
        writeAuthState(next);
        return next;
      });
    },
    [account],
  );

  const markDraftChanged = useCallback(() => {
    if (account?.workspace.status === "published") {
      updateWorkspace({ status: "changes" });
    }
  }, [account?.workspace.status, updateWorkspace]);

  const publishWorkspace = useCallback(
    (catalogHasVisibleItems: boolean) => {
      if (!account || !catalogHasVisibleItems) return false;
      const previousVersion = account.workspace.publishedSnapshot?.version ?? 0;
      updateWorkspace({
        status: "published",
        firstEntry: false,
        publishedSnapshot: {
          version: previousVersion + 1,
          publishedAt: Date.now(),
          name: account.workspace.name || "Новое меню",
          catalogPhase: "has-items",
          catalogSnapshot: snapshotCatalog(),
        },
      });
      return true;
    },
    [account, updateWorkspace],
  );

  const choosePrettyAddress = useCallback(() => {
    if (!account || account.workspace.webAddress) return;
    const slug = account.workspace.name === "Новое меню"
      ? `menu-${stableMenuId(account.contact)}`
      : account.workspace.name
          .toLowerCase()
          .replace(/[^a-z0-9а-яё]+/gi, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 28);
    updateWorkspace({ webAddress: `${slug || `menu-${stableMenuId(account.contact)}`}.tasko.menu` });
  }, [account, updateWorkspace]);

  const getAccountById = useCallback(
    (accountId: string) => authState.accounts[accountId] ?? null,
    [authState.accounts],
  );

  const value = useMemo<MockAuthContextValue>(
    () => ({
      account,
      isAuthenticated: Boolean(account),
      validateAuthContact,
      verifyCode,
      loginWithPassword,
      logout,
      resetTestAccount,
      updateWorkspace,
      markDraftChanged,
      publishWorkspace,
      choosePrettyAddress,
      getAccountById,
    }),
    [
      account,
      validateAuthContact,
      verifyCode,
      loginWithPassword,
      logout,
      resetTestAccount,
      updateWorkspace,
      markDraftChanged,
      publishWorkspace,
      choosePrettyAddress,
      getAccountById,
    ],
  );

  return <MockAuthContext.Provider value={value}>{children}</MockAuthContext.Provider>;
}

export function useMockAuth() {
  const ctx = useContext(MockAuthContext);
  if (!ctx) throw new Error("useMockAuth must be used within MockAuthProvider");
  return ctx;
}
