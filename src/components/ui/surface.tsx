import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "plain" | "subtle" | "raised";
  padding?: "none" | "sm" | "md";
}

const toneClasses = {
  plain: "bg-sahara-surface",
  subtle: "bg-sahara-card",
  raised: "border border-sahara-border bg-sahara-surface",
} as const;

const paddingClasses = {
  none: "",
  sm: "p-3 md:p-4",
  md: "p-4 md:p-6",
} as const;

export function Surface({
  tone = "plain",
  padding = "none",
  className,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn("rounded-[10px]", toneClasses[tone], paddingClasses[padding], className)}
      {...props}
    />
  );
}
