import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { parallelColorsWorkflow } from "@/workflows/parallel-colors";

export async function POST(request: Request) {
  const body = (await request.json()) as { count?: number };
  const count = Math.min(Math.max(body.count ?? 6, 1), 20);

  const run = await start(parallelColorsWorkflow, [count]);

  return NextResponse.json({ runId: run.runId });
}
