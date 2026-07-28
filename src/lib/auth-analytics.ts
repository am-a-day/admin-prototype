export type AuthAnalyticsEvent =
  | "auth_view"
  | "phone_completed"
  | "code_verified"
  | "existing_account_opened"
  | "account_created";

const AUTH_ANALYTICS_KEY = "tasko.auth.analytics.v1";

export function trackAuthEvent(
  event: AuthAnalyticsEvent,
  metadata: Record<string, string> = {},
) {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(AUTH_ANALYTICS_KEY);
    const events = stored ? JSON.parse(stored) as unknown[] : [];
    const next = [...events.slice(-99), { event, metadata, timestamp: Date.now() }];
    window.localStorage.setItem(AUTH_ANALYTICS_KEY, JSON.stringify(next));
  } catch {
    // Analytics must not block the prototype auth flow.
  }
}
