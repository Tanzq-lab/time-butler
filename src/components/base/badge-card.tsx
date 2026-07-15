import { Award } from "lucide-react";
import { cn } from "@/lib/cn";

interface BadgeCardProps {
  title: string;
  description: string;
  earned: boolean;
}

export function BadgeCard({ title, description, earned }: BadgeCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[10px] border p-3.5 transition-colors duration-150 md:gap-4 md:p-5",
        earned
          ? "bg-sahara-primary-light/20 border-sahara-primary/30"
          : "bg-sahara-surface border-sahara-border/15 opacity-60",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[10px] md:size-12",
          earned
            ? "bg-sahara-primary text-sahara-bg"
            : "bg-sahara-card text-sahara-text-muted",
        )}
      >
        <Award className="size-5 md:w-6 md:h-6" />
      </div>
      <div>
        <h4
          className={cn(
            "text-sm font-semibold md:text-base",
            earned ? "text-sahara-primary" : "text-sahara-text-muted",
          )}
        >
          {title}
        </h4>
        <p className="text-[10px] md:text-xs text-sahara-text-muted mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
