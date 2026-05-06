import { start } from "workflow/api";
import type { CounterUpdate } from "@/workflows/color-counter";
import { colorCounterWorkflow } from "@/workflows/color-counter";

/**
 * Starts N child workflows and immediately multiplexes all their streams
 * into a single SSE response. Each line is a JSON object with the child
 * index, runId, and the latest counter update.
 *
 * This avoids the client opening N separate fetch connections which would
 * hit browser connection limits (6 per host) and cause some workflows
 * to appear to jump from 1 straight to 5.
 */
export async function POST(request: Request) {
  const { count } = (await request.json()) as { count: number };
  const childCount = Math.min(Math.max(count || 6, 1), 24);

  // Spawn all child workflows
  const runs = await Promise.all(
    Array.from({ length: childCount }, () => start(colorCounterWorkflow)),
  );

  // Build a single multiplexed stream from all children
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial metadata so the client knows the runIds
      const meta = {
        type: "init" as const,
        children: runs.map((r, i) => ({ index: i, runId: r.runId })),
      };
      controller.enqueue(encoder.encode(`${JSON.stringify(meta)}\n`));

      // Read from all children concurrently
      const readers = runs.map((run) => {
        const readable = run.getReadable<string>();
        return readable.getReader();
      });

      let remaining = readers.length;

      await Promise.all(
        readers.map(async (reader, childIndex) => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              try {
                const update = JSON.parse(value) as CounterUpdate;
                const event = {
                  type: "update" as const,
                  childIndex,
                  runId: runs[childIndex].runId,
                  ...update,
                };
                controller.enqueue(
                  encoder.encode(`${JSON.stringify(event)}\n`),
                );
              } catch {
                // skip unparseable chunks
              }
            }
          } catch {
            // stream error, child finished
          } finally {
            reader.releaseLock();
            remaining--;
            if (remaining === 0) {
              controller.close();
            }
          }
        }),
      );
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
