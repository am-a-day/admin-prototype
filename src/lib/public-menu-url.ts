import type { MockAccount } from "@/contexts/mock-auth-context";

export function getPublicMenuAddress(account: MockAccount) {
  return account.workspace.webAddress || account.workspace.technicalAddress;
}

export function getPublicMenuHref(account: MockAccount) {
  const url = new URL(window.location.origin);
  url.pathname = `/${getPublicMenuAddress(account)}`;
  url.searchParams.set("publicMenu", account.id);
  return url.toString();
}

export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Copy command is unavailable");
  }
}
