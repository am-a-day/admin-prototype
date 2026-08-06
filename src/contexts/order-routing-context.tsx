import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMockAuth } from "@/contexts/mock-auth-context";

export type ChannelType = "whatsapp" | "telegram";
export type OrderEvent = "delivery" | "pickup" | "waiter";

export type RouteChannel = { type: ChannelType; contact: string };

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

type Routes = Record<OrderEvent, RouteChannel | null>;

const INITIAL_ROUTES: Routes = {
  delivery: null,
  pickup: null,
  waiter: null,
};

function routesStorageKey(accountId?: string) {
  return `tasko.orderRoutes.v1.${accountId ?? "guest"}`;
}

function readRoutes(accountId?: string): Routes {
  if (typeof window === "undefined") return INITIAL_ROUTES;
  try {
    const stored = JSON.parse(window.localStorage.getItem(routesStorageKey(accountId)) ?? "null") as Partial<Routes> | null;
    return stored ? { ...INITIAL_ROUTES, ...stored } : INITIAL_ROUTES;
  } catch {
    return INITIAL_ROUTES;
  }
}

type OrderRoutingContextValue = {
  routes: Routes;
  setRoute: (event: OrderEvent, channel: RouteChannel | null) => void;
  /** "WhatsApp · +7 700 000 00 00" либо null, если канал не настроен. */
  formatRoute: (event: OrderEvent) => string | null;
};

const OrderRoutingContext = createContext<OrderRoutingContextValue | null>(null);

export function OrderRoutingProvider({ children }: { children: ReactNode }) {
  const { account } = useMockAuth();
  const [routes, setRoutes] = useState<Routes>(() => readRoutes(account?.id));

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(routesStorageKey(account?.id), JSON.stringify(routes));
  }, [account?.id, routes]);

  const setRoute = useCallback((event: OrderEvent, channel: RouteChannel | null) => {
    setRoutes((prev) => ({ ...prev, [event]: channel }));
  }, []);

  const formatRoute = useCallback(
    (event: OrderEvent) => {
      const r = routes[event];
      if (!r || !r.contact.trim()) return null;
      return `${CHANNEL_LABELS[r.type]} · ${r.contact}`;
    },
    [routes],
  );

  const value = useMemo<OrderRoutingContextValue>(
    () => ({ routes, setRoute, formatRoute }),
    [routes, setRoute, formatRoute],
  );

  return <OrderRoutingContext.Provider value={value}>{children}</OrderRoutingContext.Provider>;
}

export function useOrderRouting() {
  const ctx = useContext(OrderRoutingContext);
  if (!ctx) {
    throw new Error("useOrderRouting must be used within OrderRoutingProvider");
  }
  return ctx;
}
