import { useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowElbowUpRight,
  ArrowUUpLeft,
  CalendarBlank,
  CaretRight,
  Check,
  Copy,
  NotePencil,
  PlusCircle,
  Prohibit,
  Trash,
} from "@phosphor-icons/react";
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
  DropdownActionItem,
} from "./catalog-dropdown";

export type CatalogMenuAvailability = "available" | "stopped" | "scheduled";
export type CatalogStopDisplayMode = "hidden" | "comingSoon";

export type CatalogPositionAvailabilityMenuProps = {
  scheduleId: string;
  manualStopped: boolean;
  hasSchedule: boolean;
  weeklySchedule: WeeklySchedule;
  stopDisplayMode: CatalogStopDisplayMode;
  outsideScheduleMode: CatalogStopDisplayMode;
  onManualStopChange: (stopped: boolean) => void;
  onScheduleChange: (schedule: WeeklySchedule, outsideScheduleMode: CatalogStopDisplayMode) => void;
  onScheduleDelete: () => void;
  onStopDisplayModeChange: (mode: CatalogStopDisplayMode) => void;
  onActionComplete?: () => void;
};

type MenuItemProps = {
  children: ReactNode;
  onSelect?: (event: Event) => void;
  icon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
};

function MenuItem({ children, onSelect, icon, tone = "default", disabled = false }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        CATALOG_DROPDOWN_ITEM_CLASS,
        tone === "danger" ? "text-[#c10007]" : "text-[#44403b]",
      )}
    >
      {icon && <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
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
}: AvailabilityScheduleSubmenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Sub
      open={open}
      onOpenChange={setOpen}
    >
      <DropdownMenu.SubTrigger className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}>
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
      <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onChange(next as CatalogStopDisplayMode)}>
        {([
          { value: "hidden", label: "Скрывать из меню" },
          { value: "comingSoon", label: "Показывать как “скоро будет”" },
        ] as const).map((option) => (
          <DropdownMenu.RadioItem
            key={option.value}
            value={option.value}
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
      {manualStopped && (
        <>
          <DropdownMenu.Separator className={CATALOG_DROPDOWN_SEPARATOR_CLASS} />
          <DropdownActionItem icon={ArrowUUpLeft} onSelect={onResume}>
            Убрать со стопа
          </DropdownActionItem>
        </>
      )}
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

export function CatalogPositionAvailabilityMenu({
  scheduleId,
  manualStopped,
  hasSchedule,
  weeklySchedule,
  stopDisplayMode,
  outsideScheduleMode,
  onManualStopChange,
  onScheduleChange,
  onScheduleDelete,
  onStopDisplayModeChange,
  onActionComplete,
}: CatalogPositionAvailabilityMenuProps) {
  return (
    <>
      <StopAvailabilitySubmenu
        manualStopped={manualStopped}
        stopDisplayMode={stopDisplayMode}
        onManualStopChange={onManualStopChange}
        onStopDisplayModeChange={onStopDisplayModeChange}
      />
      <AvailabilityScheduleSubmenu
        scheduleId={scheduleId}
        hasSchedule={hasSchedule}
        weeklySchedule={weeklySchedule}
        outsideScheduleMode={outsideScheduleMode}
        onScheduleChange={onScheduleChange}
        onScheduleDelete={onScheduleDelete}
        onActionComplete={onActionComplete}
      />
      <DropdownMenu.Separator className={CATALOG_DROPDOWN_SEPARATOR_CLASS} />
    </>
  );
}

export type CatalogBulkAvailabilityMenuProps = {
  scheduleId: string;
  hasStopped: boolean;
  hasSchedule: boolean;
  weeklySchedule: WeeklySchedule;
  outsideScheduleMode: CatalogStopDisplayMode;
  onStopDisplayModeChange: (mode: CatalogStopDisplayMode) => void;
  onRemoveStop: () => void;
  onScheduleChange: (schedule: WeeklySchedule, outsideScheduleMode: CatalogStopDisplayMode) => void;
  onScheduleDelete: () => void;
};

export function CatalogBulkAvailabilityMenu({
  scheduleId,
  hasStopped,
  hasSchedule,
  weeklySchedule,
  outsideScheduleMode,
  onStopDisplayModeChange,
  onRemoveStop,
  onScheduleChange,
  onScheduleDelete,
}: CatalogBulkAvailabilityMenuProps) {
  return (
    <>
      <StopAvailabilitySubmenu
        label="Поставить на стоп"
        manualStopped={hasStopped}
        onStopDisplayModeChange={onStopDisplayModeChange}
        onResume={onRemoveStop}
      />
      <AvailabilityScheduleSubmenu
        label={hasSchedule ? "Изменить расписание" : "Добавить расписание"}
        scheduleId={scheduleId}
        hasSchedule={hasSchedule}
        weeklySchedule={weeklySchedule}
        outsideScheduleMode={outsideScheduleMode}
        onScheduleChange={onScheduleChange}
        onScheduleDelete={onScheduleDelete}
      />
    </>
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
  return (
    <>
      <DropdownMenu.Item
        onSelect={() => onManualStopChange(!manualStopped)}
        className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}
      >
        {manualStopped
          ? <ArrowCounterClockwise size={15} className="shrink-0 text-[#57534d]" />
          : <Prohibit size={15} className="shrink-0 text-[#57534d]" />}
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
      />
    </>
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
  onMove: (event: Event) => void;
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
}: EntityMenuProps) {
  return (
    <>
      {entity === "section" && onChangeIcon && (
        <MenuItem
          onSelect={onChangeIcon}
          icon={(
            <span className="flex size-4 items-center justify-center overflow-hidden rounded-[3px] bg-[#f1f5f9] text-[#94a3b8]">
              {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <PlusCircle size={12} />}
            </span>
          )}
        >
          {imageUrl ? "Поменять иконку" : "Добавить иконку"}
        </MenuItem>
      )}
      <DropdownActionItem icon={NotePencil} onSelect={onRename}>Переименовать</DropdownActionItem>
      <DropdownActionItem icon={ArrowElbowUpRight} onSelect={onMove}>Переместить</DropdownActionItem>
      {entity === "item" && onDuplicate && <DropdownActionItem icon={Copy} onSelect={onDuplicate}>Создать копию</DropdownActionItem>}
      <DropdownMenu.Separator className={CATALOG_DROPDOWN_SEPARATOR_CLASS} />
      {showAvailability && (
        <>
          {entity === "item" && positionAvailability ? (
            <CatalogPositionAvailabilityMenu {...positionAvailability} />
          ) : entity === "section" && sectionAvailability ? (
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
          <DropdownMenu.Separator className={CATALOG_DROPDOWN_SEPARATOR_CLASS} />
        </>
      )}
      <DropdownActionItem icon={Archive} disabled={archiveDisabled} onSelect={onArchive}>Архивировать</DropdownActionItem>
      <DropdownActionItem icon={Trash} tone="danger" onSelect={onDelete}>Удалить</DropdownActionItem>
    </>
  );
}

export { createDefaultWeeklySchedule };
