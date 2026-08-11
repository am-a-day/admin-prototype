import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Globe2, Pencil } from "lucide-react";
import { Buildings, CaretRight, LockKeyOpen, PlusCircle } from "@phosphor-icons/react";
import {
  RESTAURANT_NAME,
  RESTAURANT_ADDRESS,
  MOCK_VITRINES,
  CURRENT_VITRINE_ID,
  type SectionId,
} from "@/data/mock-data";
import { usePlan } from "@/contexts/plan-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { usePublish } from "@/contexts/publish-context";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useVitrineStatus } from "@/lib/use-vitrine-status";
import { cn } from "@/lib/utils";
import { getLanguage } from "@/data/languages";

/** Gated-feature pill: open-lock icon + plan label */
function LockBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f5f5f4] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#a6a09b]">
      <LockKeyOpen size={11} />
      {label}
    </span>
  );
}

/** Organisation / location context menu - triggered from header or sidebar */
export function OrgMenu({
  onNavigate,
  variant = "full",
}: {
  onNavigate: (section: SectionId, tab: string) => void;
  onResetCatalog?: () => void;
  /** "full" = T avatar (sidebar), "rail" = T avatar with dot, "text" = inline org name (header) */
  variant?: "full" | "rail" | "text";
}) {
  const { planId } = usePlan();
  const { account, updateWorkspace, updateWorkspaceNameTranslation } = useMockAuth();
  const { contentLanguage } = useAppSettings();
  const { registerChange } = usePublish();
  const vitrine = useVitrineStatus();
  const workspaceName =
    account?.workspace.localizedNames[contentLanguage] ||
    account?.workspace.localizedNames[account.workspace.primaryLanguage] ||
    account?.workspace.name ||
    RESTAURANT_NAME;
  const workspaceAddress =
    account?.workspace.webAddress ||
    account?.workspace.technicalAddress ||
    RESTAURANT_ADDRESS ||
    vitrine.webAddress;
  const canCustomizeAddress = planId === "Lite" || planId === "Ultra";

  const planCtaLabel = planId === "Ultra" ? "Управление тарифом" : "Улучшить тариф";
  const locationsCount = MOCK_VITRINES.length;
  const canAddLocation = planId === "Ultra" && locationsCount < 3;
  const addLocationLabel = planId === "Ultra" && locationsCount >= 3 ? `Лимит точек · ${locationsCount} из 3` : "Добавить точку";
  const addLocationBadge = planId !== "Ultra" ? "ULTRA" : null;
  const addLocationTitle =
    planId !== "Ultra"
      ? "Доступно на тарифе ULTRA"
      : locationsCount >= 3
        ? "Достигнут лимит точек на тарифе ULTRA"
        : "Добавить точку";

  const [open, setOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(workspaceName);
  const [nameError, setNameError] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState("");
  const [addressError, setAddressError] = useState("");
  const [selectedVitrineId, setSelectedVitrineId] = useState(CURRENT_VITRINE_ID);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const cancelNameRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      const popup = document.getElementById("org-menu-popup");
      if (popup?.contains(target)) return;
      const pointsPopup = document.getElementById("org-points-popup");
      if (pointsPopup?.contains(target)) return;
      setOpen(false);
      setPointsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingName && !editingAddress) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [editingAddress, editingName, open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      if (variant === "text") {
        setPopupPos({ top: rect.bottom + 4, left: rect.left });
      } else {
        setPopupPos({ top: rect.top, left: rect.right + 8 });
      }
    }
    if (open) setPointsOpen(false);
    setOpen((v) => !v);
  };

  const close = () => {
    setOpen(false);
    setPointsOpen(false);
    setEditingName(false);
    setEditingAddress(false);
    setNameError("");
    setAddressError("");
  };
  const current = MOCK_VITRINES.find((v) => v.id === selectedVitrineId) ?? MOCK_VITRINES[0];

  const startEditingName = () => {
    cancelNameRef.current = false;
    setDraftName(workspaceName);
    setNameError("");
    setEditingName(true);
  };

  const saveWorkspaceName = (rawName = draftName) => {
    if (cancelNameRef.current) {
      cancelNameRef.current = false;
      return;
    }
    const nextName = rawName.trim();
    if (!nextName) {
      setNameError("Введите название витрины");
      return;
    }
    if (nextName !== workspaceName) {
      updateWorkspaceNameTranslation(contentLanguage, nextName);
      registerChange("about");
    }
    setDraftName(nextName);
    setNameError("");
    setEditingName(false);
  };

  const savePrettyAddress = (rawAddress = addressDraft) => {
    const slug = rawAddress
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё-]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) {
      setAddressError("Введите адрес");
      return;
    }
    updateWorkspace({ webAddress: `${slug}.tsqr.me` });
    setAddressDraft(slug);
    setAddressError("");
    setEditingAddress(false);
  };

  return (
    <>
      {variant === "text" ? (
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-1.5 transition",
            open ? "bg-zinc-100" : "hover:bg-zinc-100",
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={`${workspaceName} · ${workspaceAddress}`}
        >
          <span className="max-w-[140px] truncate text-[13px] font-medium text-zinc-900">{workspaceName}</span>
          <span className="hidden text-[13px] text-zinc-300 lg:inline" aria-hidden>
            ·
          </span>
          <span className="hidden max-w-[160px] truncate text-[13px] text-zinc-400 lg:inline">
            {workspaceAddress}
          </span>
          <ChevronDown size={11} className={cn("shrink-0 text-zinc-400 transition", open && "rotate-180")} />
        </button>
      ) : (
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-sm font-black text-white transition hover:opacity-90",
            open && "ring-2 ring-blue-500/30 ring-offset-2",
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={variant === "rail" ? `${workspaceName} · ${vitrine.label}` : workspaceName}
        >
          T
          {variant === "rail" && (
            <>
              <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white", vitrine.dot)} />
            </>
          )}
        </button>
      )}

      {open && createPortal(
        <div
          id="org-menu-popup"
          style={{ top: popupPos.top, left: popupPos.left }}
          className="fixed z-[200] w-[260px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[14px] border border-[#e7e5e4] bg-white shadow-xl shadow-zinc-300/40"
        >
          {/* Header */}
          <div className="px-3 py-3">
            {editingName ? (
              <div>
                <input
                  autoFocus
                  value={draftName}
                  onChange={(event) => {
                    setDraftName(event.target.value);
                    if (nameError) setNameError("");
                  }}
                  onBlur={(event) => saveWorkspaceName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveWorkspaceName(event.currentTarget.value);
                    }
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      cancelNameRef.current = true;
                      setDraftName(workspaceName);
                      setNameError("");
                      setEditingName(false);
                    }
                  }}
                  aria-label="Название витрины"
                  aria-invalid={Boolean(nameError)}
                  className={cn(
                    "h-8 w-full rounded-[8px] border bg-white px-2 text-[13px] font-semibold text-[#292524] outline-none",
                    nameError
                      ? "border-red-300 focus:ring-2 focus:ring-red-100"
                      : "border-zinc-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
                  )}
                />
                {nameError && <div className="mt-1 text-[11px] text-red-600">{nameError}</div>}
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold leading-none text-[#292524]">
                  {workspaceName}
                </span>
                <button
                  type="button"
                  onClick={startEditingName}
                  title="Изменить название витрины"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                >
                  <Pencil size={12} />
                </button>
                <span className="ml-auto shrink-0 rounded-full bg-[#f5f5f4] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#57534d]">
                  {planId.toUpperCase()}
                </span>
              </div>
            )}
            <div className="mt-1.5 truncate text-[12px] leading-none text-[#a6a09b]">
              {workspaceAddress || current.address}
            </div>
          </div>

          <div className="h-px bg-[#e7e5e4]" />

          {/* Menu */}
          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                if (canCustomizeAddress) {
                  if (account?.workspace.webAddress) {
                    setAddressDraft(account.workspace.webAddress.replace(/\.tsqr\.me$/i, ""));
                  } else {
                    const suggestedSlug = workspaceName === "Новое меню"
                      ? `menu-${account?.workspace.technicalAddress.split("/").pop() || "menu"}`
                      : workspaceName
                          .toLowerCase()
                          .replace(/[^a-z0-9а-яё]+/gi, "-")
                          .replace(/^-+|-+$/g, "");
                    setAddressDraft(suggestedSlug);
                  }
                  setAddressError("");
                  setEditingAddress(true);
                } else {
                  close();
                  onNavigate("management", "billing");
                }
              }}
              title={canCustomizeAddress ? "Настроить адрес меню" : "Красивый адрес доступен на тарифе Lite"}
              className="flex min-h-9 w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#f5f5f4]"
            >
              <Globe2 size={14} className="shrink-0 text-[#57534d]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-[#44403b]">
                  {account?.workspace.webAddress || "Настроить адрес меню"}
                </span>
                {account?.workspace.webAddress && (
                  <span className="block text-[10px] leading-3 text-[#a6a09b]">Изменить</span>
                )}
              </span>
              {!canCustomizeAddress && <LockBadge label="LITE" />}
            </button>
            {editingAddress && (
              <div className="mx-2 mb-1 rounded-[8px] bg-zinc-50 p-2">
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={addressDraft}
                    onChange={(event) => {
                      setAddressDraft(event.target.value);
                      if (addressError) setAddressError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") savePrettyAddress(event.currentTarget.value);
                      if (event.key === "Escape") {
                        event.stopPropagation();
                        setEditingAddress(false);
                        setAddressError("");
                      }
                    }}
                    aria-label="Красивый адрес меню"
                    className={cn(
                      "h-8 min-w-0 flex-1 rounded-[7px] border bg-white px-2 text-[12px] outline-none",
                      addressError ? "border-red-300" : "border-zinc-200 focus:border-blue-400",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => savePrettyAddress()}
                    title="Сохранить адрес"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-zinc-900 text-white transition hover:bg-zinc-700"
                  >
                    <Check size={13} />
                  </button>
                </div>
                <div className={cn("mt-1 text-[10px]", addressError ? "text-red-600" : "text-zinc-400")}>
                  {addressError || ".tsqr.me"}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                close();
                onNavigate("storefront", "about:language-region");
              }}
              className="flex h-9 w-full items-center gap-1.5 rounded-lg px-2 text-left transition hover:bg-[#f5f5f4]"
            >
              <Globe2 size={14} className="shrink-0 text-[#57534d]" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-[#44403b]">
                Язык и регион
              </span>
              <span className="max-w-[92px] shrink truncate whitespace-nowrap text-[12px] text-[#a6a09b]">
                {getLanguage(account?.workspace.primaryLanguage ?? "ru").label} ·{" "}
                {account?.workspace.currency ?? "KZT"}
              </span>
              <CaretRight size={14} className="shrink-0 text-[#a6a09b]" />
            </button>

            <button
              type="button"
              onClick={() => setPointsOpen((v) => !v)}
              className={cn(
                "flex h-9 w-full items-center gap-1.5 rounded-lg px-2 text-left transition hover:bg-[#f5f5f4]",
                pointsOpen && "bg-[#f5f5f4]",
              )}
            >
              <Buildings size={14} className="shrink-0 text-[#57534d]" />
              <span className="flex-1 text-[13px] text-[#44403b]">Ваши точки</span>
              <span className="text-[12px] text-[#a6a09b]">{locationsCount}</span>
              <CaretRight size={14} className="shrink-0 text-[#a6a09b]" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (canAddLocation) close();
              }}
              disabled={!canAddLocation}
              title={addLocationTitle}
              className={cn(
                "flex h-9 w-full items-center gap-1.5 rounded-lg px-2 text-left transition",
                canAddLocation ? "hover:bg-[#f5f5f4]" : "cursor-not-allowed",
              )}
            >
              <PlusCircle size={14} className="shrink-0 text-[#57534d]" />
              <span className="flex-1 text-[13px] text-[#44403b]">{addLocationLabel}</span>
              {addLocationBadge && <LockBadge label={addLocationBadge} />}
            </button>

            <button
              type="button"
              disabled
              title="Доступно на тарифе LITE"
              className="flex h-9 w-full cursor-not-allowed items-center gap-1.5 rounded-lg px-2 text-left"
            >
              <PlusCircle size={14} className="shrink-0 text-[#57534d]" />
              <span className="flex-1 text-[13px] text-[#44403b]">Пригласить сотрудника</span>
              <LockBadge label="LITE" />
            </button>
          </div>

          {/* CTA */}
          <div className="px-3 pb-3 pt-0.5">
            <button
              type="button"
              onClick={() => {
                close();
                onNavigate("management", "billing");
              }}
              className="flex h-8 w-full items-center justify-center rounded-[8px] border border-[#e7e5e4] text-[13px] font-medium text-[#44403b] transition hover:bg-[#f5f5f4]"
            >
              {planCtaLabel}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {open && pointsOpen && createPortal(
        <div
          id="org-points-popup"
          style={{ top: popupPos.top, left: popupPos.left + 268 }}
          className="fixed z-[201] w-[260px] max-w-[calc(100vw-24px)] rounded-[14px] border border-[#e7e5e4] bg-white p-2 shadow-xl shadow-zinc-300/40"
        >
          <div className="px-2.5 pb-1 pt-1 text-[13px] font-semibold text-zinc-950">
            Точки
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {MOCK_VITRINES.map((v) => {
              const isSelected = v.id === selectedVitrineId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVitrineId(v.id);
                    close();
                  }}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 py-1 text-left transition",
                    isSelected ? "bg-zinc-50" : "hover:bg-zinc-50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-[13px] leading-snug", isSelected ? "font-semibold text-zinc-950" : "font-medium text-zinc-700")}>
                      {v.address}
                    </div>
                    <div className="truncate text-[11px] text-zinc-400">{v.url}</div>
                  </div>
                  {isSelected && (
                    <Check size={14} className="shrink-0 text-zinc-500" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
