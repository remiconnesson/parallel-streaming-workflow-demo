"use client";

import { useEffect, useRef, useState } from "react";
import type { ColorCounterChunk } from "@/workflows/color-counter";

type SquareState = {
  color: string;
  number: number;
};

export function ColorSquare({ runId }: { runId: string }) {
  const [state, setState] = useState<SquareState | null>(null);
  const [complete, setComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch(`/api/workflows/${runId}/stream`, {
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const chunk = JSON.parse(trimmed) as ColorCounterChunk;
              setState({ color: chunk.color, number: chunk.number });
              if (chunk.number >= 5) {
                setComplete(true);
                finished = true;
                break;
              }
            } catch {
              // Not valid JSON yet
            }
          }
        }

        // Done -- cancel the stream so the connection closes
        reader.cancel();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    })();

    return () => controller.abort();
  }, [runId]);

  const bgColor = state?.color ?? "transparent";

  return (
    <div
      className="relative flex items-center justify-center rounded-lg transition-all duration-300 ease-out aspect-square"
      style={{
        backgroundColor: bgColor,
        boxShadow: state
          ? `0 0 24px ${bgColor}40, 0 0 48px ${bgColor}20`
          : "none",
        opacity: state ? 1 : 0.15,
        border: state ? "none" : "1px dashed rgba(255,255,255,0.1)",
      }}
    >
      {state ? (
        <span
          key={state.number}
          className="font-mono text-5xl font-bold text-white drop-shadow-lg animate-in zoom-in-75 duration-300"
        >
          {state.number}
        </span>
      ) : (
        <span className="font-mono text-xl text-white/30">...</span>
      )}

      {complete && (
        <div className="absolute top-2 right-2">
          <div className="h-2.5 w-2.5 rounded-full bg-white/80" />
        </div>
      )}
    </div>
  );
}
