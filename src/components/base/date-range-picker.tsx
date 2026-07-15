import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type DatePeriod, PERIOD_OPTIONS } from "@/lib/date-range";

interface DateRangePickerProps {
  value: DatePeriod;
  onChange: (period: DatePeriod) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeLabel =
    PERIOD_OPTIONS.find((o) => o.value === value)?.label ?? "最近 7 天";

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("app:escape", handler);
    return () => window.removeEventListener("app:escape", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        intent="default"
        size="sm"
        className="gap-1.5 text-xs font-medium"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {activeLabel}
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="关闭日期范围菜单" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-36 animate-in rounded-[10px] border border-sahara-border bg-sahara-surface p-1 shadow-lg fade-in slide-in-from-top-2 duration-150">
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="ghost"
                size="xs"
                fullWidth
                intent="default"
                active={opt.value === value}
                role="menuitemradio"
                aria-checked={opt.value === value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="text-xs md:text-base font-medium"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
