import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowElbowUpRight,
  ArrowUUpLeft,
  CalendarBlank,
  CalendarDots,
  CaretRight,
  Check,
  CheckCircle,
  Copy,
  DotsThree,
  LockLaminated,
  NotePencil,
  Prohibit,
  Trash,
} from "@phosphor-icons/react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CatalogSchedulePopover,
  createDefaultWeeklySchedule,
  type WeeklySchedule,
} from "./catalog-schedule-editor";
import {
  CATALOG_DROPDOWN_CONTENT_CLASS,
  CATALOG_DROPDOWN_ITEM_CLASS,
  CATALOG_DROPDOWN_SEPARATOR_CLASS,
  CATALOG_SECTION_ACTION_CONTENT_CLASS,
  CATALOG_SECTION_ACTION_GROUP_CLASS,
  CATALOG_SECTION_ACTION_ITEM_CLASS,
  DropdownActionItem,
} from "./catalog-dropdown";

export type CatalogMenuAvailability = "available" | "stopped" | "scheduled";
export type CatalogStopDisplayMode = "hidden" | "comingSoon";

export type CatalogPositionAvailabilityMenuProps = {
  scheduleId: string;
  manualStopped: boolean;
  hasSchedule: boolean;
  mixed?: boolean;
  direct?: boolean;
  weeklySchedule: WeeklySchedule;
  stopDisplayMode: CatalogStopDisplayMode;
  outsideScheduleMode: CatalogStopDisplayMode;
  onManualStopChange: (stopped: boolean) => void;
  onScheduleChange: (schedule: WeeklySchedule, outsideScheduleMode: CatalogStopDisplayMode) => void;
  onScheduleDelete?: () => void;
  onStopDisplayModeChange: (mode: CatalogStopDisplayMode) => void;
  onActionComplete?: () => void;
  onMenuClose?: () => void;
  onScheduleEditorPinnedChange?: (pinned: boolean) => void;
  onStopEditorPinnedChange?: (pinned: boolean) => void;
};

type MenuItemProps = {
  children: ReactNode;
  onSelect?: (event: Event) => void;
  icon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  trailing?: ReactNode;
};

function SectionMenuItem({ children, onSelect, icon, tone = "default", disabled = false, trailing }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        CATALOG_SECTION_ACTION_ITEM_CLASS,
        tone === "danger" ? "text-[#c10007]" : "text-[#44403b]",
      )}
    >
      {icon && <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </DropdownMenu.Item>
  );
}

type AvailabilityScheduleSubmenuProps = {
  scheduleId: string;
  hasSchedule: boolean;
  weeklySchedule: WeeklySchedule;
  outsideScheduleMode: CatalogStopDisplayMode;
  onScheduleChange: (schedule: WeeklySchedule, outsideScheduleMode: CatalogStopDisplayMode) => void;
  onScheduleDelete: () => void;
  onActionComplete?: () => void;
  label?: string;
  triggerClassName?: string;
};

function AvailabilityScheduleSubmenu({
  scheduleId,
  hasSchedule,
  weeklySchedule,
  outsideScheduleMode,
  onScheduleChange,
  onScheduleDelete,
  onActionComplete,
  label,
  triggerClassName,
}: AvailabilityScheduleSubmenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Sub
      open={open}
      onOpenChange={setOpen}
    >
      <DropdownMenu.SubTrigger className={cn(triggerClassName ?? CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}>
        <CalendarBlank size={15} className="shrink-0 text-[#57534d]" />
        <span className="min-w-0 flex-1 truncate">{label ?? (hasSchedule ? "Расписание" : "Добавить расписание")}</span>
        <CaretRight size={14} weight="bold" className="shrink-0 text-[#a8a29e]" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          sideOffset={6}
          alignOffset={-4}
          collisionPadding={12}
          className="z-[100004] bg-transparent outline-none"
        >
          <CatalogSchedulePopover
            scheduleId={scheduleId}
            hasSchedule={hasSchedule}
            initialSchedule={weeklySchedule}
            initialOutsideScheduleMode={outsideScheduleMode}
            onChange={(schedule, nextOutsideScheduleMode) => {
              onScheduleChange(schedule, nextOutsideScheduleMode);
            }}
            onDelete={() => {
              onScheduleDelete();
              setOpen(false);
              onActionComplete?.();
            }}
          />
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

function StopDisplayOptions({
  value,
  manualStopped,
  keepOpenOnChange = false,
  optionsDisabled = false,
  comingSoonLabel = "Показывать как “скоро будет”",
  onChange,
  onResume,
}: {
  value?: CatalogStopDisplayMode;
  manualStopped: boolean;
  keepOpenOnChange?: boolean;
  optionsDisabled?: boolean;
  comingSoonLabel?: string;
  onChange: (mode: CatalogStopDisplayMode) => void;
  onResume?: () => void;
}) {
  return (
    <>
      <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onChange(next as CatalogStopDisplayMode)}>
        {([
          { value: "hidden", label: "Скрывать из меню" },
          { value: "comingSoon", label: comingSoonLabel },
        ] as const).map((option) => (
          <DropdownMenu.RadioItem
            key={option.value}
            value={option.value}
            disabled={optionsDisabled}
            onSelect={(event) => {
              if (keepOpenOnChange) event.preventDefault();
            }}
            className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}
          >
            <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border bg-white", value === option.value ? "border-[#292524]" : "border-[#d6d3d1]")}>
              <DropdownMenu.ItemIndicator>
                <span className="block size-2 rounded-full bg-[#292524]" />
              </DropdownMenu.ItemIndicator>
            </span>
            <span className="min-w-0 flex-1">{option.label}</span>
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
      {manualStopped && onResume && (
        <>
          <DropdownMenu.Separator className={CATALOG_DROPDOWN_SEPARATOR_CLASS} />
          <DropdownActionItem icon={ArrowUUpLeft} onSelect={onResume}>
            Убрать со стопа
          </DropdownActionItem>
        </>
      )}
    </>
  );
}

function StopDisplaySubmenu({
  value,
  manualStopped,
  onChange,
  onResume,
}: {
  value?: CatalogStopDisplayMode;
  manualStopped: boolean;
  onChange: (mode: CatalogStopDisplayMode) => void;
  onResume: () => void;
}) {
  return (
    <DropdownMenu.SubContent
      sideOffset={6}
      alignOffset={-5}
      collisionPadding={12}
      className={cn("z-[100004] min-w-[220px]", CATALOG_DROPDOWN_CONTENT_CLASS)}
    >
      <StopDisplayOptions
        value={value}
        manualStopped={manualStopped}
        onChange={onChange}
        onResume={onResume}
      />
    </DropdownMenu.SubContent>
  );
}

function StopAvailabilitySubmenu({
  manualStopped,
  stopDisplayMode,
  onManualStopChange,
  onStopDisplayModeChange,
  onResume,
  label,
}: {
  manualStopped: boolean;
  stopDisplayMode?: CatalogStopDisplayMode;
  onManualStopChange?: (stopped: boolean) => void;
  onStopDisplayModeChange: (mode: CatalogStopDisplayMode) => void;
  onResume?: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Sub open={open} onOpenChange={setOpen}>
      <DropdownMenu.SubTrigger className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}>
        <Prohibit size={15} className="shrink-0 text-[#57534d]" />
        <span className="min-w-0 flex-1 truncate">{label ?? (manualStopped ? "Позиция на стопе" : "Поставить на стоп")}</span>
        <CaretRight size={14} weight="bold" className="shrink-0 text-[#a8a29e]" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <StopDisplaySubmenu
          value={stopDisplayMode}
          manualStopped={manualStopped}
          onChange={(mode) => {
            onStopDisplayModeChange(mode);
            if (!manualStopped) onManualStopChange?.(true);
            setOpen(false);
          }}
          onResume={() => {
            onResume?.();
            onManualStopChange?.(false);
            setOpen(false);
          }}
        />
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

function CascadeAvailabilitySubTrigger({
  checked,
  icon,
  label,
}: {
  checked: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <>
      <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border bg-white", checked ? "border-[#292524]" : "border-[#d6d3d1]")}>
        {checked && <span className="block size-2 rounded-full bg-[#292524]" />}
      </span>
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <CaretRight size={14} weight="bold" aria-hidden="true" className="shrink-0 text-[#a8a29e]" />
    </>
  );
}

export function CatalogPositionAvailabilityMenu({
  scheduleId,
  manualStopped,
  hasSchedule,
  mixed = false,
  direct = false,
  weeklySchedule,
  stopDisplayMode,
  outsideScheduleMode,
  onManualStopChange,
  onScheduleChange,
  onStopDisplayModeChange,
  onScheduleEditorPinnedChange,
  onStopEditorPinnedChange,
}: CatalogPositionAvailabilityMenuProps) {
  const [open, setOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState(weeklySchedule);
  const [outsideScheduleDraft, setOutsideScheduleDraft] = useState(outsideScheduleMode);
  const availability: CatalogMenuAvailability | null = mixed
    ? null
    : manualStopped
      ? "stopped"
      : hasSchedule
        ? "scheduled"
        : "available";
  const availabilityMeta = mixed
    ? {
        label: "Смешанное состояние",
        icon: <DotsThree size={16} weight="bold" aria-hidden="true" />,
      }
    : {
        available: {
          label: "Доступно",
          icon: <CheckCircle size={16} weight="regular" aria-hidden="true" />,
        },
        stopped: {
          label: "На стопе",
          icon: <LockLaminated size={16} aria-hidden="true" />,
        },
        scheduled: {
          label: "По расписанию",
          icon: <CalendarDots size={16} aria-hidden="true" />,
        },
    }[availability as CatalogMenuAvailability];

  const selectStopDisplayMode = (mode: CatalogStopDisplayMode) => {
    onStopDisplayModeChange(mode);
    if (!manualStopped) onManualStopChange(true);
  };

  const setStopEditorOpen = (nextOpen: boolean) => {
    setStopOpen(nextOpen);
    onStopEditorPinnedChange?.(nextOpen);
  };

  const setScheduleEditorOpen = (nextOpen: boolean) => {
    setScheduleOpen(nextOpen);
    onScheduleEditorPinnedChange?.(nextOpen);
  };

  const menuContent = (
    <DropdownMenu.RadioGroup value={availability ?? undefined}>
            <DropdownMenu.RadioItem
              value="available"
              onClick={(event) => event.stopPropagation()}
              onSelect={(event) => {
                event.preventDefault();
                setStopEditorOpen(false);
                setScheduleEditorOpen(false);
                onManualStopChange(false);
              }}
              className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-[#d6d3d1] bg-white">
                <DropdownMenu.ItemIndicator>
                  <span className="block size-2 rounded-full bg-[#292524]" />
                </DropdownMenu.ItemIndicator>
              </span>
              <CheckCircle size={14} aria-hidden="true" />
              <span className="min-w-0 flex-1">Доступно</span>
            </DropdownMenu.RadioItem>

            <Popover
              open={stopOpen}
              modal={false}
              onOpenChange={setStopEditorOpen}
            >
              <PopoverAnchor asChild>
                <DropdownMenu.Item
                  role="menuitemradio"
                  aria-checked={availability === "stopped"}
                  onClick={(event) => event.stopPropagation()}
                  onSelect={(event) => {
                    event.preventDefault();
                    setScheduleEditorOpen(false);
                    onManualStopChange(true);
                    setStopEditorOpen(true);
                  }}
                  className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}
                >
                  <CascadeAvailabilitySubTrigger
                    checked={availability === "stopped"}
                    icon={<LockLaminated size={14} aria-hidden="true" />}
                    label="На стопе"
                  />
                </DropdownMenu.Item>
              </PopoverAnchor>
              <PopoverContent
                data-catalog-stop-popover
                side="right"
                align="start"
                sideOffset={6}
                collisionPadding={12}
                onClick={(event) => event.stopPropagation()}
                onFocusOutside={(event) => event.preventDefault()}
                className={cn("z-[100005] min-w-[176px]", CATALOG_DROPDOWN_CONTENT_CLASS)}
              >
                <div className="flex h-5 items-center px-2 text-[11px] leading-4 text-[#79716b]">
                  Отображение в меню
                </div>
                <StopDisplayOptions
                  value={mixed ? undefined : manualStopped ? stopDisplayMode : undefined}
                  manualStopped={false}
                  keepOpenOnChange
                  comingSoonLabel="Как «скоро будет»"
                  onChange={selectStopDisplayMode}
                />
              </PopoverContent>
            </Popover>

            <DropdownMenu.Sub
              open={scheduleOpen}
              onOpenChange={() => undefined}
            >
              <DropdownMenu.SubTrigger
                role="menuitemradio"
                aria-checked={availability === "scheduled"}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  setStopEditorOpen(false);
                  if (availability !== "scheduled") {
                    onScheduleChange(scheduleDraft, outsideScheduleDraft);
                  }
                  setScheduleEditorOpen(true);
                }}
                className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}
              >
                <CascadeAvailabilitySubTrigger
                  checked={availability === "scheduled"}
                  icon={<CalendarDots size={14} aria-hidden="true" />}
                  label="По расписанию"
                />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  sideOffset={6}
                  alignOffset={-5}
                  collisionPadding={12}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDownOutside={(event) => event.preventDefault()}
                  onInteractOutside={(event) => event.preventDefault()}
                  onFocusOutside={(event) => event.preventDefault()}
                  onEscapeKeyDown={(event) => {
                    event.preventDefault();
                    setScheduleEditorOpen(false);
                  }}
                  className="z-[100005] bg-transparent outline-none"
                >
                  <CatalogSchedulePopover
                    scheduleId={scheduleId}
                    hasSchedule={availability === "scheduled"}
                    initialSchedule={scheduleDraft}
                    initialOutsideScheduleMode={outsideScheduleDraft}
                    layout="cascade"
                    onClose={() => setScheduleEditorOpen(false)}
                    onChange={(schedule, outsideMode) => {
                      setScheduleDraft(schedule);
                      setOutsideScheduleDraft(outsideMode);
                      onScheduleChange(schedule, outsideMode);
                    }}
                    showDelete={false}
                  />
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
    </DropdownMenu.RadioGroup>
  );

  if (direct) return menuContent;

  return (
    <DropdownMenu.Sub
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && scheduleOpen) return;
        setOpen(nextOpen);
        if (!nextOpen) {
          setStopEditorOpen(false);
          setScheduleEditorOpen(false);
        }
      }}
    >
      <DropdownMenu.SubTrigger
        onPointerMove={() => setOpen(true)}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
        className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "font-medium text-[#292524]")}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">{availabilityMeta.icon}</span>
        <span className="min-w-0 flex-1 truncate">{availabilityMeta.label}</span>
        <CaretRight size={14} weight="bold" aria-hidden="true" className="shrink-0 text-[#a8a29e]" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          sideOffset={6}
          alignOffset={-5}
          collisionPadding={12}
          className={cn("z-[100004] min-w-[190px]", CATALOG_DROPDOWN_CONTENT_CLASS)}
        >
          {menuContent}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

export type CatalogSectionAvailabilityMenuProps = {
  scheduleId: string;
  manualStopped: boolean;
  hasSchedule: boolean;
  weeklySchedule: WeeklySchedule;
  outsideScheduleMode: CatalogStopDisplayMode;
  onManualStopChange: (stopped: boolean) => void;
  onScheduleChange: (schedule: WeeklySchedule, outsideScheduleMode: CatalogStopDisplayMode) => void;
  onScheduleDelete: () => void;
  onActionComplete?: () => void;
};

export function CatalogSectionAvailabilityMenu({
  scheduleId,
  manualStopped,
  hasSchedule,
  weeklySchedule,
  outsideScheduleMode,
  onManualStopChange,
  onScheduleChange,
  onScheduleDelete,
  onActionComplete,
}: CatalogSectionAvailabilityMenuProps) {
  const [open, setOpen] = useState(false);
  const availabilityMeta = manualStopped
    ? { label: "На стопе", icon: <LockLaminated size={16} aria-hidden="true" /> }
    : hasSchedule
      ? { label: "По расписанию", icon: <CalendarDots size={16} aria-hidden="true" /> }
      : { label: "Доступно", icon: <CheckCircle size={16} aria-hidden="true" /> };

  return (
    <DropdownMenu.Sub open={open} onOpenChange={setOpen}>
      <DropdownMenu.SubTrigger
        onPointerMove={() => setOpen(true)}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
        className={cn(CATALOG_SECTION_ACTION_ITEM_CLASS, "text-[#44403b]")}
      >
        <span className="flex size-4 shrink-0 items-center justify-center text-[#57534d]">{availabilityMeta.icon}</span>
        <span className="min-w-0 flex-1 truncate">{availabilityMeta.label}</span>
        <CaretRight size={12} weight="bold" aria-hidden="true" className="shrink-0 text-[#a8a29e]" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          sideOffset={6}
          alignOffset={-5}
          collisionPadding={12}
          className={cn("z-[100004]", CATALOG_SECTION_ACTION_CONTENT_CLASS)}
        >
          <div className="p-1">
            <DropdownMenu.Item
              onSelect={() => {
                onManualStopChange(!manualStopped);
                onActionComplete?.();
              }}
              className={cn(CATALOG_SECTION_ACTION_ITEM_CLASS, "text-[#44403b]")}
            >
              {manualStopped
                ? <ArrowCounterClockwise size={16} className="shrink-0 text-[#57534d]" />
                : <Prohibit size={16} className="shrink-0 text-[#57534d]" />}
              <span>{manualStopped ? "Снять со стопа" : "Поставить на стоп"}</span>
            </DropdownMenu.Item>
            <AvailabilityScheduleSubmenu
              scheduleId={scheduleId}
              hasSchedule={hasSchedule}
              weeklySchedule={weeklySchedule}
              outsideScheduleMode={outsideScheduleMode}
              onScheduleChange={onScheduleChange}
              onScheduleDelete={onScheduleDelete}
              onActionComplete={onActionComplete}
              triggerClassName={CATALOG_SECTION_ACTION_ITEM_CLASS}
            />
          </div>
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

export function CatalogAvailabilityMenu({
  scheduleId,
  availability,
  stopDisplayMode,
  outsideScheduleMode,
  weeklySchedule,
  onAvailabilityChange,
  onStopDisplayModeChange,
  onOutsideScheduleModeChange,
  onWeeklyScheduleChange,
  onResetSchedule,
}: {
  scheduleId: string;
  availability: CatalogMenuAvailability;
  stopDisplayMode: CatalogStopDisplayMode;
  outsideScheduleMode: CatalogStopDisplayMode;
  weeklySchedule: WeeklySchedule;
  onAvailabilityChange: (value: CatalogMenuAvailability) => void;
  onStopDisplayModeChange: (value: CatalogStopDisplayMode) => void;
  onOutsideScheduleModeChange: (value: CatalogStopDisplayMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
  onResetSchedule: () => void;
}) {
  return (
    <>
      <DropdownMenu.Item
        onSelect={() => onAvailabilityChange("available")}
        className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-[7px] px-2 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
      >
        <span className="min-w-0 flex-1 truncate">Доступно</span>
        {availability === "available" && <Check size={14} weight="bold" className="shrink-0" />}
      </DropdownMenu.Item>
      <StopAvailabilitySubmenu
        manualStopped={availability === "stopped"}
        stopDisplayMode={stopDisplayMode}
        onManualStopChange={(stopped) => onAvailabilityChange(stopped ? "stopped" : "available")}
        onStopDisplayModeChange={(value) => {
          onStopDisplayModeChange(value);
          onAvailabilityChange("stopped");
        }}
      />
      <AvailabilityScheduleSubmenu
        scheduleId={scheduleId}
        hasSchedule={availability === "scheduled"}
        weeklySchedule={weeklySchedule}
        outsideScheduleMode={outsideScheduleMode}
        onScheduleChange={(schedule, outsideMode) => {
          onAvailabilityChange("scheduled");
          onOutsideScheduleModeChange(outsideMode);
          onWeeklyScheduleChange(schedule);
        }}
        onScheduleDelete={() => {
          onResetSchedule();
          onAvailabilityChange("available");
        }}
      />
    </>
  );
}

type EntityMenuProps = {
  entity: "section" | "item";
  showAvailability?: boolean;
  imageUrl?: string | null;
  scheduleId: string;
  availability: CatalogMenuAvailability;
  stopDisplayMode: CatalogStopDisplayMode;
  outsideScheduleMode: CatalogStopDisplayMode;
  weeklySchedule: WeeklySchedule;
  archiveDisabled?: boolean;
  onChangeIcon?: (event: Event) => void;
  onRename: (event: Event) => void;
  onMove: (event: Event | ReactPointerEvent<HTMLElement>) => void;
  onDuplicate?: () => void;
  onAvailabilityChange: (value: CatalogMenuAvailability) => void;
  onStopDisplayModeChange: (value: CatalogStopDisplayMode) => void;
  onOutsideScheduleModeChange: (value: CatalogStopDisplayMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
  onResetSchedule: () => void;
  onArchive: () => void;
  onDelete: () => void;
  positionAvailability?: CatalogPositionAvailabilityMenuProps;
  sectionAvailability?: CatalogSectionAvailabilityMenuProps;
  sectionPrimaryAction?: ReactNode;
};

export function CatalogContextMenuContent({
  entity,
  showAvailability = true,
  imageUrl,
  scheduleId,
  availability,
  stopDisplayMode,
  outsideScheduleMode,
  weeklySchedule,
  archiveDisabled = false,
  onChangeIcon,
  onRename,
  onMove,
  onDuplicate,
  onAvailabilityChange,
  onStopDisplayModeChange,
  onOutsideScheduleModeChange,
  onWeeklyScheduleChange,
  onResetSchedule,
  onArchive,
  onDelete,
  positionAvailability,
  sectionAvailability,
  sectionPrimaryAction,
}: EntityMenuProps) {
  const itemAvailability = entity === "item" && showAvailability ? positionAvailability : undefined;

  if (entity === "section") {
    return (
      <div data-catalog-section-actions>
        <div className={CATALOG_SECTION_ACTION_GROUP_CLASS}>
          {sectionPrimaryAction}
          {onChangeIcon && (
            <SectionMenuItem
              onSelect={onChangeIcon}
              trailing={<CaretRight size={12} weight="bold" aria-hidden="true" className="shrink-0 text-[#a8a29e]" />}
              icon={imageUrl ? (
                <span className="flex size-4 overflow-hidden rounded-[4px]">
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                </span>
              ) : (
                <span className="size-4 rounded-[4px] border border-dashed border-[#292524]" />
              )}
            >
              {imageUrl ? "Изменить иконку" : "Выбрать иконку"}
            </SectionMenuItem>
          )}
        </div>
        {showAvailability && (
          <div className={CATALOG_SECTION_ACTION_GROUP_CLASS}>
            {sectionAvailability ? (
              <CatalogSectionAvailabilityMenu {...sectionAvailability} />
            ) : (
              <CatalogAvailabilityMenu
                scheduleId={scheduleId}
                availability={availability}
                stopDisplayMode={stopDisplayMode}
                outsideScheduleMode={outsideScheduleMode}
                weeklySchedule={weeklySchedule}
                onAvailabilityChange={onAvailabilityChange}
                onStopDisplayModeChange={onStopDisplayModeChange}
                onOutsideScheduleModeChange={onOutsideScheduleModeChange}
                onWeeklyScheduleChange={onWeeklyScheduleChange}
                onResetSchedule={onResetSchedule}
              />
            )}
          </div>
        )}
        <div className={CATALOG_SECTION_ACTION_GROUP_CLASS}>
          <SectionMenuItem
            onSelect={onRename}
            icon={<img src="/assets/catalog/note-pencil.svg" alt="" className="size-4" />}
          >
            Переименовать
          </SectionMenuItem>
          <DropdownMenu.Item
            aria-haspopup="menu"
            onPointerEnter={onMove}
            onSelect={(event) => {
              event.preventDefault();
              onMove(event);
            }}
            className={cn(CATALOG_SECTION_ACTION_ITEM_CLASS, "text-[#44403b]")}
          >
            <ArrowElbowUpRight size={16} weight="regular" className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">Переместить</span>
            <CaretRight size={12} weight="bold" aria-hidden="true" className="shrink-0 text-[#a8a29e]" />
          </DropdownMenu.Item>
        </div>
        <div className={CATALOG_SECTION_ACTION_GROUP_CLASS}>
          <SectionMenuItem disabled={archiveDisabled} onSelect={onArchive} icon={<Archive size={16} />}>Архивировать</SectionMenuItem>
          <SectionMenuItem tone="danger" onSelect={onDelete} icon={<Trash size={16} />}>Удалить</SectionMenuItem>
        </div>
      </div>
    );
  }

  return (
    <>
      {itemAvailability && (
        <>
          <CatalogPositionAvailabilityMenu {...itemAvailability} />
          <DropdownMenu.Separator className={CATALOG_DROPDOWN_SEPARATOR_CLASS} />
        </>
      )}
      <DropdownActionItem icon={NotePencil} onSelect={onRename}>Переименовать</DropdownActionItem>
      <DropdownMenu.Item
        aria-haspopup="menu"
        onPointerEnter={onMove}
        onSelect={(event) => {
          event.preventDefault();
          onMove(event);
        }}
        className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}
      >
        <ArrowElbowUpRight size={15} weight="regular" className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">Переместить</span>
        <CaretRight size={14} weight="bold" aria-hidden="true" className="shrink-0 text-[#a8a29e]" />
      </DropdownMenu.Item>
      {onDuplicate && <DropdownActionItem icon={Copy} onSelect={onDuplicate}>Создать копию</DropdownActionItem>}
      <DropdownMenu.Separator className={CATALOG_DROPDOWN_SEPARATOR_CLASS} />
      {showAvailability && !itemAvailability && (
        <>
          {positionAvailability ? (
            <CatalogPositionAvailabilityMenu {...positionAvailability} />
          ) : (
            <CatalogAvailabilityMenu
              scheduleId={scheduleId}
              availability={availability}
              stopDisplayMode={stopDisplayMode}
              outsideScheduleMode={outsideScheduleMode}
              weeklySchedule={weeklySchedule}
              onAvailabilityChange={onAvailabilityChange}
              onStopDisplayModeChange={onStopDisplayModeChange}
              onOutsideScheduleModeChange={onOutsideScheduleModeChange}
              onWeeklyScheduleChange={onWeeklyScheduleChange}
              onResetSchedule={onResetSchedule}
            />
          )}
          <DropdownMenu.Separator className={CATALOG_DROPDOWN_SEPARATOR_CLASS} />
        </>
      )}
      <DropdownActionItem icon={Archive} disabled={archiveDisabled} onSelect={onArchive}>Архивировать</DropdownActionItem>
      <DropdownActionItem icon={Trash} tone="danger" onSelect={onDelete}>Удалить</DropdownActionItem>
    </>
  );
}

export { createDefaultWeeklySchedule };
