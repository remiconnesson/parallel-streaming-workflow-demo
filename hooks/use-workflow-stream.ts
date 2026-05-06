"use client";

import { useCallback, useState } from "react";

export type ChildState = {
  runId: string;
  color: string | null;
  currentNumber: number | null;
  done: boolean;
};

type InitEvent = {
  type: "init";
  children: Array<{ index: number; runId: string }>;
};

type UpdateEvent = {
  type: "update";
  childIndex: number;
  runId: string;
  color: string;
  currentNumber: number;
};

type StreamEvent = InitEvent | UpdateEvent;

/**
 * Hook that starts N child workflows and consumes a single
 * multiplexed SSE stream containing updates from all children.
 *
 * This avoids opening N separate fetch connections, which would
 * hit the browser's 6-connection-per-host limit and cause some
 * streams to queue until others finish.
 */
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

      if (!response.body) {
        setIsStarting(false);
        return;
      }

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
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed) as StreamEvent;

            if (event.type === "init") {
              // Initialize all children with empty state
              const initial: ChildState[] = event.children.map((c) => ({
                runId: c.runId,
                color: null,
                currentNumber: null,
                done: false,
              }));
              setChildren(initial);
              setHasStarted(true);
              setIsStarting(false);
            } else if (event.type === "update") {
              setChildren((prev) => {
                const next = [...prev];
                if (next[event.childIndex]) {
                  next[event.childIndex] = {
                    runId: event.runId,
                    color: event.color,
                    currentNumber: event.currentNumber,
                    done: event.currentNumber === 5,
                  };
                }
                return next;
              });
            }
          } catch {
            // skip unparseable lines
          }
        }
      }

      // Stream ended -- mark any remaining children as done
      setChildren((prev) =>
        prev.map((c) => (c.done ? c : { ...c, done: true })),
      );
    } catch {
      setIsStarting(false);
    }
  }, []);

  return { children, isStarting, hasStarted, startDemo };
}
