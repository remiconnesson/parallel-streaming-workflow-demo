"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ColorSquare } from "@/components/color-square";
import type { ParentChunk } from "@/workflows/parallel-colors";

type DashboardState = "idle" | "starting" | "running";

export function WorkflowDashboard() {
  const [state, setState] = useState<DashboardState>("idle");
  const [childRunIds, setChildRunIds] = useState<string[]>([]);
  const [count, setCount] = useState(6);
  const abortRef = useRef<AbortController | null>(null);

  const launch = useCallback(async () => {
    abortRef.current?.abort();
    setChildRunIds([]);
    setState("starting");

    try {
      const res = await fetch("/api/workflows/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });

      if (!res.ok) {
        setState("idle");
        return;
      }

      const { runId } = (await res.json()) as { runId: string };

      // Subscribe to the parent workflow's stream to get child run IDs
      const controller = new AbortController();
      abortRef.current = controller;

      const streamRes = await fetch(`/api/workflows/${runId}/stream`, {
        signal: controller.signal,
      });

      if (!streamRes.ok || !streamRes.body) {
        setState("idle");
        return;
      }

      const reader = streamRes.body.getReader();
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
            const chunk = JSON.parse(trimmed) as ParentChunk;
            if (chunk.childRunIds) {
              setChildRunIds(chunk.childRunIds);
              setState("running");
            }
          } catch {
            // Not valid JSON yet
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer.trim()) as ParentChunk;
          if (chunk.childRunIds) {
            setChildRunIds(chunk.childRunIds);
            setState("running");
          }
        } catch {
          // Ignore
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setState("idle");
    }
  }, [count]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        count={count}
        onCountChange={setCount}
        onLaunch={launch}
        state={state}
      />
      <main className="flex-1 p-6 md:p-8">
        {state === "idle" && <IdleState />}
        {state === "starting" && <StartingState />}
        {state === "running" && <WorkflowGrid runIds={childRunIds} />}
      </main>
    </div>
  );
}

function Header({
  count,
  onCountChange,
  onLaunch,
  state,
}: {
  count: number;
  onCountChange: (n: number) => void;
  onLaunch: () => void;
  state: DashboardState;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 md:px-8">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-foreground" />
        <h1 className="font-mono text-sm font-medium tracking-tight text-foreground">
          parallel-streaming-demo
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">N =</span>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => onCountChange(Number(e.target.value))}
            className="w-14 rounded-md border border-border bg-input px-2 py-1 text-center font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </label>

        <button
          type="button"
          onClick={onLaunch}
          disabled={state === "starting"}
          className="rounded-md bg-primary px-4 py-2 font-mono text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {state === "starting" ? "Spawning..." : "Launch"}
        </button>
      </div>
    </header>
  );
}

function IdleState() {
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <div className="text-center">
        <p className="font-mono text-lg text-muted-foreground">
          Set N and hit Launch to spawn parallel workflows
        </p>
        <p className="mt-2 font-mono text-sm text-muted-foreground/60">
          Each workflow picks a color and counts 1 through 5 with random delays
        </p>
      </div>
    </div>
  );
}

function StartingState() {
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 animate-pulse rounded-full bg-muted-foreground" />
        <p className="font-mono text-sm text-muted-foreground">
          Spawning child workflows...
        </p>
      </div>
    </div>
  );
}

function WorkflowGrid({ runIds }: { runIds: string[] }) {
  // Calculate columns based on count for a nice grid
  const cols =
    runIds.length <= 4
      ? "grid-cols-2"
      : runIds.length <= 9
        ? "grid-cols-3"
        : runIds.length <= 16
          ? "grid-cols-4"
          : "grid-cols-5";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-xs text-muted-foreground">
          {runIds.length} workflows running
        </p>
        <p className="font-mono text-xs text-muted-foreground/50">
          numbers stream live as each sleep completes
        </p>
      </div>
      <div className={`grid ${cols} gap-4`}>
        {runIds.map((runId) => (
          <ColorSquare key={runId} runId={runId} />
        ))}
      </div>
    </div>
  );
}
