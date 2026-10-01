import React from "react";
import { X } from "lucide-react";

export default function Modal({ title, subtitle, onClose, children, maxWidth = "max-w-3xl" }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${maxWidth} max-h-[88vh] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl`}>
        <div className="sticky top-0 flex items-start justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}