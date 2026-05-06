"use client";

import { useCallback, useState } from "react";
import type { StreamEvent } from "@/workflows/color-counter";

export type ChildState = {
  runId: string;
  color: string | null;
  currentNumber: number | null;
};

export function useWorkflowDemo() {
  const [children, setChildren] = useState<ChildState[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const startDemo = useCallback(async (count: number) => {
    setIsStarting(true);
    setHasStarted(false);
    setChildren([]);

    try {
      const response = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;

          if (event.type === "init") {
            setChildren(
              event.runIds.map((runId) => ({
                runId,
                color: null,
                currentNumber: null,
              })),
            );
            setHasStarted(true);
          } else {
            setChildren((prev) => {
              const next = [...prev];
              const existing = next[event.childIndex];
              if (existing) {
                next[event.childIndex] = {
                  ...existing,
                  color: event.color,
                  currentNumber: event.currentNumber,
                };
              }
              return next;
            });
          }
        }
      }
    } finally {
      setIsStarting(false);
    }
  }, []);

  return { children, isStarting, hasStarted, startDemo };
}
