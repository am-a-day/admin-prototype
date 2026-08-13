import { useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowElbowUpRight,
  CalendarBlank,
  CaretRight,
  CheckCircle,
  Check,
  Copy,
  Eye,
  NotePencil,
  PlusCircle,
  Prohibit,
  Trash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  CatalogSchedulePopover,
  CatalogWeeklyScheduleEditor,
  createDefaultWeeklySchedule,
  type AvailabilityScheduleMode,
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
  scheduleMode: AvailabilityScheduleMode;
  weeklySchedule: WeeklySchedule;
  unavailableDisplayMode: CatalogStopDisplayMode;
  onManualStopChange: (stopped: boolean) => void;
  onScheduleSave: (schedule: WeeklySchedule, mode: AvailabilityScheduleMode) => void;
  onScheduleDelete: () => void;
  onUnavailableDisplayModeChange: (mode: CatalogStopDisplayMode) => void;
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
  scheduleMode: AvailabilityScheduleMode;
  weeklySchedule: WeeklySchedule;
  onScheduleSave: (schedule: WeeklySchedule, mode: AvailabilityScheduleMode) => void;
  onScheduleDelete: () => void;
  onActionComplete?: () => void;
};

function AvailabilityScheduleSubmenu({
  scheduleId,
  hasSchedule,
  scheduleMode,
  weeklySchedule,
  onScheduleSave,
  onScheduleDelete,
  onActionComplete,
}: AvailabilityScheduleSubmenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Sub
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(true);
      }}
    >
      <DropdownMenu.SubTrigger className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}>
        <CalendarBlank size={15} className="shrink-0 text-[#57534d]" />
        <span className="min-w-0 flex-1 truncate">{hasSchedule ? "Расписание" : "Добавить расписание"}</span>
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
            initialMode={scheduleMode}
            initialSchedule={weeklySchedule}
            onCancel={() => setOpen(false)}
            onDelete={() => {
              onScheduleDelete();
              setOpen(false);
              onActionComplete?.();
            }}
            onSave={(schedule, mode) => {
              onScheduleSave(schedule, mode);
              setOpen(false);
              onActionComplete?.();
            }}
          />
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

function UnavailableBehaviorSubmenu({
  value,
  onChange,
}: {
  value: CatalogStopDisplayMode;
  onChange: (mode: CatalogStopDisplayMode) => void;
}) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}>
        <Eye size={15} className="shrink-0 text-[#57534d]" />
        <span className="min-w-0 flex-1 truncate">Когда недоступно</span>
        <CaretRight size={14} weight="bold" className="shrink-0 text-[#a8a29e]" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          sideOffset={6}
          alignOffset={-5}
          collisionPadding={12}
          className={cn("z-[100004] w-[300px]", CATALOG_DROPDOWN_CONTENT_CLASS)}
        >
          <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onChange(next as CatalogStopDisplayMode)}>
            {([
              { value: "hidden", title: "Скрывать позицию", description: "Не показывать в меню" },
              { value: "comingSoon", title: "Показывать «Скоро будет»", description: "Оставить в меню без возможности заказа" },
            ] as const).map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                className="flex min-h-12 cursor-pointer select-none items-start gap-2.5 rounded-lg px-2.5 py-2 outline-none transition data-[highlighted]:bg-[#f5f5f4] data-[state=checked]:bg-[#fafaf9]"
              >
                <span className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  value === option.value ? "border-[#292524] bg-[#292524]" : "border-[#d6d3d1] bg-white",
                )}>
                  {value === option.value && <span className="size-1.5 rounded-full bg-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium leading-4 text-[#292524]">{option.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-[#79716b]">{option.description}</span>
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

export function CatalogPositionAvailabilityMenu({
  scheduleId,
  manualStopped,
  hasSchedule,
  scheduleMode,
  weeklySchedule,
  unavailableDisplayMode,
  onManualStopChange,
  onScheduleSave,
  onScheduleDelete,
  onUnavailableDisplayModeChange,
  onActionComplete,
}: CatalogPositionAvailabilityMenuProps) {
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
        scheduleMode={scheduleMode}
        weeklySchedule={weeklySchedule}
        onScheduleSave={onScheduleSave}
        onScheduleDelete={onScheduleDelete}
        onActionComplete={onActionComplete}
      />
      <DropdownMenu.Separator className={CATALOG_DROPDOWN_SEPARATOR_CLASS} />
      <UnavailableBehaviorSubmenu
        value={unavailableDisplayMode}
        onChange={onUnavailableDisplayModeChange}
      />
    </>
  );
}

export type CatalogSectionAvailabilityMenuProps = {
  scheduleId: string;
  manualStopped: boolean;
  hasSchedule: boolean;
  scheduleMode: AvailabilityScheduleMode;
  weeklySchedule: WeeklySchedule;
  onManualStopChange: (stopped: boolean) => void;
  onScheduleSave: (schedule: WeeklySchedule, mode: AvailabilityScheduleMode) => void;
  onScheduleDelete: () => void;
  onActionComplete?: () => void;
};

export function CatalogSectionAvailabilityMenu({
  scheduleId,
  manualStopped,
  hasSchedule,
  scheduleMode,
  weeklySchedule,
  onManualStopChange,
  onScheduleSave,
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
        scheduleMode={scheduleMode}
        weeklySchedule={weeklySchedule}
        onScheduleSave={onScheduleSave}
        onScheduleDelete={onScheduleDelete}
        onActionComplete={onActionComplete}
      />
    </>
  );
}

function ContextSubTrigger({
  children,
  icon,
  selected = false,
  onClick,
}: {
  children: ReactNode;
  icon?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <DropdownMenu.SubTrigger
      onClick={onClick}
      className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}
    >
      {icon && <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected && <Check size={14} weight="bold" className="shrink-0 text-[#44403b]" />}
      <CaretRight size={14} weight="bold" className="shrink-0 text-[#a8a29e]" />
    </DropdownMenu.SubTrigger>
  );
}

function StopDisplaySubmenu({
  value,
  onChange,
}: {
  value: CatalogStopDisplayMode;
  onChange: (value: CatalogStopDisplayMode) => void;
}) {
  return (
    <DropdownMenu.SubContent
      sideOffset={5}
      alignOffset={-5}
      className="z-[100003] min-w-[168px] rounded-[6px] border border-[#e2e8f0] bg-white p-1 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1)] outline-none"
    >
      <DropdownActionItem onSelect={() => onChange("comingSoon")}>Скоро будет</DropdownActionItem>
      <DropdownActionItem onSelect={() => onChange("hidden")}>Скрыть</DropdownActionItem>
      <span className="sr-only">Текущий вариант: {value === "comingSoon" ? "Скоро будет" : "Скрыть"}</span>
    </DropdownMenu.SubContent>
  );
}

function ScheduleSubmenu({
  scheduleId,
  outsideScheduleMode,
  weeklySchedule,
  onOutsideScheduleModeChange,
  onWeeklyScheduleChange,
  onReset,
}: {
  scheduleId: string;
  outsideScheduleMode: CatalogStopDisplayMode;
  weeklySchedule: WeeklySchedule;
  onOutsideScheduleModeChange: (value: CatalogStopDisplayMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
  onReset: () => void;
}) {
  return (
    <DropdownMenu.SubContent
      sideOffset={5}
      alignOffset={-5}
      collisionPadding={12}
      className="z-[100003] w-[356px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[6px] border border-[#e2e8f0] bg-white p-2 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1)] outline-none"
    >
      <div className="flex items-center justify-between gap-3 px-2 pb-2">
        <div>
          <div className="text-[13px] font-medium text-[#292524]">По расписанию</div>
          <div className="mt-0.5 text-[11px] leading-4 text-[#a8a29e]">Настройте дни и часы доступности</div>
        </div>
        <span className="rounded-[4px] bg-[#f8fafc] px-1.5 py-1 text-[10px] text-[#64748b]">Автосохранение</span>
      </div>
      <div className="border-y border-[#eef2f7] py-2">
        <div className="flex items-center justify-between gap-2 px-2 pb-1.5">
          <span className="text-[12px] font-medium text-[#57534d]">Вне расписания</span>
          <div className="inline-flex rounded-[6px] bg-[#f5f5f4] p-0.5" role="group" aria-label="Вне расписания">
            {(["comingSoon", "hidden"] as CatalogStopDisplayMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={outsideScheduleMode === mode}
                onClick={() => onOutsideScheduleModeChange(mode)}
                className={cn(
                  "rounded-[5px] px-2 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                  outsideScheduleMode === mode ? "bg-white text-[#292524] shadow-sm" : "text-[#79716b] hover:text-[#292524]",
                )}
              >
                {mode === "comingSoon" ? "Скоро будет" : "Скрыть"}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[330px] overflow-y-auto px-0.5 [scrollbar-width:thin]">
          <CatalogWeeklyScheduleEditor
            scheduleId={scheduleId}
            weeklySchedule={weeklySchedule}
            onWeeklyScheduleChange={onWeeklyScheduleChange}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="mt-2 flex h-7 w-full items-center rounded-[6px] px-2 text-left text-[12px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      >
        Сбросить расписание
      </button>
    </DropdownMenu.SubContent>
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
  const [openSubmenu, setOpenSubmenu] = useState<"stop" | "schedule" | null>(null);

  return (
    <>
      <DropdownMenu.Item
        onSelect={() => onAvailabilityChange("available")}
        className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-[7px] px-2 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
      >
        <span className="min-w-0 flex-1 truncate">Доступно</span>
        {availability === "available" && <Check size={14} weight="bold" className="shrink-0" />}
      </DropdownMenu.Item>
      <DropdownMenu.Sub
        open={openSubmenu === "stop"}
        onOpenChange={(open) => {
          setOpenSubmenu(open ? "stop" : null);
        }}
      >
        <ContextSubTrigger icon={<CheckCircle size={16} weight="regular" />} selected={availability === "stopped"}>
          На стопе
        </ContextSubTrigger>
        <DropdownMenu.Portal>
          <StopDisplaySubmenu
            value={stopDisplayMode}
            onChange={(value) => {
              onStopDisplayModeChange(value);
              onAvailabilityChange("stopped");
              setOpenSubmenu(null);
            }}
          />
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
      <DropdownMenu.Sub
        open={openSubmenu === "schedule"}
        onOpenChange={(open) => {
          setOpenSubmenu(open ? "schedule" : null);
        }}
      >
        <ContextSubTrigger selected={availability === "scheduled"} onClick={() => onAvailabilityChange("scheduled")}>
          По расписанию
        </ContextSubTrigger>
        <DropdownMenu.Portal>
          <ScheduleSubmenu
            scheduleId={scheduleId}
            outsideScheduleMode={outsideScheduleMode}
            weeklySchedule={weeklySchedule}
            onOutsideScheduleModeChange={(value) => {
              onAvailabilityChange("scheduled");
              onOutsideScheduleModeChange(value);
            }}
            onWeeklyScheduleChange={(schedule) => {
              onAvailabilityChange("scheduled");
              onWeeklyScheduleChange(schedule);
            }}
            onReset={() => {
              onResetSchedule();
              setOpenSubmenu(null);
            }}
          />
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
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
