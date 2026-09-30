// Markdown rendering for message bodies: GFM tables/lists + aurora code
// blocks + safe links. Memoized on text identity to survive token batches.

"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";

export const Markdown = memo(function Markdown({
  text,
  streaming,
}: {
  text: string;
  streaming?: boolean;
}) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            // React-markdown renders code fences as <pre><code>
            const child =
              children && Array.isArray(children) ? children[0] : children;
            if (
              child &&
              typeof child === "object" &&
              "props" in child &&
              child.props
            ) {
              const props = child.props as {
                className?: string;
                children?: React.ReactNode;
              };
              const match = /language-(\w[\w+-]*)/.exec(props.className ?? "");
              const code = extractText(props.children);
              return (
                <CodeBlock
                  code={code}
                  language={match?.[1] ?? ""}
                  streaming={streaming}
                />
              );
            }
            return <pre>{children}</pre>;
          },
          a({ href, children }) {
            const safeHref =
              href && /^(https?:|mailto:)/i.test(href) ? href : undefined;
            return (
              <a
                href={safeHref ?? "#"}
                target={safeHref ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return extractText(props?.children);
  }
  return "";
}
