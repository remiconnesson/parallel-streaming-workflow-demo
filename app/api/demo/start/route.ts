import { start } from "workflow/api";
import { MAX_CHILDREN, type StreamEvent } from "@/lib/workflow-shared";
import { colorCounterWorkflow } from "@/workflows/color-counter";

// Multiplex all child streams into one SSE response so we don't blow
// the browser's 6-connections-per-host limit.
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
      send(controller, {
        type: "init",
        runIds: runs.map((r) => r.runId),
      });

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
                ...(JSON.parse(value) as {
                  color: string;
                  currentNumber: number;
                }),
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
