import React, { useState } from "react";
import { Info } from "lucide-react";

// Lightweight tooltip: small info icon that reveals a one/two sentence
// explanation on hover/focus. Keeps technical metrics understandable without
// leaving the page.
export default function InfoTooltip({ text, size = 14 }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="More information"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <Info style={{ width: size, height: size }} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-56 rounded-md border border-border bg-popover text-popover-foreground px-3 py-2 text-xs leading-relaxed shadow-lg pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  );
}