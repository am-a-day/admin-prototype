import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const ALLOWED_DESCRIPTION_TAGS = new Set(["P", "BR", "STRONG", "EM", "U", "S", "UL", "LI"]);
const DESCRIPTION_TAG_ALIASES: Record<string, string> = {
  B: "strong",
  I: "em",
  STRIKE: "s",
  DEL: "s",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtmlTags(value: string) {
  if (!value) return "";
  const div = document.createElement("div");
  div.innerHTML = value;
  return div.textContent ?? "";
}

export function sanitizeDescriptionHtml(value: string) {
  if (!value.trim()) return "";
  const parser = new DOMParser();
  const source = /<\/?[a-z][\s\S]*>/i.test(value) ? value : `<p>${escapeHtml(value).replace(/\n/g, "<br>")}</p>`;
  const doc = parser.parseFromString(source, "text/html");

  const cleanNode = (node: Node): Node | DocumentFragment | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    const tagName = element.tagName.toUpperCase();
    if (["IMG", "VIDEO", "IFRAME", "OBJECT", "EMBED", "SCRIPT", "STYLE"].includes(tagName)) return null;

    const normalizedTag = DESCRIPTION_TAG_ALIASES[tagName] ?? tagName.toLowerCase();
    const canKeepTag = ALLOWED_DESCRIPTION_TAGS.has(normalizedTag.toUpperCase());
    const container = canKeepTag ? document.createElement(normalizedTag) : document.createDocumentFragment();

    element.childNodes.forEach((child) => {
      const cleaned = cleanNode(child);
      if (cleaned) container.appendChild(cleaned);
    });

    return container;
  };

  const result = document.createElement("div");
  doc.body.childNodes.forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned) result.appendChild(cleaned);
  });

  return result.innerHTML
    .replace(/<p><\/p>/g, "")
    .replace(/<li><\/li>/g, "");
}

export function getDescriptionTextLength(html: string) {
  const root = document.createElement("div");
  root.innerHTML = sanitizeDescriptionHtml(html);
  let text = "";

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    if (element.tagName === "BR") {
      text += "\n";
      return;
    }
    element.childNodes.forEach(walk);
    if (["P", "LI"].includes(element.tagName)) text += "\n";
  };

  root.childNodes.forEach(walk);
  return text.replace(/\n$/, "").length;
}

function RichTextToolbarButton({
  label,
  active,
  onMouseDown,
  children,
}: {
  label: string;
  active: boolean;
  onMouseDown: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => {
        event.preventDefault();
        onMouseDown();
      }}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-[7px] text-[13px] font-semibold leading-none text-[#57534d] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        active && "bg-[#efefeb] text-[#292524] shadow-[inset_0_0_0_1px_rgba(41,37,36,0.08)]",
      )}
    >
      {children}
    </button>
  );
}

export function DescriptionRichTextEditor({
  value,
  initialValue,
  onChange,
  onBlur,
  label = "Описание",
  placeholder,
  limit,
  error,
}: {
  value?: string;
  initialValue?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  label?: string;
  placeholder: string;
  limit: number;
  error?: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const sourceValue = value ?? initialValue ?? "";
  const [initialHtml, setInitialHtml] = useState(() => sanitizeDescriptionHtml(sourceValue));
  const lastEmittedValueRef = useRef(initialHtml);
  const [charCount, setCharCount] = useState(() => getDescriptionTextLength(sourceValue));
  const [activeMarks, setActiveMarks] = useState({ bold: false, italic: false, underline: false, strike: false, list: false });
  const overLimit = charCount > limit;
  const shownError = error ?? (overLimit ? `Сократите описание до ${limit} символов` : undefined);
  const counterTone = shownError
    ? "text-[#b42318]"
    : charCount >= limit
      ? "text-[#9f1239]"
      : charCount >= Math.floor(limit * 0.9)
        ? "text-[#b45309]"
        : "text-[#79716b]";

  useEffect(() => {
    const nextHtml = sanitizeDescriptionHtml(sourceValue);
    if (nextHtml === lastEmittedValueRef.current) {
      setCharCount(getDescriptionTextLength(nextHtml));
      return;
    }
    setInitialHtml(nextHtml);
    setCharCount(getDescriptionTextLength(nextHtml));
    if (editorRef.current && editorRef.current.innerHTML !== nextHtml) editorRef.current.innerHTML = nextHtml;
  }, [sourceValue]);

  const syncFromEditor = (sanitize = false) => {
    const nextHtml = sanitizeDescriptionHtml(editorRef.current?.innerHTML ?? "");
    if (sanitize && editorRef.current && editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
    lastEmittedValueRef.current = nextHtml;
    setCharCount(getDescriptionTextLength(nextHtml));
    onChange?.(nextHtml);
  };

  const refreshActiveMarks = () => {
    if (!editorRef.current || !document.activeElement || !editorRef.current.contains(document.activeElement)) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      setActiveMarks({ bold: false, italic: false, underline: false, strike: false, list: false });
      return;
    }
    setActiveMarks({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strike: document.queryCommandState("strikeThrough"),
      list: document.queryCommandState("insertUnorderedList"),
    });
  };

  useEffect(() => {
    document.addEventListener("selectionchange", refreshActiveMarks);
    return () => document.removeEventListener("selectionchange", refreshActiveMarks);
  }, []);

  const applyCommand = (command: "bold" | "italic" | "underline" | "strikeThrough" | "insertUnorderedList") => {
    editorRef.current?.focus();
    document.execCommand(command);
    syncFromEditor();
    window.setTimeout(refreshActiveMarks, 0);
  };

  const insertHtml = (nextHtml: string) => {
    document.execCommand("insertHTML", false, nextHtml);
    syncFromEditor();
  };

  const handleBeforeInput = (event: FormEvent<HTMLDivElement> & { nativeEvent: InputEvent }) => {
    const inputEvent = event.nativeEvent;
    if (!inputEvent.data || inputEvent.inputType.startsWith("delete")) return;
    if (!overLimit && charCount + inputEvent.data.length <= limit) return;
    event.preventDefault();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const htmlData = event.clipboardData.getData("text/html");
    const plainData = event.clipboardData.getData("text/plain");
    const sanitized = sanitizeDescriptionHtml(htmlData || plainData);
    const remaining = limit - charCount;
    if (remaining <= 0 && !overLimit) return;

    if (getDescriptionTextLength(sanitized) <= remaining || overLimit) {
      insertHtml(sanitized);
      return;
    }

    const plain = stripHtmlTags(sanitized).slice(0, Math.max(0, remaining));
    if (plain) insertHtml(escapeHtml(plain).replace(/\n/g, "<br>"));
  };

  return (
    <div>
      <div className="mb-1.5 text-[13px] leading-5 text-[#303030]">{label}</div>
      <div
        className={cn(
          "overflow-hidden rounded-[8px] border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition focus-within:border-[#c7c2bd]",
          shownError ? "border-[#fda29b]" : "border-[#e5e5e5]",
        )}
      >
        <div className="flex h-8 items-center gap-0.5 border-b border-[#e5e5e5] px-1.5">
          <RichTextToolbarButton label="Жирный" active={activeMarks.bold} onMouseDown={() => applyCommand("bold")}>
            B
          </RichTextToolbarButton>
          <RichTextToolbarButton label="Курсив" active={activeMarks.italic} onMouseDown={() => applyCommand("italic")}>
            <span className="italic">I</span>
          </RichTextToolbarButton>
          <RichTextToolbarButton label="Подчёркнутый" active={activeMarks.underline} onMouseDown={() => applyCommand("underline")}>
            <span className="underline">U</span>
          </RichTextToolbarButton>
          <RichTextToolbarButton label="Зачёркнутый" active={activeMarks.strike} onMouseDown={() => applyCommand("strikeThrough")}>
            <span className="line-through">S</span>
          </RichTextToolbarButton>
          <RichTextToolbarButton label="Маркированный список" active={activeMarks.list} onMouseDown={() => applyCommand("insertUnorderedList")}>
            •
          </RichTextToolbarButton>
          <div className={cn("ml-auto text-[12px] leading-5", counterTone)}>
            {charCount} / {limit}
          </div>
        </div>
        <div
          ref={(element) => {
            editorRef.current = element;
            if (element && !element.dataset.richTextInitialized) {
              element.innerHTML = initialHtml;
              element.dataset.richTextInitialized = "true";
            }
          }}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={label}
          aria-multiline="true"
          aria-invalid={Boolean(shownError)}
          data-placeholder={placeholder}
          onInput={() => syncFromEditor()}
          onBlur={() => {
            syncFromEditor(true);
            onBlur?.();
          }}
          onKeyUp={refreshActiveMarks}
          onMouseUp={refreshActiveMarks}
          onBeforeInput={handleBeforeInput}
          onPaste={handlePaste}
          className="min-h-[96px] px-3 py-2 text-[13px] leading-5 text-[#292524] outline-none empty:before:pointer-events-none empty:before:text-[#a8a29e] empty:before:content-[attr(data-placeholder)] [&_em]:italic [&_li]:ml-4 [&_li]:list-disc [&_p]:my-0 [&_s]:line-through [&_strong]:font-semibold [&_u]:underline [&_ul]:my-0 [&_ul]:pl-2"
        />
      </div>
      {shownError && (
        <div className="mt-1.5 text-[12px] leading-5 text-[#b42318]">
          {shownError}
        </div>
      )}
    </div>
  );
}
