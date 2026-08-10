import type { ReactNode } from "react";

import { cn } from "@/ui/components/lib/utils";

/**
 * Animated-border box for sidebar system messages (loading, no spoofing, error…).
 * Uses the shared `.gw-animated-accent-border` ring machinery from globals.css
 * with sidebar-scoped accent variables defined in sidebar.css.
 */
export const SidebarStatusBox = ({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "error";
  className?: string;
}) => (
  <div
    className={cn(
      "relative gw-animated-accent-border gw-sidebar-status-box",
      "px-4 py-5 flex flex-col items-center justify-center gap-2 text-center",
      className,
    )}
    {...(tone === "error" ? { "data-tone": "error" } : {})}
    data-animation-timing={tone === "error" ? "urgent" : "steady"}
  >
    {children}
  </div>
);
