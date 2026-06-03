import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ChannelType = "whatsapp" | "telegram";
export type OrderEvent = "delivery" | "pickup" | "waiter";

export type RouteChannel = { type: ChannelType; contact: string };

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

type Routes = Record<OrderEvent, RouteChannel | null>;

const INITIAL_ROUTES: Routes = {
  delivery: { type: "telegram", contact: "@kimchi_orders" },
  pickup: { type: "whatsapp", contact: "+7 701 555 55 55" },
  waiter: { type: "telegram", contact: "@kimchi_orders" },
};

type OrderRoutingContextValue = {
  routes: Routes;
  setRoute: (event: OrderEvent, channel: RouteChannel | null) => void;
  /** "WhatsApp · +7 700 000 00 00" либо null, если канал не настроен. */
  formatRoute: (event: OrderEvent) => string | null;
};

const OrderRoutingContext = createContext<OrderRoutingContextValue | null>(null);

export function OrderRoutingProvider({ children }: { children: ReactNode }) {
  const [routes, setRoutes] = useState<Routes>(INITIAL_ROUTES);

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
