import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/workflows/[runId]/stream">,
) {
  const { runId } = await ctx.params;
  try {
    const { searchParams } = new URL(request.url);
    const startIndexParam = searchParams.get("startIndex");
    const startIndex = startIndexParam
      ? Number.parseInt(startIndexParam, 10)
      : undefined;

    const run = getRun(runId);
    const readable = run.getReadable({ startIndex });

    // Transform typed chunks into NDJSON lines, then encode to bytes
    const jsonStream = readable
      .pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(`${JSON.stringify(chunk)}\n`);
          },
        }),
      )
      .pipeThrough(new TextEncoderStream());

    return new Response(jsonStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (error) {
    console.error("[v0] Stream route error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
