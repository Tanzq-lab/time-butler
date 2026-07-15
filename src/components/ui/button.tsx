import { type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const shapeMap = {
  "rounded-lg": "rounded-md",
  "rounded-xl": "rounded-[10px]",
  "rounded-2xl": "rounded-[10px]",
  "rounded-full": "rounded-full",
} as const;

type Shape = keyof typeof shapeMap;

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sahara-text/25 focus-visible:ring-offset-2 focus-visible:ring-offset-sahara-bg active:translate-y-px motion-reduce:transform-none motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-45 disabled:transform-none cursor-pointer",
  {
    variants: {
      variant: {
        solid: "font-semibold text-sahara-bg",
        outline: "border font-medium",
        ghost: "",
        destructive: "font-semibold text-white",
        nav: "group flex w-full items-center transition-colors duration-150",
        link: "font-bold",
      },
      size: {
        xs: "px-2.5 py-1.5 text-[11px]",
        sm: "px-3.5 py-2 text-xs",
        md: "px-4 py-2.5 text-sm",
        lg: "px-5 py-3 text-sm",
        xl: "px-6 py-3.5 text-sm",
        "icon-sm": "p-1.5",
        icon: "p-2",
        "icon-lg": "h-8 w-8 flex items-center justify-center",
      },
      intent: {
        sahara: "",
        emerald: "",
        amber: "",
        green: "",
        red: "",
        slate: "",
        default: "",
      },
      active: {
        true: "",
        false: "",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "md",
      intent: "sahara",
      active: false,
      fullWidth: false,
    },
    compoundVariants: [
      // ─── solid ──────────────────────────────────────
      {
        variant: "solid",
        intent: "sahara",
        class: "bg-sahara-primary hover:bg-sahara-primary/88",
      },
      {
        variant: "solid",
        intent: "green",
        class:
          "bg-[#2f7d4e] hover:bg-[#286b43]",
      },
      {
        variant: "solid",
        intent: "emerald",
        class:
          "bg-[#2f7d4e] hover:bg-[#286b43]",
      },
      {
        variant: "solid",
        intent: "amber",
        class:
          "bg-[#946200] hover:bg-[#7d5300]",
      },
      {
        variant: "solid",
        intent: "red",
        class:
          "bg-[#b42318] hover:bg-[#982018]",
      },
      {
        variant: "solid",
        intent: "slate",
        class:
          "bg-sahara-card text-sahara-text-secondary hover:bg-sahara-border/65",
      },
      {
        variant: "solid",
        intent: "default",
        class:
          "bg-sahara-card text-sahara-text-secondary hover:bg-sahara-border/65",
      },

      // ─── outline ────────────────────────────────────
      {
        variant: "outline",
        intent: "sahara",
        class:
          "border-sahara-border text-sahara-text bg-sahara-surface hover:bg-sahara-card",
      },
      {
        variant: "outline",
        intent: "green",
        class:
          "border-[#2f7d4e]/35 text-[#2f7d4e] bg-[#2f7d4e]/8 hover:bg-[#2f7d4e]/14",
      },
      {
        variant: "outline",
        intent: "emerald",
        class:
          "border-[#2f7d4e]/35 text-[#2f7d4e] bg-[#2f7d4e]/8 hover:bg-[#2f7d4e]/14",
      },
      {
        variant: "outline",
        intent: "amber",
        class:
          "border-[#946200]/35 text-[#946200] bg-[#946200]/8 hover:bg-[#946200]/14",
      },
      {
        variant: "outline",
        intent: "red",
        class:
          "border-[#b42318]/35 text-[#b42318] bg-[#b42318]/8 hover:bg-[#b42318]/14",
      },
      {
        variant: "outline",
        intent: "slate",
        class:
          "border-sahara-border text-sahara-text-secondary bg-transparent hover:bg-sahara-card",
      },
      {
        variant: "outline",
        intent: "default",
        class:
          "border-sahara-border text-sahara-text-secondary bg-transparent hover:bg-sahara-card hover:text-sahara-text",
      },

      // ─── ghost ──────────────────────────────────────
      {
        variant: "ghost",
        intent: "sahara",
        class: "text-sahara-text hover:bg-sahara-card",
      },
      {
        variant: "ghost",
        intent: "green",
        class: "text-[#2f7d4e] hover:bg-[#2f7d4e]/10",
      },
      {
        variant: "ghost",
        intent: "emerald",
        class: "text-[#2f7d4e] hover:bg-[#2f7d4e]/10",
      },
      {
        variant: "ghost",
        intent: "amber",
        class: "text-[#946200] hover:bg-[#946200]/10",
      },
      {
        variant: "ghost",
        intent: "red",
        class: "text-[#b42318] hover:bg-[#b42318]/10",
      },
      {
        variant: "ghost",
        intent: "slate",
        class: "text-sahara-text-secondary hover:bg-sahara-card",
      },
      {
        variant: "ghost",
        intent: "default",
        class:
          "text-sahara-text-secondary hover:bg-sahara-card hover:text-sahara-text",
      },

      // ─── link ───────────────────────────────────────
      {
        variant: "link",
        intent: "sahara",
        class: "text-sahara-text underline-offset-4 hover:underline",
      },
      {
        variant: "link",
        intent: "default",
        class: "text-sahara-text-muted underline-offset-4 hover:text-sahara-text hover:underline",
      },

      // ─── nav ────────────────────────────────────────
      {
        variant: "nav",
        active: false,
        class:
          "text-sahara-text-secondary hover:bg-sahara-card hover:text-sahara-text",
      },
      {
        variant: "nav",
        active: true,
        class: "bg-sahara-card text-sahara-text font-semibold",
      },
      {
        variant: "nav",
        intent: "default",
        active: false,
        class:
          "text-sahara-text-muted hover:text-sahara-text-secondary hover:bg-transparent",
      },

      // ─── outline active ─────────────────────────────
      {
        variant: "outline",
        active: true,
        intent: "default",
        class: "bg-sahara-card border-sahara-border text-sahara-text",
      },
      {
        variant: "outline",
        active: true,
        intent: "sahara",
        class:
          "border-sahara-text-muted/45 bg-sahara-card text-sahara-text",
      },
      {
        variant: "outline",
        active: true,
        intent: "green",
        class: "bg-[#2f7d4e]/10 border-[#2f7d4e]/35 text-[#2f7d4e]",
      },
      {
        variant: "outline",
        active: true,
        intent: "red",
        class: "bg-[#b42318]/10 border-[#b42318]/35 text-[#b42318]",
      },

      // ─── ghost active ──────────────────────────────
      {
        variant: "ghost",
        active: true,
        intent: "default",
        class: "bg-sahara-card text-sahara-text",
      },
      {
        variant: "ghost",
        active: true,
        intent: "sahara",
        class: "bg-sahara-card text-sahara-text",
      },
      {
        variant: "ghost",
        active: true,
        intent: "green",
        class: "bg-[#2f7d4e]/10 text-[#2f7d4e]",
      },
      {
        variant: "ghost",
        active: true,
        intent: "red",
        class: "bg-[#b42318]/10 text-[#b42318]",
      },

      // ─── destructive ───────────────────────────────
      {
        variant: "destructive",
        intent: "red",
        class:
          "bg-[#b42318] text-white hover:bg-[#982018]",
      },
      {
        variant: "destructive",
        intent: "default",
        class:
          "bg-[#b42318] text-white hover:bg-[#982018]",
      },
    ],
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  shape?: Shape;
}

export function Button({
  className,
  type = "button",
  variant,
  size,
  intent,
  active,
  fullWidth,
  shape = "rounded-lg",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        buttonVariants({ variant, size, intent, active, fullWidth }),
        shapeMap[shape],
        className,
      )}
      {...props}
    />
  );
}
