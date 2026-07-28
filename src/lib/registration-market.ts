export type RegistrationMarketDefaults = {
  market: "Kazakhstan" | "Serbia";
  marketCode: "KZ" | "RS";
  currency: "KZT" | "RSD";
  timezone: "Asia/Almaty" | "Europe/Belgrade";
  menuDomain: "tsqr.me" | "tsqr.app";
};

export function getRegistrationMarket(hostname: string): RegistrationMarketDefaults {
  const normalizedHostname = hostname.toLowerCase().split(":")[0];
  if (normalizedHostname === "tsqr.app" || normalizedHostname.endsWith(".tsqr.app")) {
    return {
      market: "Serbia",
      marketCode: "RS",
      currency: "RSD",
      timezone: "Europe/Belgrade",
      menuDomain: "tsqr.app",
    };
  }
  return {
    market: "Kazakhstan",
    marketCode: "KZ",
    currency: "KZT",
    timezone: "Asia/Almaty",
    menuDomain: "tsqr.me",
  };
}
