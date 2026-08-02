import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, Globe2, Loader2, QrCode } from "lucide-react";
import QRCode from "react-qr-code";
import { usePublish } from "@/contexts/publish-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { usePlan } from "@/contexts/plan-context";
import type { SectionId } from "@/data/mock-data";
import { copyText, getPublicMenuAddress, getPublicMenuHref } from "@/lib/public-menu-url";
import { cn } from "@/lib/utils";

function formatLastPublished(ts: number | null): string {
  if (!ts) return "—";
  const date = new Date(ts);
  const now = new Date();
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  return sameDay
    ? `сегодня в ${time}`
    : `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, "0")} в ${time}`;
}

export function PublishStatusControl({
  onNavigate,
  catalogHasVisibleItems,
}: {
  onNavigate: (section: SectionId, tab: string) => void;
  catalogHasVisibleItems: boolean;
}) {
  const { startPublish, publishPhase, publishResult, lastPublishedAt } = usePublish();
  const { account, choosePrettyAddress } = useMockAuth();
  const { planId } = usePlan();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasPublishing = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return;
      if (document.getElementById("publish-status-popup")?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (publishPhase === "publishing") {
      wasPublishing.current = true;
    } else if (wasPublishing.current) {
      wasPublishing.current = false;
      if (publishResult === "first-publish" && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
        setOpen(true);
      } else {
        setOpen(false);
      }
    }
  }, [publishPhase, publishResult]);

  const workspace = account?.workspace;
  if (!account || !workspace) return null;

  const state = workspace.status;
  const isPublishing = publishPhase === "publishing";
  const canCustomizeAddress = planId === "Lite" || planId === "Ultra";
  const showAddressOffer = !workspace.webAddress;
  const displayAddress = getPublicMenuAddress(account);
  const publicHref = getPublicMenuHref(account);

  const toggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    }
    setCopied(false);
    setOpen((value) => !value);
  };

  const config = {
    draft: {
      dot: "bg-zinc-400",
      text: "text-zinc-700",
      hover: "hover:bg-zinc-100",
      open: "bg-zinc-100",
      short: "Черновик",
      full: <>Черновик · <span className="font-medium">Опубликовать</span></>,
    },
    changes: {
      dot: "bg-amber-500",
      text: "text-amber-700",
      hover: "hover:bg-amber-50",
      open: "bg-amber-100",
      short: "Есть изменения",
      full: <>Есть неопубликованные изменения · <span className="font-medium">Обновить меню</span></>,
    },
    published: {
      dot: "bg-emerald-500",
      text: "text-emerald-700",
      hover: "hover:bg-emerald-50",
      open: "bg-emerald-100",
      short: "Опубликовано",
      full: <>Опубликовано</>,
    },
  }[state];

  const copyLink = async () => {
    await copyText(publicHref);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const AddressOffer = () =>
    showAddressOffer ? (
      <button
        type="button"
        onClick={() => {
          if (canCustomizeAddress) {
            choosePrettyAddress();
          } else {
            setOpen(false);
            onNavigate("management", "billing");
          }
        }}
        className="mt-3 flex w-full items-center gap-2 border-t border-zinc-100 pt-3 text-left text-[12px] text-zinc-500 transition hover:text-zinc-800"
      >
        <Globe2 size={13} className="shrink-0" />
        <span className="min-w-0 flex-1">Настроить красивый адрес</span>
        {!canCustomizeAddress && (
          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500">LITE</span>
        )}
        <ArrowRight size={12} className="shrink-0" />
      </button>
    ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[14px] transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1",
          config.text,
          open ? config.open : config.hover,
        )}
      >
        <span className={cn("h-2 w-2 shrink-0 rounded-full", config.dot)} />
        <span>
          <span className="hidden sm:inline">{config.full}</span>
          <span className="sm:hidden">{config.short}</span>
        </span>
        <ChevronDown size={13} className={cn("shrink-0 transition", open && "rotate-180")} />
      </button>

      {open && createPortal(
        <div
          id="publish-status-popup"
          role="dialog"
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-[200] w-[320px] rounded-[14px] border border-[#e7e5e4] bg-white p-3.5 shadow-xl shadow-zinc-300/40"
        >
          {state === "draft" && (
            <>
              <div className="text-[14px] font-bold text-zinc-950">Черновик</div>
              <p className="mt-1 text-[12px] leading-[1.5] text-zinc-500">
                Изменения сохраняются автоматически. Предпросмотр доступен только вам.
              </p>
              {!catalogHasVisibleItems && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-[10px] bg-zinc-50 px-2.5 py-2">
                  <span className="text-[12px] leading-4 text-zinc-600">Добавьте хотя бы одну позицию</span>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onNavigate("storefront", "catalog");
                    }}
                    className="shrink-0 text-[12px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Перейти
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => startPublish({ catalogHasVisibleItems })}
                disabled={!catalogHasVisibleItems || isPublishing}
                className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-blue-600 text-[14px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
              >
                {isPublishing ? <Loader2 size={14} className="animate-spin" /> : null}
                Опубликовать
              </button>
              <AddressOffer />
            </>
          )}

          {state === "changes" && (
            <>
              <div className="text-[14px] font-bold text-zinc-950">Есть неопубликованные изменения</div>
              <p className="mt-1 text-[12px] leading-[1.5] text-zinc-500">
                В предпросмотре виден текущий черновик. Гости пока видят последнюю опубликованную версию.
              </p>
              <button
                type="button"
                onClick={() => startPublish({ catalogHasVisibleItems })}
                disabled={!catalogHasVisibleItems || isPublishing}
                className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-blue-600 text-[14px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
              >
                {isPublishing ? <Loader2 size={14} className="animate-spin" /> : null}
                Обновить меню
              </button>
              <AddressOffer />
            </>
          )}

          {state === "published" && (
            <>
              <div className="flex items-center gap-1.5 text-[14px] font-bold text-zinc-950">
                <Check size={15} className="text-emerald-600" strokeWidth={2.5} />
                Меню опубликовано
              </div>
              <p className="mt-1 text-[12px] leading-[1.5] text-zinc-500">
                Гости уже могут открыть последнюю опубликованную версию.
              </p>
              <div className="mt-3 flex justify-center">
                <div className="rounded-[8px] border border-zinc-200 bg-white p-2">
                  <QRCode
                    value={publicHref}
                    size={88}
                    bgColor="#ffffff"
                    fgColor="#18181b"
                    level="M"
                    title={`QR-код меню ${displayAddress}`}
                  />
                </div>
              </div>
              <div className="mt-2 truncate text-center text-[12px] font-medium text-zinc-700">
                {displayAddress}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <a
                    href={publicHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-2 text-[11px] font-semibold text-white transition hover:bg-zinc-700"
                  >
                    <ExternalLink size={12} />
                    Открыть меню
                  </a>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Скопировано" : "Скопировать ссылку"}
                  </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNavigate("qr", "");
                }}
                className="mt-2 flex h-7 w-full items-center justify-center gap-1.5 text-[12px] font-medium text-zinc-500 transition hover:text-zinc-800"
              >
                <QrCode size={13} />
                Настроить QR-коды
                <ArrowRight size={12} />
              </button>
              <div className="mt-2 text-[11px] text-zinc-400">
                Последняя публикация: {formatLastPublished(lastPublishedAt)}
              </div>
              <AddressOffer />
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
