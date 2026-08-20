import { ForkKnife, ImageBroken } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const CATALOG_THUMBNAIL_CLASS = "h-5 w-5 rounded-[5px]";

export const CATALOG_SECTION_HEADER_THUMBNAIL_CLASS = "h-6 w-6 rounded-[6px]";
export const CATALOG_TABLE_ROW_THUMBNAIL_CLASS = "h-7 w-7 rounded-[6.462px] border border-[#e7e5e4] bg-white";

export function CatalogThumbnail({
  src,
  kind,
  className,
}: {
  src?: string | null;
  kind: "section" | "item";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-[#e9e9df] text-[#a8a29e]",
        CATALOG_THUMBNAIL_CLASS,
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : kind === "section" ? (
        <ForkKnife size={13} weight="fill" />
      ) : (
        <ImageBroken size={13} />
      )}
    </span>
  );
}
