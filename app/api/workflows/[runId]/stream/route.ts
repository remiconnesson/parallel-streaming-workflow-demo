import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/workflows/[runId]/stream">,
) {
  const { runId } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const startIndexParam = searchParams.get("startIndex");
  const startIndex = startIndexParam
    ? Number.parseInt(startIndexParam, 10)
    : undefined;

  const run = getRun(runId);
  const readable = run.getReadable({ startIndex });

  const encoder = new TextEncoder();
  const reader = readable.getReader();

  const body = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      } catch {
        controller.close();
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
