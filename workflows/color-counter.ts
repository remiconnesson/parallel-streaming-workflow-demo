import { getWritable, sleep } from "workflow";
import { FINAL_NUMBER } from "@/lib/workflow-shared";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
  "#a855f7",
  "#10b981",
];

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
