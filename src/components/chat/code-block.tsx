// Code block with syntax highlighting (aurora palette) + copy button.

"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// Hand-tuned Aurora Night prism palette — calm, low-glare, readable.
const AURORA_CODE: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    color: "#d6def3",
    background: "transparent",
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
    fontSize: "12.75px",
    lineHeight: 1.7,
    tabSize: 2,
    hyphens: "none",
    whiteSpace: "pre",
    wordBreak: "normal",
    overflowWrap: "normal",
  },
  'pre[class*="language-"]': {
    color: "#d6def3",
    background: "transparent",
    margin: 0,
    overflow: "auto",
  },
  comment: { color: "#5b6784", fontStyle: "italic" },
  prolog: { color: "#5b6784" },
  doctype: { color: "#5b6784" },
  cdata: { color: "#5b6784" },
  punctuation: { color: "#8892ac" },
  property: { color: "#7ee0c0" },
  tag: { color: "#8fb7ff" },
  boolean: { color: "#e879f9" },
  number: { color: "#e8a87c" },
  constant: { color: "#e8a87c" },
  symbol: { color: "#e8a87c" },
  deleted: { color: "#f26d6d" },
  selector: { color: "#e879f9" },
  "attr-name": { color: "#7ee0c0" },
  string: { color: "#a7e3c2" },
  char: { color: "#a7e3c2" },
  builtin: { color: "#7ee0c0" },
  inserted: { color: "#a7e3c2" },
  operator: { color: "#8892ac" },
  entity: { color: "#8fb7ff", cursor: "help" },
  url: { color: "#8fb7ff" },
  atrule: { color: "#7ee0c0" },
  "attr-value": { color: "#a7e3c2" },
  keyword: { color: "#a78bfa", fontWeight: "600" },
  function: { color: "#c9b8ff" },
  class: { color: "#c9b8ff" },
  regex: { color: "#e8a87c" },
  important: { color: "#e879f9", fontWeight: "bold" },
  variable: { color: "#d6def3" },
  "language-css .token.string": { color: "#a7e3c2" },
  style: { color: "#8892ac" },
  "script .token.string": { color: "#a7e3c2" },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
};

const ALIAS: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  jsx: "javascript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  "c++": "cpp",
};

export const CodeBlock = memo(function CodeBlock({
  code,
  language,
  streaming,
}: {
  code: string;
  language: string;
  streaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }, [code]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const lang = (language || "").toLowerCase();
  const prismLang = ALIAS[lang] ?? lang;

  return (
    <div className="group/code my-3.5 rounded-xl overflow-hidden border border-white/8 bg-[rgba(3,5,10,0.72)]">
      <div className="flex items-center justify-between h-9 px-3.5 border-b border-white/7 bg-white/[0.022]">
        <span className="text-[10.5px] font-mono text-muted-foreground/70 tracking-wide">
          {language || "text"}
        </span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.06] transition-colors"
          aria-label={copied ? "Kode tersalin" : "Salin kode"}
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-400" /> Tersalin
            </>
          ) : (
            <>
              <Copy className="size-3" /> Salin
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-3.5">
        {prismLang && prismLang !== "text" ? (
          <SyntaxHighlighter
            language={prismLang}
            style={AURORA_CODE}
            wrapLongLines={false}
            customStyle={{ margin: 0, background: "transparent", padding: 0 }}
            codeTagProps={{ style: { background: "transparent" } }}
          >
            {code.replace(/\n$/, "")}
          </SyntaxHighlighter>
        ) : (
          <pre className="font-mono text-[12.75px] leading-[1.7] text-[#d6def3] whitespace-pre">
            {code.replace(/\n$/, "")}
          </pre>
        )}
      </div>
      {streaming && (
        <div className={cn("h-0.5 w-full shimmer")} aria-hidden="true" />
      )}
    </div>
  );
});
