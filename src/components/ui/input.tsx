import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = Omit<React.ComponentProps<"input">, "size"> & {
  size?: "default" | "compact";
};

function Input({ className, type, size = "default", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex w-full border bg-transparent outline-none",
        size === "compact"
          ? "h-[30px] rounded-[8px] border-[#e5e5e5] px-2 text-[13px] text-[#292524] placeholder:text-[#a8a29e] focus:border-[#c7c2bd]"
          : "h-10 rounded-xl border-input px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
