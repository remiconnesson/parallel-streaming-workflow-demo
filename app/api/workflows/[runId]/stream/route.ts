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

  // Transform typed chunks from the workflow stream into NDJSON lines
  // so the client can parse them easily.
  const jsonStream = readable.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(`${JSON.stringify(chunk)}\n`);
      },
    }),
  );

  return new Response(jsonStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      "Transfer-Encoding": "chunked",
    },
  });
}
