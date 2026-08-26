import { CaretDown, Check } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { getLanguage, type LanguageCode } from "@/data/languages";
import { cn } from "@/lib/utils";

type ContentLanguageControlProps = {
  value: LanguageCode;
  onChange: (language: LanguageCode) => void;
  compact?: boolean;
};

/** Preview-only language switcher. Language management lives in Translations. */
export function ContentLanguageControl({
  value,
  onChange,
  compact = false,
}: ContentLanguageControlProps) {
  const { account } = useMockAuth();
  const languages = account?.workspace.languages ?? [];
  const current = getLanguage(value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="Язык предпросмотра"
          className={cn(
            "inline-flex h-7 max-w-[150px] items-center gap-1 rounded-[8px] px-2 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
            compact && "w-8 justify-center px-1",
          )}
        >
          <span className="truncate">{compact ? current.short : current.label}</span>
          {!compact && <CaretDown size={12} className="shrink-0 text-[#a6a09b]" aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[210px]">
        {languages.map((workspaceLanguage) => {
          const language = getLanguage(workspaceLanguage.code);
          const selected = value === workspaceLanguage.code;
          const draft = workspaceLanguage.code !== account?.workspace.primaryLanguage
            && (!workspaceLanguage.visible || workspaceLanguage.status !== "ready");

          return (
            <DropdownMenuItem
              key={workspaceLanguage.code}
              onSelect={() => onChange(workspaceLanguage.code)}
              className="justify-between"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Check
                  size={14}
                  weight="bold"
                  className={cn("shrink-0", selected ? "text-[#292524]" : "opacity-0")}
                  aria-hidden="true"
                />
                <span className={cn("truncate", selected && "font-medium text-[#292524]")}>{language.label}</span>
              </span>
              {draft && (
                <Badge variant="secondary" className="h-[18px] rounded-[5px] border-0 bg-[#f5f5f4] px-1.5 py-0 text-[10px] font-normal text-[#79716b]">
                  Черновик
                </Badge>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
