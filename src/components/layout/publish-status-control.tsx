import { forwardRef, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, Copy, Eye, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { usePublish } from "@/contexts/publish-context";
import {
  getPublicationRequirements,
  useMockAuth,
  type OrganizationType,
  type VenueType,
} from "@/contexts/mock-auth-context";
import { useCatalogStore } from "@/contexts/catalog-store-context";
import type { SectionId } from "@/data/mock-data";
import { copyText } from "@/lib/public-menu-url";
import { validateFirstPublishAddress } from "@/lib/first-publish-address";
import { cn } from "@/lib/utils";

type FirstPublishStep = "about" | "address" | "contact";

type PublishButtonState = "first" | "published" | "changes";

function PublishGlobe({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M9 15.75C12.7279 15.75 15.75 12.7279 15.75 9C15.75 5.27208 12.7279 2.25 9 2.25C5.27208 2.25 2.25 5.27208 2.25 9C2.25 12.7279 5.27208 15.75 9 15.75Z" stroke="currentColor" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.8125 9C11.8125 13.5 9 15.75 9 15.75C9 15.75 6.1875 13.5 6.1875 9C6.1875 4.5 9 2.25 9 2.25C9 2.25 11.8125 4.5 11.8125 9Z" stroke="currentColor" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.6332 6.75H15.3654" stroke="currentColor" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.6332 11.25H15.3654" stroke="currentColor" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function formatRelativePublishTime(timestamp: number, now = Date.now()) {
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < 45_000) return "только что";

  const formatter = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return formatter.format(-Math.max(1, minutes), "minute");

  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 24) return formatter.format(-hours, "hour");

  const days = Math.floor(elapsed / 86_400_000);
  if (days < 30) return formatter.format(-days, "day");

  const months = Math.floor(days / 30);
  if (months < 12) return formatter.format(-months, "month");

  return formatter.format(-Math.floor(months / 12), "year");
}

export function splitWebsiteAddress(webAddress: string, fallbackAddress: string) {
  const address = webAddress.trim() || fallbackAddress.trim();
  const firstDot = address.indexOf(".");
  if (firstDot <= 0) return { slug: address, domain: "" };
  return {
    slug: address.slice(0, firstDot),
    domain: address.slice(firstDot),
  };
}

type PublishTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  state: PublishButtonState;
};

const PublishTrigger = forwardRef<HTMLButtonElement, PublishTriggerProps>(function PublishTrigger(
  { state, disabled, className, ...props },
  ref,
) {
  const primary = state !== "published";
  const label = state === "first"
    ? "Опубликовать меню"
    : state === "changes"
      ? "Опубликовать изменения"
      : "Опубликовано";

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border px-0 pl-1.5 pr-2 font-sans text-[13px] font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]/25 disabled:opacity-70",
        primary
          ? "border-[#4f39f6] bg-[#4f39f6] text-white hover:border-[#4030d4] hover:bg-[#4030d4]"
          : "border-[#e7e5e4] bg-transparent text-[#44403b] hover:bg-white",
        className,
      )}
      {...props}
    >
      <PublishGlobe className="h-[18px] w-[18px] shrink-0" />
      <span>{label}</span>
    </button>
  );
});

const ORGANIZATION_TYPE_OPTIONS: Array<{
  value: OrganizationType;
  venueType: VenueType;
  label: string;
}> = [
  { value: "restaurant", venueType: "restaurant", label: "Ресторан или кафе" },
  { value: "store", venueType: "online-store", label: "Магазин" },
  { value: "services", venueType: "services", label: "Услуги" },
  { value: "other", venueType: "other", label: "Другое" },
];

const FIRST_PUBLISH_FIELD_CLASS =
  "h-9 rounded-[8px] border-[#e5e5e5] bg-white px-3 text-[13px] text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.1)] focus-visible:border-[#4f39f6] focus-visible:ring-2 focus-visible:ring-[#4f39f6]/15";
const FIRST_PUBLISH_LABEL_CLASS = "text-[13px] font-normal leading-5 text-[#303030]";
const FIRST_PUBLISH_PRIMARY_ACTION_CLASS =
  "h-8 w-full rounded-[10px] bg-[#4f39f6] px-3 text-[14px] font-medium text-white hover:bg-[#4030d4] focus-visible:ring-[#4f39f6]/25";

function StepHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="-ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ArrowLeft size={15} />
        </button>
      )}
      <h2 className="text-[14px] font-medium leading-5 text-[#292524]">{title}</h2>
    </div>
  );
}

export function PublishStatusControl({
  onNavigate,
  catalogHasVisibleItems,
}: {
  onNavigate: (section: SectionId, tab: string) => void;
  catalogHasVisibleItems: boolean;
}) {
  const { startPublish, publishPhase, lastPublishedAt, totalChanges } = usePublish();
  const { account, updateWorkspace, updateAccountProfile, markDraftChanged } = useMockAuth();
  const { activeMenu, activeMenuId, guestFacingMenuId, menus, publishMenu } = useCatalogStore();
  const [open, setOpen] = useState(false);
  const [firstPublishStep, setFirstPublishStep] = useState<FirstPublishStep>("about");
  const [aliasTouched, setAliasTouched] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [menuPublishConfirmOpen, setMenuPublishConfirmOpen] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const wasPublishing = useRef(false);

  const addressParts = useMemo(
    () => splitWebsiteAddress(account?.workspace.webAddress ?? "", account?.workspace.technicalAddress ?? ""),
    [account?.workspace.technicalAddress, account?.workspace.webAddress],
  );

  useEffect(() => {
    if (publishPhase === "publishing") {
      wasPublishing.current = true;
    } else if (wasPublishing.current) {
      wasPublishing.current = false;
      setOpen(false);
    }
  }, [publishPhase]);

  useEffect(() => {
    if (!open) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!editingAddress) return;
    addressInputRef.current?.focus();
    addressInputRef.current?.select();
  }, [editingAddress]);

  const workspace = account?.workspace;
  if (!account || !workspace) return null;

  const state = workspace.status;
  const review = workspace.review;
  const isFirstPublication = !workspace.publishedSnapshot;
  const isDisabled = review.status === "disabled-manual" || review.status === "disabled-timeout";
  const isPublishing = publishPhase === "publishing";
  const hasUnpublishedChanges = !isFirstPublication && (state !== "published" || totalChanges > 0);
  const buttonState: PublishButtonState = isFirstPublication
    ? "first"
    : hasUnpublishedChanges
      ? "changes"
      : "published";
  const publishedAt = lastPublishedAt ?? workspace.publishedSnapshot?.publishedAt ?? now;
  const addressValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(addressDraft);
  const guestFacingMenu = menus.find((menu) => menu.id === guestFacingMenuId) ?? menus[0];
  const editingGuestFacingMenu = activeMenuId === guestFacingMenuId;
  const alias = workspace.webAddress.replace(/\.tsqr\.me$/i, "");
  const aliasError = validateFirstPublishAddress(alias);
  const aliasValid = aliasError === null;
  const visibleAliasError = aliasTouched ? aliasError : null;
  const aboutValid = Boolean(workspace.name.trim() && workspace.organizationType);
  const contactValid = Boolean(account.firstName.trim() && account.lastName.trim());

  const publishCurrentMenu = () => {
    if (getPublicationRequirements(account).length > 0) return;
    if (!editingGuestFacingMenu) {
      setOpen(false);
      setMenuPublishConfirmOpen(true);
      return;
    }
    startPublish({ catalogHasVisibleItems });
  };

  const confirmMenuPublish = () => {
    publishMenu(activeMenuId);
    setMenuPublishConfirmOpen(false);
    startPublish({ catalogHasVisibleItems });
  };

  const continueFromAddress = () => {
    setAliasTouched(true);
    if (!aliasValid) return;

    const normalizedAddress = `${alias.trim()}.tsqr.me`;
    if (normalizedAddress !== workspace.webAddress) {
      updateWorkspace({ webAddress: normalizedAddress });
    }
    setFirstPublishStep("contact");
  };

  const beginAddressEditing = () => {
    setAddressDraft(addressParts.slug);
    setEditingAddress(true);
  };

  const cancelAddressEditing = () => {
    setAddressDraft(addressParts.slug);
    setEditingAddress(false);
  };

  const saveAddress = () => {
    if (!addressValid) return;
    const nextAddress = `${addressDraft}${addressParts.domain}`;
    if (nextAddress !== workspace.webAddress) {
      updateWorkspace({ webAddress: nextAddress });
      markDraftChanged();
    }
    setEditingAddress(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setAliasTouched(false);
          setEditingAddress(false);
          setAddressDraft(addressParts.slug);
        }
      }}>
        <Tooltip
          label="Добавьте хотя бы одну позицию, чтобы опубликовать меню"
          side="bottom"
          disabled={catalogHasVisibleItems}
        >
          <span className="inline-flex shrink-0">
            <PopoverTrigger asChild>
              <PublishTrigger
                state={buttonState}
                disabled={!catalogHasVisibleItems || isPublishing}
                className={catalogHasVisibleItems ? "disabled:cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-55"}
              />
            </PopoverTrigger>
          </span>
        </Tooltip>

        <PopoverContent
          align="end"
          onEscapeKeyDown={(event) => {
            if (!editingAddress) return;
            event.preventDefault();
            cancelAddressEditing();
          }}
          className={cn(
            "w-[420px] max-w-[calc(100vw-16px)] p-4",
            isFirstPublication && "rounded-[16px] border-[#e7e5e4] px-4 py-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
          )}
        >
            {!editingGuestFacingMenu && !isFirstPublication && (
              <div className="mb-3 rounded-[9px] bg-[#f8f8f5] px-2.5 py-2 text-[12px] leading-4 text-[#79716b]">
                Редактируется «{activeMenu.name}». Гости пока видят «{guestFacingMenu?.name ?? "меню"}».
              </div>
            )}

            {isFirstPublication && firstPublishStep === "about" && (
              <div>
                <StepHeader title="О заведении" />
                <p className="mt-2 text-[13px] leading-5 text-[#79716b]">Так заведение будет отображаться для гостей.</p>

                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className={FIRST_PUBLISH_LABEL_CLASS}>Название заведения</span>
                    <Input
                      value={workspace.name}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateWorkspace({
                          name: value,
                          localizedNames: { ...workspace.localizedNames, [workspace.primaryLanguage]: value },
                        });
                      }}
                      className={cn("mt-1.5", FIRST_PUBLISH_FIELD_CLASS)}
                    />
                  </label>

                  <div>
                    <span className={FIRST_PUBLISH_LABEL_CLASS}>Тип заведения</span>
                    <Select
                      value={workspace.organizationType}
                      onValueChange={(value) => {
                        const option = ORGANIZATION_TYPE_OPTIONS.find((candidate) => candidate.value === value);
                        if (!option) return;
                        updateWorkspace({
                          organizationType: option.value,
                          venueType: option.venueType,
                          organizationTypeConfirmed: true,
                        });
                      }}
                    >
                      <SelectTrigger className="mt-1.5" aria-label="Тип заведения">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {ORGANIZATION_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => setFirstPublishStep("address")}
                  disabled={!aboutValid}
                  className={cn("mt-5", FIRST_PUBLISH_PRIMARY_ACTION_CLASS)}
                >
                  Продолжить
                </Button>
              </div>
            )}

            {isFirstPublication && firstPublishStep === "address" && (
              <div>
                <StepHeader title="Веб-адрес меню" onBack={() => setFirstPublishStep("about")} />

                <div className="mt-4">
                  <div className={cn(
                    "flex h-9 overflow-hidden rounded-[8px] border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition focus-within:ring-2",
                    visibleAliasError
                      ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-100"
                      : "border-[#e5e5e5] focus-within:border-[#4f39f6] focus-within:ring-[#4f39f6]/15",
                  )}>
                    <Input
                      value={alias}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateWorkspace({ webAddress: value ? `${value}.tsqr.me` : "" });
                      }}
                      onBlur={() => setAliasTouched(true)}
                      aria-invalid={Boolean(visibleAliasError)}
                      aria-label="Веб-адрес меню"
                      aria-describedby="first-publish-address-status"
                      className="h-full min-w-0 flex-1 rounded-none border-0 px-3 text-[13px] shadow-none focus-visible:ring-0"
                    />
                    <span className="flex items-center border-l border-[#e5e5e5] bg-[#fafaf9] px-3 text-[13px] text-[#79716b]">.tsqr.me</span>
                  </div>
                  <div
                    id="first-publish-address-status"
                    role={visibleAliasError ? "alert" : undefined}
                    className={cn(
                      "mt-2 min-h-4 text-[13px] leading-4",
                      visibleAliasError ? "text-red-600" : "text-[#79716b]",
                    )}
                  >
                    {visibleAliasError ?? "Меню будет доступно по этому адресу"}
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={continueFromAddress}
                  className={cn("mt-5", FIRST_PUBLISH_PRIMARY_ACTION_CLASS)}
                >
                  Продолжить
                </Button>
              </div>
            )}

            {isFirstPublication && firstPublishStep === "contact" && (
              <div>
                <StepHeader title="Как к вам обращаться?" onBack={() => setFirstPublishStep("address")} />

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label>
                    <span className="sr-only">Имя</span>
                    <Input
                      value={account.firstName}
                      placeholder="Имя"
                      onChange={(event) => updateAccountProfile({ firstName: event.target.value })}
                      className={FIRST_PUBLISH_FIELD_CLASS}
                    />
                  </label>
                  <label>
                    <span className="sr-only">Фамилия</span>
                    <Input
                      value={account.lastName}
                      placeholder="Фамилия"
                      onChange={(event) => updateAccountProfile({ lastName: event.target.value })}
                      className={FIRST_PUBLISH_FIELD_CLASS}
                    />
                  </label>
                </div>

                <Button
                  type="button"
                  onClick={publishCurrentMenu}
                  disabled={!contactValid || isPublishing}
                  className={cn("mt-5", FIRST_PUBLISH_PRIMARY_ACTION_CLASS)}
                >
                  {isPublishing ? <Loader2 size={14} className="animate-spin" /> : null}
                  Опубликовать меню
                </Button>
              </div>
            )}

            {!isFirstPublication && (
              <div className="-m-4 overflow-hidden rounded-[13px]">
                <div className="p-4 pb-3">
                  <h2 className="text-[15px] font-semibold leading-5 text-[#292524]">
                    {hasUnpublishedChanges ? "Есть неопубликованные изменения" : "Опубликовано"}
                  </h2>
                  <p className="mt-1 text-[12px] leading-4 text-[#79716b]">
                    Последняя публикация — {formatRelativePublishTime(publishedAt, now)}
                  </p>

                  <div className="mt-4">
                    <div className="mb-1.5 text-[11px] font-semibold leading-4 text-[#57534d]">Website URL</div>
                    <div className="overflow-hidden rounded-[10px] border border-[#e7e5e4] bg-[#fafaf9]">
                      <div className="flex h-10 items-center gap-2 px-2">
                        <PublishGlobe className="h-4 w-4 shrink-0 text-[#79716b]" />

                        {editingAddress ? (
                          <div className="flex min-w-0 flex-1 items-center text-[13px] leading-5 text-[#292524]">
                            <input
                              ref={addressInputRef}
                              value={addressDraft}
                              onChange={(event) => setAddressDraft(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  saveAddress();
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  cancelAddressEditing();
                                }
                              }}
                              aria-label="Адрес витрины"
                              aria-invalid={!addressValid}
                              className="h-7 min-w-[32px] flex-1 border-0 bg-transparent p-0 text-[13px] leading-5 text-[#292524] outline-none selection:bg-[#615fff]/20"
                            />
                            <span className="shrink-0 text-[#79716b]">{addressParts.domain}</span>
                          </div>
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-[13px] leading-5 text-[#292524]">
                            {addressParts.slug}<span className="text-[#79716b]">{addressParts.domain}</span>
                          </span>
                        )}

                        <div className="flex shrink-0 items-center gap-0.5">
                          {editingAddress ? (
                            <>
                              <button
                                type="button"
                                onClick={cancelAddressEditing}
                                aria-label="Отменить изменение адреса"
                                className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-white hover:text-[#292524]"
                              >
                                <X size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={saveAddress}
                                disabled={!addressValid}
                                aria-label="Сохранить адрес"
                                className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#292524] text-white transition hover:bg-[#44403b] disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                <Check size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={beginAddressEditing}
                                aria-label="Изменить адрес"
                                className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-white hover:text-[#292524]"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void copyText(`https://${addressParts.slug}${addressParts.domain}`)}
                                aria-label="Скопировать адрес"
                                className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-white hover:text-[#292524]"
                              >
                                <Copy size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => { setOpen(false); onNavigate("storefront", "about:info"); }}
                        className="flex h-10 w-full items-center gap-2 border-t border-[#e7e5e4] px-2 text-left text-[12px] text-[#57534d] transition hover:bg-white"
                      >
                        <Eye size={15} className="shrink-0 text-[#79716b]" />
                        <span>{isDisabled ? "Недоступно гостям" : "Видно всем, у кого есть ссылка"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {hasUnpublishedChanges && (
                  <div className="flex justify-end border-t border-[#e7e5e4] bg-[#fafaf9] px-3 py-2.5">
                    <Button
                      type="button"
                      onClick={publishCurrentMenu}
                      disabled={!catalogHasVisibleItems || isPublishing}
                      className="h-8 rounded-[9px] bg-[#615fff] px-3 text-[12px] font-medium text-white hover:bg-[#5553ee]"
                    >
                      {isPublishing ? <Loader2 size={14} className="animate-spin" /> : null}
                      Опубликовать изменения
                    </Button>
                  </div>
                )}
              </div>
            )}
        </PopoverContent>
      </Popover>

      {menuPublishConfirmOpen && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="publish-menu-confirm-title">
          <div className="w-full max-w-[400px] rounded-[14px] border border-[#e7e5e4] bg-white p-5 shadow-[0_24px_80px_rgba(41,37,36,0.22)]">
            <h2 id="publish-menu-confirm-title" className="text-[16px] font-semibold leading-6 text-[#292524]">Опубликовать «{activeMenu.name}»?</h2>
            <p className="mt-2 text-[13px] leading-5 text-[#79716b]">
              Сейчас гости видят «{guestFacingMenu?.name ?? "меню"}». После публикации QR-код и ссылка останутся прежними, но будут открывать «{activeMenu.name}».
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setMenuPublishConfirmOpen(false)}>Отмена</Button>
              <Button type="button" size="sm" onClick={confirmMenuPublish} className="bg-[#292524] text-white hover:bg-[#44403b]">Опубликовать</Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
