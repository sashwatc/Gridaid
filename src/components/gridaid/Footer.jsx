import React from "react";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
          GridAid is a research and planning prototype. Results are based on
          modeled assumptions, public or synthetic data, and simplified
          transportation conditions. GridAid does not provide live emergency
          dispatch instructions, guarantee response times, or replace
          professional emergency-management judgment.
        </p>
        <p className="mt-3 text-xs text-muted-foreground/70">
          © {new Date().getFullYear()} GridAid · Scott County / Davenport, Iowa demonstration area
        </p>
      </div>
    </footer>
  );
}