import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown, Check, PlusCircle } from "@phosphor-icons/react";
import type { CatalogMenu } from "@/contexts/catalog-store-context";
import { cn } from "@/lib/utils";

type CatalogMenuSwitcherProps = {
  menus: CatalogMenu[];
  activeMenuId: string;
  guestFacingMenuId: string;
  onSelectMenu: (id: string) => void;
  onCreateMenu: () => void;
};

export function CatalogMenuSwitcher({
  menus,
  activeMenuId,
  guestFacingMenuId,
  onSelectMenu,
  onCreateMenu,
}: CatalogMenuSwitcherProps) {
  const activeMenu = menus.find((menu) => menu.id === activeMenuId) ?? menus[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Выбрать меню"
          className="flex h-8 min-w-0 max-w-full items-center gap-1 rounded-[8px] px-2 text-left text-[14px] font-normal leading-[1.4] text-[#292524] outline-none transition hover:bg-[#f3f3ed] focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <span className="min-w-0 flex-1 truncate">{activeMenu?.name ?? "Меню"}</span>
          <CaretDown size={14} weight="regular" className="shrink-0 text-[#79716b]" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-[100002] min-w-[220px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
        >
          {menus.map((menu) => {
            const selected = menu.id === activeMenuId;
            const guestFacing = menu.id === guestFacingMenuId;
            return (
              <DropdownMenu.Item
                key={menu.id}
                onSelect={() => onSelectMenu(menu.id)}
                className={cn(
                  "flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 py-1.5 text-left outline-none transition data-[highlighted]:bg-[#f3f3ed]",
                  selected && "bg-[#f8f8f5]",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-[18px] text-[#292524]">{menu.name}</span>
                  {guestFacing && <span className="block text-[11px] leading-4 text-[#a6a09b]">Показывается гостям</span>}
                </span>
                {selected && <Check size={15} weight="bold" className="shrink-0 text-[#57534d]" />}
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Separator className="my-1 h-px bg-[#e7e5e4]" />
          <DropdownMenu.Item
            onSelect={onCreateMenu}
            className="flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-[8px] px-2 text-[13px] font-medium text-[#57534d] outline-none transition data-[highlighted]:bg-[#f3f3ed] data-[highlighted]:text-[#292524]"
          >
            <PlusCircle size={15} weight="regular" />
            Создать меню
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
