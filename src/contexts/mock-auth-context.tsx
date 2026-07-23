import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MOCK_USER } from "@/data/mock-data";

type MockWorkspaceStatus = "unpublished" | "review" | "published";

type MockWorkspace = {
  name: string;
  status: MockWorkspaceStatus;
  webAddress: string;
  privatePreviewAvailable: boolean;
  contactVerified: boolean;
  primaryLanguage: string;
  currency: string;
  firstEntry: boolean;
  sentForReview: boolean;
};

type MockAccount = {
  id: string;
  contact: string;
  displayName: string;
  role: string;
  workspace: MockWorkspace;
  catalogSnapshot: Record<string, string>;
};

type PublishRequirement = {
  id: string;
  label: string;
  section: "storefront" | "management";
  tab: string;
};

type MockAuthContextValue = {
  account: MockAccount | null;
  isAuthenticated: boolean;
  loginWithContact: (contact: string) => { ok: true; account: MockAccount } | { ok: false; error: string };
  loginWithGoogle: () => void;
  logout: () => void;
  resetTestAccount: () => void;
  updateWorkspace: (patch: Partial<MockWorkspace>) => void;
  getPublishRequirements: (catalogHasContent: boolean) => PublishRequirement[];
  markSentForReview: () => void;
};

const AUTH_STATE_KEY = "tasko.mockAuth.v1";
const SESSION_KEY = "tasko.mockAuth.session.v1";
const SEED_ACCOUNT_ID = "seed-owner";
const GOOGLE_CONTACT = "owner.google@tasko.test";
const CATALOG_KEY_PREFIX = "tasko.catalog.";

type StoredAuthState = {
  accounts: Record<string, MockAccount>;
  contactIndex: Record<string, string>;
};

const createWorkspace = (firstEntry: boolean): MockWorkspace => ({
  name: firstEntry ? "Новое меню" : "Kimchi Astana",
  status: firstEntry ? "unpublished" : "published",
  webAddress: firstEntry ? "" : "kimchi.tasko.app",
  privatePreviewAvailable: true,
  contactVerified: !firstEntry,
  primaryLanguage: "ru",
  currency: firstEntry ? "" : "KZT",
  firstEntry,
  sentForReview: false,
});

const createSeedAccount = (): MockAccount => ({
  id: SEED_ACCOUNT_ID,
  contact: MOCK_USER.email,
  displayName: MOCK_USER.name,
  role: MOCK_USER.role,
  workspace: createWorkspace(false),
  catalogSnapshot: {},
});

const createAccount = (contact: string): MockAccount => {
  const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    contact,
    displayName: contact.includes("@") ? contact : `Пользователь ${contact.slice(-4)}`,
    role: "Владелец",
    workspace: createWorkspace(true),
    catalogSnapshot: {},
  };
};

function normalizeContact(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function validateContact(value: string) {
  const contact = normalizeContact(value);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const phoneDigits = contact.replace(/[^\d]/g, "");
  const phoneOk = phoneDigits.length >= 10 && phoneDigits.length <= 15 && /^[+\d() -]+$/.test(value.trim());
  if (emailOk || phoneOk) return { ok: true as const, contact };
  return {
    ok: false as const,
    error: "Введите email или телефон: минимум 10 цифр, можно с +, пробелами и скобками.",
  };
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
      if (parsed.accounts && parsed.contactIndex) return parsed;
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
  if (typeof window === "undefined") return SEED_ACCOUNT_ID;
  return window.localStorage.getItem(SESSION_KEY) ?? SEED_ACCOUNT_ID;
}

function writeSessionId(accountId: string | null) {
  if (typeof window === "undefined") return;
  if (accountId) window.localStorage.setItem(SESSION_KEY, accountId);
  else window.localStorage.removeItem(SESSION_KEY);
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

  const loginWithContact = useCallback(
    (rawContact: string) => {
      const validation = validateContact(rawContact);
      if (!validation.ok) return validation;

      const currentState = upsertAccountWithSnapshot(authState, account);
      const existingId = currentState.contactIndex[validation.contact];
      const nextAccount = existingId ? currentState.accounts[existingId] : createAccount(validation.contact);
      setAuthState(currentState);
      setActiveAccount(nextAccount);
      return { ok: true as const, account: nextAccount };
    },
    [account, authState, setActiveAccount],
  );

  const loginWithGoogle = useCallback(() => {
    const currentState = upsertAccountWithSnapshot(authState, account);
    const existingId = currentState.contactIndex[GOOGLE_CONTACT];
    const nextAccount = existingId ? currentState.accounts[existingId] : createAccount(GOOGLE_CONTACT);
    setAuthState(currentState);
    setActiveAccount({
      ...nextAccount,
      displayName: "Google Tasko Owner",
      contact: GOOGLE_CONTACT,
    });
  }, [account, authState, setActiveAccount]);

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

  const getPublishRequirements = useCallback(
    (catalogHasContent: boolean): PublishRequirement[] => {
      if (!account) return [];
      const missing: PublishRequirement[] = [];
      if (!account.workspace.name.trim() || account.workspace.name === "Новое меню") {
        missing.push({ id: "name", label: "Укажите название заведения", section: "management", tab: "account" });
      }
      if (!catalogHasContent) {
        missing.push({ id: "catalog", label: "Добавьте хотя бы один раздел или позицию", section: "storefront", tab: "catalog" });
      }
      if (!account.workspace.primaryLanguage) {
        missing.push({ id: "language", label: "Выберите основной язык", section: "storefront", tab: "about" });
      }
      if (!account.workspace.currency) {
        missing.push({ id: "currency", label: "Укажите валюту", section: "management", tab: "account" });
      }
      if (!account.workspace.webAddress.trim()) {
        missing.push({ id: "address", label: "Выберите веб-адрес", section: "storefront", tab: "launch" });
      }
      if (!account.workspace.contactVerified) {
        missing.push({ id: "contact", label: "Подтвердите контакт", section: "management", tab: "account" });
      }
      return missing;
    },
    [account],
  );

  const markSentForReview = useCallback(() => {
    updateWorkspace({ status: "review", sentForReview: true });
  }, [updateWorkspace]);

  const value = useMemo<MockAuthContextValue>(
    () => ({
      account,
      isAuthenticated: Boolean(account),
      loginWithContact,
      loginWithGoogle,
      logout,
      resetTestAccount,
      updateWorkspace,
      getPublishRequirements,
      markSentForReview,
    }),
    [
      account,
      loginWithContact,
      loginWithGoogle,
      logout,
      resetTestAccount,
      updateWorkspace,
      getPublishRequirements,
      markSentForReview,
    ],
  );

  return <MockAuthContext.Provider value={value}>{children}</MockAuthContext.Provider>;
}

export function useMockAuth() {
  const ctx = useContext(MockAuthContext);
  if (!ctx) throw new Error("useMockAuth must be used within MockAuthProvider");
  return ctx;
}
