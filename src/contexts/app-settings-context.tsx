import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getLanguage, type LanguageCode } from "@/data/languages";
import { useMockAuth } from "@/contexts/mock-auth-context";

type AppSettingsContextValue = {
  contentLanguage: LanguageCode;
  uiLanguage: LanguageCode;
  setContentLanguage: (code: LanguageCode) => void;
  setUiLanguage: (code: LanguageCode) => void;
  contentLanguageLabel: string;
  contentLanguageShort: string;
  serviceFeeEnabled: boolean;
  setServiceFeeEnabled: (enabled: boolean) => void;
  serviceFeePercent: number;
  setServiceFeePercent: (percent: number) => void;
  serviceFeeRequireConsent: boolean;
  setServiceFeeRequireConsent: (required: boolean) => void;
  serviceFeeRateLabel: string;
  ageConfirmationEnabled: boolean;
  setAgeConfirmationEnabled: (enabled: boolean) => void;
  minimumAge: 18 | 21;
  setMinimumAge: (age: 18 | 21) => void;
  deliveryEnabled: boolean;
  setDeliveryEnabled: (enabled: boolean) => void;
  pickupEnabled: boolean;
  setPickupEnabled: (enabled: boolean) => void;
  deliveryComment: string;
  setDeliveryComment: (value: string) => void;
  pickupComment: string;
  setPickupComment: (value: string) => void;
  pickupAddress: string;
  setPickupAddress: (value: string) => void;
};

type StoredOrderSettings = {
  serviceFeeEnabled: boolean;
  serviceFeePercent: number;
  serviceFeeRequireConsent: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryComment: string;
  pickupComment: string;
  pickupAddress: string;
};

const EMPTY_ORDER_SETTINGS: StoredOrderSettings = {
  serviceFeeEnabled: false,
  serviceFeePercent: 0,
  serviceFeeRequireConsent: false,
  deliveryEnabled: false,
  pickupEnabled: false,
  deliveryComment: "",
  pickupComment: "",
  pickupAddress: "",
};

function orderSettingsStorageKey(accountId?: string) {
  return `tasko.orderSettings.v1.${accountId ?? "guest"}`;
}

function readOrderSettings(accountId?: string): StoredOrderSettings {
  if (typeof window === "undefined") return EMPTY_ORDER_SETTINGS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(orderSettingsStorageKey(accountId)) ?? "null") as Partial<StoredOrderSettings> | null;
    return stored ? { ...EMPTY_ORDER_SETTINGS, ...stored } : EMPTY_ORDER_SETTINGS;
  } catch {
    return EMPTY_ORDER_SETTINGS;
  }
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { account } = useMockAuth();
  const initialOrderSettings = useMemo(() => readOrderSettings(account?.id), [account?.id]);
  const [contentLanguage, setContentLanguage] = useState<LanguageCode>(
    () => account?.workspace.primaryLanguage ?? "ru",
  );
  const [uiLanguage, setUiLanguage] = useState<LanguageCode>("ru");
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(initialOrderSettings.serviceFeeEnabled);
  const [serviceFeePercent, setServiceFeePercent] = useState(initialOrderSettings.serviceFeePercent);
  const [serviceFeeRequireConsent, setServiceFeeRequireConsent] = useState(initialOrderSettings.serviceFeeRequireConsent);
  const [ageConfirmationEnabled, setAgeConfirmationEnabled] = useState(false);
  const [minimumAge, setMinimumAge] = useState<18 | 21>(18);
  const [deliveryEnabled, setDeliveryEnabled] = useState(initialOrderSettings.deliveryEnabled);
  const [pickupEnabled, setPickupEnabled] = useState(initialOrderSettings.pickupEnabled);
  const [deliveryComment, setDeliveryComment] = useState(initialOrderSettings.deliveryComment);
  const [pickupComment, setPickupComment] = useState(initialOrderSettings.pickupComment);
  const [pickupAddress, setPickupAddress] = useState(initialOrderSettings.pickupAddress);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(orderSettingsStorageKey(account?.id), JSON.stringify({
      serviceFeeEnabled,
      serviceFeePercent,
      serviceFeeRequireConsent,
      deliveryEnabled,
      pickupEnabled,
      deliveryComment,
      pickupComment,
      pickupAddress,
    } satisfies StoredOrderSettings));
  }, [
    account?.id,
    serviceFeeEnabled,
    serviceFeePercent,
    serviceFeeRequireConsent,
    deliveryEnabled,
    pickupEnabled,
    deliveryComment,
    pickupComment,
    pickupAddress,
  ]);

  useEffect(() => {
    if (!account) return;
    const languageAvailable = account.workspace.languages.some(
      ({ code }) => code === contentLanguage,
    );
    if (!languageAvailable) setContentLanguage(account.workspace.primaryLanguage);
  }, [
    account,
    account?.workspace.languages,
    account?.workspace.primaryLanguage,
    contentLanguage,
  ]);

  const value = useMemo<AppSettingsContextValue>(() => {
    const lang = getLanguage(contentLanguage);
    return {
      contentLanguage,
      uiLanguage,
      setContentLanguage,
      setUiLanguage,
      contentLanguageLabel: lang.label,
      contentLanguageShort: lang.short,
      serviceFeeEnabled,
      setServiceFeeEnabled,
      serviceFeePercent,
      setServiceFeePercent,
      serviceFeeRequireConsent,
      setServiceFeeRequireConsent,
      serviceFeeRateLabel: `${serviceFeePercent}%`,
      ageConfirmationEnabled,
      setAgeConfirmationEnabled,
      minimumAge,
      setMinimumAge,
      deliveryEnabled,
      setDeliveryEnabled,
      pickupEnabled,
      setPickupEnabled,
      deliveryComment,
      setDeliveryComment,
      pickupComment,
      setPickupComment,
      pickupAddress,
      setPickupAddress,
    };
  }, [
    contentLanguage,
    uiLanguage,
    serviceFeeEnabled,
    serviceFeePercent,
    serviceFeeRequireConsent,
    ageConfirmationEnabled,
    minimumAge,
    deliveryEnabled,
    pickupEnabled,
    deliveryComment,
    pickupComment,
    pickupAddress,
  ]);

  return (
    <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return ctx;
}
