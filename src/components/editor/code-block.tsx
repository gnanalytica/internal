"use client";

import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

const lowlight = createLowlight(common);

// Languages offered in the picker: the lowlight `common` bundle, aliased to
// the names users actually type.
const LANGUAGES = Object.keys(common).sort();

function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const language = (node.attrs.language as string | null) ?? "";

  return (
    <NodeViewWrapper className="code-block-wrap group/code">
      {editor.isEditable && (
        <div
          className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/code:opacity-100"
          contentEditable={false}
        >
          <select
            value={language}
            onChange={(e) => updateAttributes({ language: e.target.value || null })}
            className="h-6 rounded border bg-background px-1 text-[11px] text-muted-foreground focus:outline-none"
            aria-label="Code language"
          >
            <option value="">plain</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(node.textContent);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="grid size-6 place-items-center rounded border bg-background text-muted-foreground hover:text-foreground"
            aria-label="Copy code"
            title="Copy code"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        </div>
      )}
      <pre>
        <NodeViewContent as={"code" as "div"} />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({ lowlight });
