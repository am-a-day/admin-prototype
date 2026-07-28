export type AuthAnalyticsEvent =
  | "registration_view"
  | "phone_completed"
  | "auth_channel_selected"
  | "code_send_success"
  | "code_send_error"
  | "code_verified"
  | "existing_account_opened"
  | "account_created"
  | "admin_opened";

const AUTH_ANALYTICS_KEY = "tasko.auth.analytics.v1";
let lastEventSignature = "";
let lastEventAt = 0;

export function trackAuthEvent(
  event: AuthAnalyticsEvent,
  metadata: Record<string, string> = {},
) {
  if (typeof window === "undefined") return;
  const signature = `${event}:${JSON.stringify(metadata)}`;
  const now = Date.now();
  if (signature === lastEventSignature && now - lastEventAt < 250) return;
  lastEventSignature = signature;
  lastEventAt = now;
  try {
    const stored = window.localStorage.getItem(AUTH_ANALYTICS_KEY);
    const events = stored ? JSON.parse(stored) as unknown[] : [];
    const next = [...events.slice(-99), { event, metadata, timestamp: now }];
    window.localStorage.setItem(AUTH_ANALYTICS_KEY, JSON.stringify(next));
  } catch {
    // Analytics must not block the prototype auth flow.
  }
}
