# Parallel Child Workflow Streaming

Spawn N child workflows. Each streams updates back. UI renders all live. Single SSE connection.

```
Browser  <--1 SSE--  Route Handler  <--N readers--  N child workflows
```

Why one SSE: browsers cap 6 connections per host. At N>6 some children stall until others finish. Multiplex on server -> one connection, all updates.

---

## 1. Setup

```bash
pnpm add workflow @workflow/next
```

`next.config.ts`:

```ts
import { withWorkflow } from "@workflow/next";

export default withWorkflow({
  // your existing config
});
```

Plugin enables `"use workflow"` and `"use step"` directives via SWC transform.

---

## 2. Child workflow

`workflows/color-counter.ts`. Picks color, streams numbers 1..5, sleeps random 1-5s between each.

```ts
import { getWritable, sleep } from "workflow";

export const FINAL_NUMBER = 5;
export const MAX_CHILDREN = 24;

export type StreamEvent =
  | { type: "init"; runIds: string[] }
  | {
      type: "update";
      childIndex: number;
      color: string;
      currentNumber: number;
    };

const COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#eab308" /* ... */];

async function streamNumber(color: string, currentNumber: number) {
  "use step";
  const writer = getWritable<string>().getWriter();
  try {
    await writer.write(JSON.stringify({ color, currentNumber }));
  } finally {
    writer.releaseLock();
  }
}

async function closeStream() {
  "use step";
  await getWritable<string>().close();
}

export async function colorCounterWorkflow() {
  "use workflow";
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  try {
    await streamNumber(color, 1);
    for (let i = 2; i <= FINAL_NUMBER; i++) {
      await sleep((Math.floor(Math.random() * 5) + 1) * 1000);
      await streamNumber(color, i);
    }
  } finally {
    await closeStream();
  }

  return { color, finalNumber: FINAL_NUMBER };
}
```

**Why steps for I/O.** `"use workflow"` body runs sandboxed VM. No `fetch`, no `setTimeout`, no Node modules. Steps have full Node access + auto-retry + result memoization on replay. Put any side effect in a step.

**Why `try/finally` around body.** If `streamNumber` throws, `closeStream` still runs. Else stream stays open, server reader hangs forever, UI never finishes. Critical.

**Why `getWriter()` + `releaseLock`.** Stream lock model. Acquire writer -> write -> release. `try/finally` so a write throw doesn't leak the lock.

**Why share `StreamEvent` from this file.** Server emits, client parses. One source of truth -> no drift.

---

## 3. Spawn N + multiplex

`app/api/demo/start/route.ts`. Spawn children parallel, fan-in their streams, emit NDJSON.

```ts
import { start } from "workflow/api";
import {
  colorCounterWorkflow,
  MAX_CHILDREN,
  type StreamEvent,
} from "@/workflows/color-counter";

export async function POST(request: Request) {
  const { count } = (await request.json()) as { count: number };
  const childCount = Math.min(Math.max(count || 6, 1), MAX_CHILDREN);

  const runs = await Promise.all(
    Array.from({ length: childCount }, () => start(colorCounterWorkflow)),
  );

  const encoder = new TextEncoder();
  const send = (
    controller: ReadableStreamDefaultController,
    event: StreamEvent,
  ) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

  const stream = new ReadableStream({
    async start(controller) {
      send(controller, { type: "init", runIds: runs.map((r) => r.runId) });

      await Promise.all(
        runs.map(async (run, childIndex) => {
          const reader = run.getReadable<string>().getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              send(controller, {
                type: "update",
                childIndex,
                ...(JSON.parse(value) as { color: string; currentNumber: number }),
              });
            }
          } finally {
            reader.releaseLock();
          }
        }),
      );

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

**`start()` direct here.** API route = not workflow context -> direct call OK. From inside another workflow you'd wrap in a `"use step"`.

**`Promise.all` of starts.** Spawn parallel. Each `start()` returns a `run` with `runId` + `getReadable<T>()`.

**Fan-in pattern.** One reader per child, all running concurrently. `Promise.all` of read loops -> awaits every child to finish naturally. Then `controller.close()`.

**NDJSON over SSE.** One JSON object per line. `\n` delimited. Simple to parse client-side. Headers prevent buffering on common proxies.

**Typed `send()`.** Forces server output to match `StreamEvent` shape.

---

## 4. Client consumer

`hooks/use-workflow-stream.ts`. Reads NDJSON, fans state out per child.

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const startDemo = useCallback(async (count: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setIsStarting(true);
    setHasStarted(false);
    setChildren([]);

    try {
      const response = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
        signal,
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done || signal.aborted) break;

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
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      throw err;
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsStarting(false);
      }
    }
  }, []);

  return { children, isStarting, hasStarted, startDemo };
}
```

**`TextDecoder` w/ `{ stream: true }`.** Multi-byte chars across chunk boundary -> decode keeps state. Required.

**Buffer + `lines.pop()`.** Last element = partial line (no trailing `\n`). Save for next read. Standard NDJSON pattern.

**`AbortController`.** Restart mid-stream -> old reader still fires `setChildren` -> stale updates interleave. Abort prior call. Pass signal to fetch + check in loop. Also abort on unmount via `useEffect` cleanup.

**Active-call guard in `finally`.** Aborted call shouldn't clobber a fresh starting state. Only clear `isStarting` if `abortRef.current === controller`.

**Outer `try/finally`.** Fetch reject path -> still clear `isStarting`. Else UI stuck on "Spawning".

---

## 5. UI

`components/workflow-dashboard.tsx`. Derive done from value, don't carry separate flag.

```tsx
"use client";

import { type ChildState, useWorkflowDemo } from "@/hooks/use-workflow-stream";
import { FINAL_NUMBER, MAX_CHILDREN } from "@/workflows/color-counter";

const isDone = (c: ChildState) => c.currentNumber === FINAL_NUMBER;

export function WorkflowDashboard() {
  const { children, startDemo, hasStarted, isStarting } = useWorkflowDemo();
  // slider 1..MAX_CHILDREN, button -> startDemo(count)
  // grid of children, each renders color box + currentNumber + isDone(c) marker
}
```

**Why derive `isDone`.** Server doesn't need to send "done" — it's `currentNumber === FINAL_NUMBER`. Less wire data, less state to sync.

---

## 6. Pitfalls

- **No `closeStream` in `finally`** -> step throw -> stream open -> server reader hangs -> UI never finishes.
- **`start()` inside workflow body** -> sandbox error. Wrap in `"use step"`.
- **N>6 without multiplex** -> browser queues connections -> some children appear to skip 1->5 instantly when prior finishes.
- **`fetch` in workflow body** -> sandbox blocks native fetch. `import { fetch } from "workflow"` or move to step.
- **`setTimeout` in workflow body** -> use `sleep("5s")` from `workflow`.
- **No `AbortController`** -> restart races. Old reader keeps writing state.
- **Drop trailing-newline contract** -> last event lost. Server must always end lines with `\n`.
- **Untyped `send()`** -> server/client drift silently. Type the helper to your event union.

---

## 7. Test

Unit tests on steps: just call them. `"use step"` is a no-op without compiler.

```ts
import { describe, it, expect } from "vitest";
import { colorCounterWorkflow } from "./color-counter";

it("workflow runs end-to-end", async () => {
  const result = await colorCounterWorkflow();
  expect(result.finalNumber).toBe(5);
});
```

For full workflow integration (sleep / hooks / retries) use `@workflow/vitest`:

```ts
// vitest.integration.config.ts
import { defineConfig } from "vitest/config";
import { workflow } from "@workflow/vitest";

export default defineConfig({
  plugins: [workflow()],
  test: { include: ["**/*.integration.test.ts"], testTimeout: 60_000 },
});
```

```ts
import { start } from "workflow/api";
import { colorCounterWorkflow } from "./color-counter";

it("streams 1..5 then closes", async () => {
  const run = await start(colorCounterWorkflow);
  const chunks: string[] = [];
  const reader = run.getReadable<string>().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const numbers = chunks.map((c) => JSON.parse(c).currentNumber);
  expect(numbers).toEqual([1, 2, 3, 4, 5]);
});
```

For the route handler: hit it with `fetch` against the dev server, assert NDJSON shape.

---

## 8. Debug

```bash
npx workflow health         # endpoints reachable?
npx workflow web            # visual dashboard
npx workflow inspect runs   # CLI list
npx workflow inspect run <runId>
```

Hangs almost always = missing `closeStream` in `finally`. Check there first.
