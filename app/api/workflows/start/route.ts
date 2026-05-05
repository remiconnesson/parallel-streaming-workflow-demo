import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { colorCounterWorkflow } from "@/workflows/color-counter";

export async function POST(request: Request) {
  const body = (await request.json()) as { count?: number };
  const count = Math.min(Math.max(body.count ?? 6, 1), 20);

  // Spawn N child workflows directly from the API route
  const runs = await Promise.all(
    Array.from({ length: count }, () => start(colorCounterWorkflow)),
  );
  const childRunIds = runs.map((r) => r.runId);

  return NextResponse.json({ childRunIds });
}
