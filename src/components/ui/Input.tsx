import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Affiche la valeur en Geist Mono (clés, codes, données saisies). */
  mono?: boolean;
}

export function Input({ mono = false, className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted",
        "focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15",
        mono && "font-mono text-xs",
        className,
      )}
      {...props}
    />
  );
}
