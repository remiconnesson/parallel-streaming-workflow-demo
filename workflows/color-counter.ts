import { getWritable, sleep } from "workflow";
import type { ColorCounterChunk } from "@/lib/workflow-types";

const COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F43F5E", // rose
] as const;

async function pickColorAndStreamFirst(): Promise<string> {
  "use step";

  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  const writer = getWritable<ColorCounterChunk>().getWriter();
  await writer.write({ color, number: 1 });
  writer.releaseLock();

  return color;
}

async function streamNumber(color: string, n: number): Promise<void> {
  "use step";

  const writer = getWritable<ColorCounterChunk>().getWriter();
  await writer.write({ color, number: n });
  writer.releaseLock();
}

/**
 * A child workflow that:
 * 1. Picks a random color and immediately streams number 1.
 * 2. Sleeps a random 1-5s, then streams 2.
 * 3. Repeats for 3, 4, and 5.
 */
export async function colorCounterWorkflow() {
  "use workflow";

  const color = await pickColorAndStreamFirst();

  for (let n = 2; n <= 5; n++) {
    const seconds = Math.floor(Math.random() * 5) + 1;
    await sleep(`${seconds}s`);
    await streamNumber(color, n);
  }

  return { color, finalNumber: 5 };
}
