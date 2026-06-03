import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ContentLanguageBadge } from "@/components/workspace/content-language-badge";

type PageTitleProps = {
  title: string;
  description: string;
  action?: string;
  showContentLanguage?: boolean;
  /** Кастомный элемент в правом слоте шапки (например, триггер popover). */
  actionSlot?: ReactNode;
};

export function PageTitle({
  title,
  description,
  action,
  showContentLanguage,
  actionSlot,
}: PageTitleProps) {
  return (
    <div className="mb-2 flex items-end justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-black tracking-tight text-zinc-950">{title}</h1>
          {showContentLanguage && <ContentLanguageBadge />}
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actionSlot ??
        (action && (
          <Button variant="outline" size="sm" className="shrink-0 font-bold">
            <Eye size={15} />
            {action}
          </Button>
        ))}
    </div>
  );
}
