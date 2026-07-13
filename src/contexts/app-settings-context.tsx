import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getLanguage, type LanguageCode } from "@/data/languages";

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
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [contentLanguage, setContentLanguage] = useState<LanguageCode>("ru");
  const [uiLanguage, setUiLanguage] = useState<LanguageCode>("ru");
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(true);
  const [serviceFeePercent, setServiceFeePercent] = useState(10);
  const [serviceFeeRequireConsent, setServiceFeeRequireConsent] = useState(false);
  const [ageConfirmationEnabled, setAgeConfirmationEnabled] = useState(false);
  const [minimumAge, setMinimumAge] = useState<18 | 21>(18);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryComment, setDeliveryComment] = useState(
    "Курьер свяжется с вами после подтверждения заказа.",
  );
  const [pickupComment, setPickupComment] = useState(
    "Заказ будет готов через 20 минут.",
  );
  const pickupAddress = "пр. Кабанбай Батыра, 48, вход со двора";

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
