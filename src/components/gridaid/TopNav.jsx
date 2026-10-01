import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, MapPin } from "lucide-react";

const MORE_ITEMS = [
  { to: "/methodology", label: "Methodology" },
  { to: "/validation", label: "Validation" },
  { to: "/risk-model", label: "Risk Model" },
  { to: "/expert-feedback", label: "Expert Feedback" },
];

export default function TopNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const linkClass = (to) =>
    `text-sm transition-colors hover:text-foreground ${
      location.pathname === to ? "text-foreground font-medium" : "text-muted-foreground"
    }`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0f766e] text-white">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight text-foreground">GridAid</span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link to="/workspace" className={linkClass("/workspace")}>
            Workspace
          </Link>
          <Link to="/how-it-works" className={linkClass("/how-it-works")}>
            How It Works
          </Link>
          <Link to="/data" className={linkClass("/data")}>
            Data
          </Link>
          <Link to="/about" className={linkClass("/about")}>
            About
          </Link>
          <div
            className="relative"
            onMouseEnter={() => setMoreOpen(true)}
            onMouseLeave={() => setMoreOpen(false)}
          >
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              More
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full pt-1">
                <div className="w-48 rounded-md border border-border bg-popover py-1 shadow-lg">
                  {MORE_ITEMS.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="block px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}