import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteConfirmationDialog({
  kind,
  open,
  title,
  description,
  onOpenChange,
  onConfirm,
}: {
  kind: "section" | "position" | "bulk";
  open: boolean;
  title: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}) {
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    submittingRef.current = false;
    setSubmitting(false);
    setError(null);
  }, [open]);

  const confirm = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      await Promise.resolve(onConfirm());
      onOpenChange(false);
    } catch (cause) {
      submittingRef.current = false;
      setSubmitting(false);
      setError(cause instanceof Error ? cause.message : "Не удалось удалить. Попробуйте ещё раз.");
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submittingRef.current) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent
        data-delete-confirmation-dialog
        data-delete-confirmation-kind={kind}
        className="w-[calc(100%-2rem)] max-w-[338px] gap-0 overflow-hidden rounded-[16px] border-[#e4e4e7] bg-[#fefefc] p-0 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]"
      >
        <AlertDialogHeader className="space-y-0 border-b border-stone-200 p-4 pr-11">
          <AlertDialogTitle className="break-words text-[14px] font-semibold leading-normal tracking-[-0.35px] text-stone-800">
            {title}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription className="break-words px-4 py-3 text-[13px] leading-5 text-stone-700">
          {description}
        </AlertDialogDescription>

        {error && (
          <p role="alert" className="border-t border-stone-200 px-4 py-2 text-[12px] leading-4 text-rose-700">
            {error}
          </p>
        )}

        <AlertDialogFooter className="grid grid-cols-2 gap-2 border-t border-stone-200 p-2">
          <AlertDialogCancel
            disabled={submitting}
            className="!m-0 !h-7 min-w-0 rounded-[8px] border-[#e4e4e7] bg-white px-2.5 text-[13px] font-medium leading-4 text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-stone-50"
          >
            Отмена
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={submitting}
            onClick={() => void confirm()}
            className="h-7 min-w-0 rounded-[8px] bg-[#ec003f] px-2.5 text-[13px] font-medium leading-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-[#d80039] focus-visible:ring-[#ec003f]/25"
          >
            Удалить навсегда
          </Button>
        </AlertDialogFooter>

        <AlertDialogCancel
          aria-label="Закрыть"
          disabled={submitting}
          className="absolute right-[5px] top-[5px] !m-0 !h-[30px] !w-[30px] rounded-[8px] !border-0 bg-transparent !p-0 text-stone-800 !shadow-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-stone-500/20"
        >
          <X size={16} weight="regular" />
        </AlertDialogCancel>
      </AlertDialogContent>
    </AlertDialog>
  );
}
