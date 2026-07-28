import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MOCK_USER } from "@/data/mock-data";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
import { getRegistrationMarket } from "@/lib/registration-market";

export type MockWorkspaceStatus = "draft" | "published" | "changes";
export type OrganizationType = "restaurant" | "store" | "services" | "other";
export type WorkspaceLanguageStatus = "empty" | "partial" | "ready";

export type WorkspaceLanguage = {
  code: LanguageCode;
  status: WorkspaceLanguageStatus;
  visible: boolean;
};

export type PublishedMenuSnapshot = {
  version: number;
  publishedAt: number;
  name: string;
  catalogPhase: "empty" | "has-sections" | "has-items";
  catalogSnapshot: Record<string, string>;
  publishedLanguages: LanguageCode[];
  localizedNames: Partial<Record<LanguageCode, string>>;
};

export type MockWorkspace = {
  name: string;
  status: MockWorkspaceStatus;
  technicalAddress: string;
  webAddress: string;
  privatePreviewAvailable: boolean;
  contactVerified: boolean;
  setupCompleted: boolean;
  organizationType: OrganizationType;
  primaryLanguage: LanguageCode;
  languages: WorkspaceLanguage[];
  localizedNames: Partial<Record<LanguageCode, string>>;
  currency: string;
  timezone: string;
  market: "Kazakhstan" | "Serbia";
  marketCode: "KZ" | "RS";
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
export type AuthResolution = "existing" | "created";

type AuthError = { ok: false; error: string };
type ValidatedContact = { ok: true; contact: string };
type AuthSuccess = { ok: true; account: MockAccount; resolution: AuthResolution };
type VerifyCodeOptions = {
  registrationLanguage?: LanguageCode;
  registrationHostname?: string;
};

type MockAuthContextValue = {
  account: MockAccount | null;
  isAuthenticated: boolean;
  authResolution: AuthResolution | null;
  dismissAuthResolution: () => void;
  validateAuthContact: (contact: string, kind: AuthContactKind) => ValidatedContact | AuthError;
  verifyCode: (
    contact: string,
    kind: AuthContactKind,
    code: string,
    options?: VerifyCodeOptions,
  ) => AuthSuccess | AuthError;
  loginWithPassword: (contact: string, kind: AuthContactKind, password: string) => AuthSuccess | AuthError;
  completeWorkspaceSetup: (organizationType: OrganizationType, primaryLanguage: LanguageCode) => void;
  addWorkspaceLanguage: (language: LanguageCode) => void;
  setWorkspaceLanguageVisibility: (language: LanguageCode, visible: boolean) => void;
  removeWorkspaceLanguage: (language: LanguageCode) => void;
  setWorkspaceLanguageHasContent: (language: LanguageCode, hasContent: boolean) => void;
  updateWorkspaceNameTranslation: (language: LanguageCode, name: string) => void;
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
const SEED_PHONE_ACCOUNT_ID = "seed-phone-owner";
const SEED_PHONE_CONTACT = "+79950876356";
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

const createWorkspace = (firstEntry: boolean, seed: string, setupCompleted = true): MockWorkspace => ({
  name: firstEntry ? "Новое меню" : "Kimchi Astana",
  status: firstEntry ? "draft" : "published",
  technicalAddress: `tasko.menu/m/${stableMenuId(seed)}`,
  webAddress: firstEntry ? "" : "kimchi.tasko.app",
  privatePreviewAvailable: true,
  contactVerified: !firstEntry,
  setupCompleted,
  organizationType: "restaurant",
  primaryLanguage: "ru",
  languages: setupCompleted
    ? LANGUAGES.map(({ code }) => ({ code, status: "ready" as const, visible: true }))
    : [],
  localizedNames: setupCompleted ? { ru: firstEntry ? "Новое меню" : "Kimchi Astana" } : {},
  currency: "KZT",
  timezone: getBrowserTimezone(),
  market: "Kazakhstan",
  marketCode: "KZ",
  firstEntry,
  publishedSnapshot: firstEntry
    ? null
    : {
        version: 1,
        publishedAt: Date.now(),
        name: "Kimchi Astana",
        catalogPhase: "has-items",
        catalogSnapshot: {},
        publishedLanguages: LANGUAGES.map(({ code }) => code),
        localizedNames: { ru: "Kimchi Astana" },
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

const createSeedPhoneAccount = (): MockAccount => ({
  id: SEED_PHONE_ACCOUNT_ID,
  contact: SEED_PHONE_CONTACT,
  password: DEFAULT_EXISTING_PASSWORD,
  displayName: "Тестовый владелец",
  role: "Владелец",
  workspace: createWorkspace(false, SEED_PHONE_CONTACT),
  catalogSnapshot: {},
});

function stableRestaurantSuffix(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (Math.imul(hash, 31) + seed.charCodeAt(index)) >>> 0;
  }
  return String(hash % 10000).padStart(4, "0");
}

const createAccount = (
  contact: string,
  registrationLanguage: LanguageCode,
  registrationHostname: string,
): MockAccount => {
  const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const marketDefaults = getRegistrationMarket(registrationHostname);
  const workspaceName = `Мой ресторан ${stableRestaurantSuffix(contact)}`;
  return {
    id,
    contact,
    password: null,
    displayName: contact.includes("@") ? contact : `Пользователь ${contact.slice(-4)}`,
    role: "Владелец",
    workspace: {
      ...createWorkspace(true, contact, false),
      name: workspaceName,
      status: "draft",
      technicalAddress: `${marketDefaults.menuDomain}/m/${stableMenuId(contact)}`,
      contactVerified: true,
      setupCompleted: true,
      organizationType: "restaurant",
      primaryLanguage: registrationLanguage,
      languages: [{ code: registrationLanguage, status: "ready", visible: true }],
      localizedNames: { [registrationLanguage]: workspaceName },
      currency: marketDefaults.currency,
      timezone: marketDefaults.timezone,
      market: marketDefaults.market,
      marketCode: marketDefaults.marketCode,
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
    const phoneSeed = createSeedPhoneAccount();
    return {
      accounts: { [seed.id]: seed, [phoneSeed.id]: phoneSeed },
      contactIndex: {
        [normalizeContact(seed.contact)]: seed.id,
        [normalizeContact(phoneSeed.contact)]: phoneSeed.id,
      },
    };
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredAuthState;
      if (parsed.accounts && parsed.contactIndex) {
        const accounts: Record<string, MockAccount> = Object.fromEntries(
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
                    publishedLanguages: LANGUAGES.map(({ code }) => code),
                    localizedNames: account.workspace.localizedNames ?? {
                      [account.workspace.primaryLanguage ?? "ru"]: account.workspace.name || fallback.name,
                    },
                  }
                : null);
            const primaryLanguage = LANGUAGES.some(({ code }) => code === account.workspace.primaryLanguage)
              ? account.workspace.primaryLanguage as LanguageCode
              : "ru";
            const languages = account.workspace.languages?.length
              ? account.workspace.languages.map((language) => ({
                  ...language,
                  visible: language.visible ?? true,
                }))
              : LANGUAGES.map(({ code }) => ({ code, status: "ready" as const, visible: true }));
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
                  setupCompleted: account.workspace.setupCompleted ?? true,
                  organizationType: account.workspace.organizationType ?? "restaurant",
                  primaryLanguage,
                  languages,
                  localizedNames: account.workspace.localizedNames ?? {
                    [primaryLanguage]: account.workspace.name || fallback.name,
                  },
                  currency: account.workspace.currency || fallback.currency,
                  timezone: account.workspace.timezone || fallback.timezone,
                  market: account.workspace.market ?? fallback.market,
                  marketCode: account.workspace.marketCode ?? fallback.marketCode,
                  publishedSnapshot: publishedSnapshot
                    ? {
                        ...publishedSnapshot,
                        publishedLanguages:
                          publishedSnapshot.publishedLanguages?.length
                            ? publishedSnapshot.publishedLanguages
                            : LANGUAGES.map(({ code }) => code),
                        localizedNames: publishedSnapshot.localizedNames ?? {
                          [primaryLanguage]: publishedSnapshot.name,
                        },
                      }
                    : null,
                },
              },
            ];
          }),
        );
        const phoneSeed = createSeedPhoneAccount();
        if (!accounts[phoneSeed.id]) accounts[phoneSeed.id] = phoneSeed;
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
  const phoneSeed = createSeedPhoneAccount();
  return {
    accounts: { [seed.id]: seed, [phoneSeed.id]: phoneSeed },
    contactIndex: {
      [normalizeContact(seed.contact)]: seed.id,
      [normalizeContact(phoneSeed.contact)]: phoneSeed.id,
    },
  };
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
  const [authResolution, setAuthResolution] = useState<AuthResolution | null>(null);
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

  const updateWorkspaceAccount = useCallback((
    accountId: string,
    update: (workspace: MockWorkspace) => MockWorkspace,
  ) => {
    setAuthState((prev) => {
      const current = prev.accounts[accountId];
      if (!current) return prev;
      const next = {
        ...prev,
        accounts: {
          ...prev.accounts,
          [accountId]: { ...current, workspace: update(current.workspace) },
        },
      };
      writeAuthState(next);
      return next;
    });
  }, []);

  const validateAuthContact = useCallback(
    (rawContact: string, kind: AuthContactKind) => validateContact(rawContact, kind),
    [],
  );

  const verifyCode = useCallback(
    (
      rawContact: string,
      kind: AuthContactKind,
      code: string,
      options: VerifyCodeOptions = {},
    ) => {
      const validation = validateContact(rawContact, kind);
      if (!validation.ok) return validation;
      if (!/^\d{6}$/.test(code)) {
        return { ok: false as const, error: "Введите полный шестизначный код." };
      }

      const currentState = upsertAccountWithSnapshot(authState, account);
      const existingId = currentState.contactIndex[validation.contact];
      if (kind === "email" && !existingId) {
        return { ok: false as const, error: "Аккаунт с такой почтой не найден." };
      }
      const resolution: AuthResolution = existingId ? "existing" : "created";
      const nextAccount = existingId
        ? currentState.accounts[existingId]
        : createAccount(
            validation.contact,
            options.registrationLanguage ?? "ru",
            options.registrationHostname ?? window.location.hostname,
          );
      setAuthState(currentState);
      const verifiedAccount = {
        ...nextAccount,
        workspace: { ...nextAccount.workspace, contactVerified: true },
      };
      setActiveAccount(verifiedAccount);
      setAuthResolution(resolution);
      return { ok: true as const, account: verifiedAccount, resolution };
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
      setAuthResolution("existing");
      return { ok: true as const, account: existingAccount, resolution: "existing" as const };
    },
    [account, authState, setActiveAccount],
  );

  const completeWorkspaceSetup = useCallback(
    (organizationType: OrganizationType, primaryLanguage: LanguageCode) => {
      if (!account || account.workspace.setupCompleted) return;
      const name =
        organizationType === "restaurant"
          ? "Новое меню"
          : organizationType === "store"
            ? "Новая витрина магазина"
            : organizationType === "services"
              ? "Новая витрина услуг"
              : "Новая витрина";
      updateWorkspaceAccount(account.id, (workspace) => ({
        ...workspace,
        name,
        setupCompleted: true,
        organizationType,
        primaryLanguage,
        languages: [{ code: primaryLanguage, status: "ready", visible: true }],
        localizedNames: { [primaryLanguage]: name },
      }));
    },
    [account],
  );

  const addWorkspaceLanguage = useCallback(
    (language: LanguageCode) => {
      if (!account || account.workspace.languages.some(({ code }) => code === language)) return;
      updateWorkspaceAccount(account.id, (workspace) => {
        if (workspace.languages.some(({ code }) => code === language)) return workspace;
        return {
          ...workspace,
          languages: [...workspace.languages, { code: language, status: "empty", visible: true }],
        };
      });
    },
    [account],
  );

  const setWorkspaceLanguageVisibility = useCallback(
    (language: LanguageCode, visible: boolean) => {
      if (!account || language === account.workspace.primaryLanguage) return;
      updateWorkspaceAccount(account.id, (workspace) => ({
        ...workspace,
        languages: workspace.languages.map((item) =>
          item.code === language ? { ...item, visible } : item,
        ),
      }));
    },
    [account, updateWorkspaceAccount],
  );

  const removeWorkspaceLanguage = useCallback(
    (language: LanguageCode) => {
      if (!account || language === account.workspace.primaryLanguage) return;
      const translationPrefix = `tasko.catalog.translations.${account.id}.`;
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key?.startsWith(translationPrefix)) continue;
        try {
          const translations = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, string>;
          delete translations[language];
          window.localStorage.setItem(key, JSON.stringify(translations));
        } catch {
          // Ignore malformed prototype translation data.
        }
      }
      updateWorkspaceAccount(account.id, (workspace) => {
        const localizedNames = { ...workspace.localizedNames };
        delete localizedNames[language];
        return {
          ...workspace,
          localizedNames,
          languages: workspace.languages.filter(({ code }) => code !== language),
        };
      });
    },
    [account, updateWorkspaceAccount],
  );

  const updateWorkspaceNameTranslation = useCallback(
    (language: LanguageCode, rawName: string) => {
      if (!account) return;
      const name = rawName.trim();
      updateWorkspaceAccount(account.id, (workspace) => ({
        ...workspace,
        name: language === workspace.primaryLanguage && name ? name : workspace.name,
        localizedNames: {
          ...workspace.localizedNames,
          [language]: name,
        },
        languages: workspace.languages.map((item) =>
          item.code === language && item.code !== workspace.primaryLanguage
            ? { ...item, status: name ? "ready" : "partial" }
            : item,
        ),
      }));
    },
    [account, updateWorkspaceAccount],
  );

  const setWorkspaceLanguageHasContent = useCallback(
    (language: LanguageCode, hasContent: boolean) => {
      if (!account || language === account.workspace.primaryLanguage) return;
      updateWorkspaceAccount(account.id, (workspace) => ({
        ...workspace,
        languages: workspace.languages.map((item) =>
          item.code === language
            ? { ...item, status: hasContent ? "ready" : "partial" }
            : item,
        ),
      }));
    },
    [account, updateWorkspaceAccount],
  );

  const logout = useCallback(() => {
    setAuthState((prev) => upsertAccountWithSnapshot(prev, account));
    setAuthResolution(null);
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
          publishedLanguages: account.workspace.languages
            .filter(
              ({ code, status, visible }) =>
                code === account.workspace.primaryLanguage || (status === "ready" && visible),
            )
            .map(({ code }) => code),
          localizedNames: account.workspace.localizedNames,
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

  const dismissAuthResolution = useCallback(() => setAuthResolution(null), []);

  const value = useMemo<MockAuthContextValue>(
    () => ({
      account,
      isAuthenticated: Boolean(account),
      authResolution,
      dismissAuthResolution,
      validateAuthContact,
      verifyCode,
      loginWithPassword,
      completeWorkspaceSetup,
      addWorkspaceLanguage,
      setWorkspaceLanguageVisibility,
      removeWorkspaceLanguage,
      setWorkspaceLanguageHasContent,
      updateWorkspaceNameTranslation,
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
      authResolution,
      dismissAuthResolution,
      validateAuthContact,
      verifyCode,
      loginWithPassword,
      completeWorkspaceSetup,
      addWorkspaceLanguage,
      setWorkspaceLanguageVisibility,
      removeWorkspaceLanguage,
      setWorkspaceLanguageHasContent,
      updateWorkspaceNameTranslation,
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
