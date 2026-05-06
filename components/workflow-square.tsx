"use client";

import { cn } from "@/lib/utils";

type WorkflowSquareProps = {
  color: string | null;
  currentNumber: number | null;
  index: number;
  done: boolean;
};

export function WorkflowSquare({
  color,
  currentNumber,
  index,
  done,
}: WorkflowSquareProps) {
  const isWaiting = color === null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "relative flex items-center justify-center rounded-lg transition-all duration-500",
          "aspect-square w-full min-w-16",
          isWaiting && "border border-dashed border-muted-foreground/30",
        )}
        style={{
          backgroundColor: color ?? "transparent",
          boxShadow: color
            ? `0 0 24px ${color}40, 0 0 48px ${color}20`
            : undefined,
        }}
      >
        <span
          className={cn(
            "font-mono text-4xl font-bold tabular-nums transition-all duration-300",
            isWaiting ? "text-muted-foreground/30" : "text-white",
            "drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]",
          )}
        >
          {currentNumber ?? "-"}
        </span>

        {done && (
          <div className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-white/80" />
        )}
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        {"#"}
        {index + 1}
      </span>
    </div>
  );
}
