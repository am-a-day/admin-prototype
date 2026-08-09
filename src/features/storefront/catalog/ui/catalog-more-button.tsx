import { forwardRef, type ButtonHTMLAttributes } from "react";
import { DotsThreeVertical } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export const CatalogMoreButton = forwardRef<HTMLButtonElement, { ariaLabel: string; title?: string; variant?: "outline" | "ghost" } & ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ ariaLabel, title, variant = "outline", className, ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "flex h-[30px] w-[31px] shrink-0 items-center justify-center rounded-[22px] p-1 text-[#57534d] transition-colors hover:bg-[#f5f5f4] hover:text-[#292524] active:bg-[#efefea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        variant === "outline" && "border border-[#e7e5e4] bg-white hover:border-[#d6d3d1] hover:bg-[#fafaf9]",
        variant === "ghost" && "border border-transparent bg-transparent",
        className,
      )}
    >
      <DotsThreeVertical size={18} weight="regular" />
    </button>
  ),
);

CatalogMoreButton.displayName = "CatalogMoreButton";
