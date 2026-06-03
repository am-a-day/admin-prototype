import { ContentLanguageBadge } from "@/components/workspace/content-language-badge";
import { PublishControl } from "@/components/layout/publish-control";
import { useHeaderActionsSlot } from "@/contexts/header-actions-context";

type ContentHeaderProps = {
  title: string;
  description?: string;
  showLanguage?: boolean;
};

export function ContentHeader({ title, description, showLanguage = false }: ContentHeaderProps) {
  const actions = useHeaderActionsSlot();

  return (
    <header className="shrink-0 border-b border-border bg-white px-6 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-bold leading-tight text-zinc-950">{title}</h1>
            {showLanguage && <ContentLanguageBadge />}
          </div>
          {description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          <PublishControl />
        </div>
      </div>
    </header>
  );
}
