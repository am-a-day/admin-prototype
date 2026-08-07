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

export type OrderChannel = {
  id: string;
  type: ChannelType;
  name: string;
  contact: string;
  status: "connected" | "disconnected" | "checking" | "error";
};

export type RouteChannel = OrderChannel;
export type Routes = Record<OrderEvent, OrderChannel | null>;
export type ChannelAssignments = Record<OrderEvent, string | null>;

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

export const ORDER_EVENT_LABELS: Record<OrderEvent, string> = {
  delivery: "Доставка",
  pickup: "Самовывоз",
  waiter: "Вызов официанта",
};

const EMPTY_ASSIGNMENTS: ChannelAssignments = {
  delivery: null,
  pickup: null,
  waiter: null,
};

type StoredRoutingState = {
  channels: OrderChannel[];
  assignments: ChannelAssignments;
};

const EMPTY_STATE: StoredRoutingState = {
  channels: [],
  assignments: EMPTY_ASSIGNMENTS,
};

function routingStorageKey(accountId?: string) {
  return `tasko.orderChannels.v2.${accountId ?? "guest"}`;
}

function legacyRoutesStorageKey(accountId?: string) {
  return `tasko.orderRoutes.v1.${accountId ?? "guest"}`;
}

function readRoutingState(accountId?: string): StoredRoutingState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const stored = JSON.parse(window.localStorage.getItem(routingStorageKey(accountId)) ?? "null") as StoredRoutingState | null;
    if (stored?.channels && stored.assignments) {
      const channels = stored.channels
        .filter((channel) => (
          channel.id
          && channel.contact
          && !(channel.type === "telegram" && channel.contact.trim().startsWith("@"))
        ))
        .map((channel) => ({
          ...channel,
          status: ["connected", "disconnected", "checking", "error"].includes(channel.status) ? channel.status : "connected",
        } as OrderChannel));
      const channelIds = new Set(channels.map(({ id }) => id));
      return {
        channels,
        assignments: Object.fromEntries(
          (Object.keys(EMPTY_ASSIGNMENTS) as OrderEvent[]).map((event) => [
            event,
            channelIds.has(stored.assignments[event] ?? "") ? stored.assignments[event] : null,
          ]),
        ) as ChannelAssignments,
      };
    }

    const legacy = JSON.parse(window.localStorage.getItem(legacyRoutesStorageKey(accountId)) ?? "null") as Record<OrderEvent, ({ type: ChannelType; contact: string } & Partial<Pick<OrderChannel, "id" | "name">>) | null> | null;
    if (!legacy) return EMPTY_STATE;
    const channels: OrderChannel[] = [];
    const assignments = { ...EMPTY_ASSIGNMENTS };
    (Object.keys(EMPTY_ASSIGNMENTS) as OrderEvent[]).forEach((event) => {
      const route = legacy[event];
      if (!route?.contact) return;
      if (route.type === "telegram" && route.contact.trim().startsWith("@")) return;
      let channel = channels.find((candidate) => candidate.type === route.type && candidate.contact === route.contact);
      if (!channel) {
        channel = {
          id: route.id ?? `channel-migrated-${channels.length + 1}`,
          type: route.type,
          name: route.name ?? `${CHANNEL_LABELS[route.type]} · ${ORDER_EVENT_LABELS[event]}`,
          contact: route.contact,
          status: "connected",
        };
        channels.push(channel);
      }
      assignments[event] = channel.id;
    });
    return { channels, assignments };
  } catch {
    return EMPTY_STATE;
  }
}

type OrderRoutingContextValue = {
  channels: OrderChannel[];
  assignments: ChannelAssignments;
  routes: Routes;
  createChannel: (input: Omit<OrderChannel, "id" | "status">) => OrderChannel;
  updateChannel: (id: string, patch: Pick<OrderChannel, "name" | "contact">) => void;
  setChannelStatus: (id: string, status: OrderChannel["status"]) => void;
  deleteChannel: (id: string) => void;
  setRoute: (event: OrderEvent, channel: OrderChannel | null) => void;
  setChannelAssignments: (channelId: string, events: OrderEvent[]) => void;
  getChannelAssignments: (channelId: string) => OrderEvent[];
  resetChannels: () => void;
  formatRoute: (event: OrderEvent) => string | null;
};

const OrderRoutingContext = createContext<OrderRoutingContextValue | null>(null);

export function OrderRoutingProvider({ children }: { children: ReactNode }) {
  const { account } = useMockAuth();
  const [state, setState] = useState<StoredRoutingState>(() => readRoutingState(account?.id));

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(routingStorageKey(account?.id), JSON.stringify(state));
  }, [account?.id, state]);

  const routes = useMemo<Routes>(() => ({
    delivery: state.channels.find(({ id }) => id === state.assignments.delivery) ?? null,
    pickup: state.channels.find(({ id }) => id === state.assignments.pickup) ?? null,
    waiter: state.channels.find(({ id }) => id === state.assignments.waiter) ?? null,
  }), [state]);

  const createChannel = useCallback((input: Omit<OrderChannel, "id" | "status">) => {
    const channel: OrderChannel = {
      ...input,
      id: `channel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: "connected",
    };
    setState((current) => ({ ...current, channels: [...current.channels, channel] }));
    return channel;
  }, []);

  const updateChannel = useCallback((id: string, patch: Pick<OrderChannel, "name" | "contact">) => {
    setState((current) => ({
      ...current,
      channels: current.channels.map((channel) => channel.id === id ? { ...channel, ...patch } : channel),
    }));
  }, []);

  const setChannelStatus = useCallback((id: string, status: OrderChannel["status"]) => {
    setState((current) => ({
      ...current,
      channels: current.channels.map((channel) => channel.id === id ? { ...channel, status } : channel),
    }));
  }, []);

  const deleteChannel = useCallback((id: string) => {
    setState((current) => ({
      channels: current.channels.filter((channel) => channel.id !== id),
      assignments: Object.fromEntries(
        Object.entries(current.assignments).map(([event, channelId]) => [event, channelId === id ? null : channelId]),
      ) as ChannelAssignments,
    }));
  }, []);

  const setRoute = useCallback((event: OrderEvent, channel: OrderChannel | null) => {
    setState((current) => ({
      ...current,
      assignments: { ...current.assignments, [event]: channel?.id ?? null },
    }));
  }, []);

  const setChannelAssignments = useCallback((channelId: string, events: OrderEvent[]) => {
    setState((current) => ({
      ...current,
      assignments: Object.fromEntries(
        (Object.keys(EMPTY_ASSIGNMENTS) as OrderEvent[]).map((event) => [
          event,
          events.includes(event)
            ? channelId
            : current.assignments[event] === channelId
              ? null
              : current.assignments[event],
        ]),
      ) as ChannelAssignments,
    }));
  }, []);

  const getChannelAssignments = useCallback((channelId: string) => (
    (Object.keys(state.assignments) as OrderEvent[]).filter((event) => state.assignments[event] === channelId)
  ), [state.assignments]);

  const resetChannels = useCallback(() => {
    setState(EMPTY_STATE);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(legacyRoutesStorageKey(account?.id));
    }
  }, [account?.id]);

  const formatRoute = useCallback((event: OrderEvent) => {
    const route = routes[event];
    return route ? `${CHANNEL_LABELS[route.type]} · ${route.contact}` : null;
  }, [routes]);

  const value = useMemo<OrderRoutingContextValue>(() => ({
    channels: state.channels,
    assignments: state.assignments,
    routes,
    createChannel,
    updateChannel,
    setChannelStatus,
    deleteChannel,
    setRoute,
    setChannelAssignments,
    getChannelAssignments,
    resetChannels,
    formatRoute,
  }), [
    state.channels,
    state.assignments,
    routes,
    createChannel,
    updateChannel,
    setChannelStatus,
    deleteChannel,
    setRoute,
    setChannelAssignments,
    getChannelAssignments,
    resetChannels,
    formatRoute,
  ]);

  return <OrderRoutingContext.Provider value={value}>{children}</OrderRoutingContext.Provider>;
}

export function useOrderRouting() {
  const context = useContext(OrderRoutingContext);
  if (!context) throw new Error("useOrderRouting must be used within OrderRoutingProvider");
  return context;
}
