import { getWritable, sleep } from "workflow";

/**
 * Data chunk streamed from each child workflow to the UI.
 */
export type CounterUpdate = {
  color: string;
  currentNumber: number;
};

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f43f5e", // rose
  "#a855f7", // purple
  "#10b981", // emerald
];

function pickRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function randomSleepMs(): number {
  const seconds = Math.floor(Math.random() * 5) + 1; // 1-5 seconds
  return seconds * 1000;
}

/**
 * Step function that writes a counter update to the workflow stream as a JSON string.
 * Writing plain strings avoids devalue serialization complexity when reading chunks.
 */
async function streamNumber(color: string, num: number) {
  "use step";

  const writable = getWritable<string>();
  const writer = writable.getWriter();
  try {
    const payload: CounterUpdate = { color, currentNumber: num };
    await writer.write(JSON.stringify(payload));
  } finally {
    writer.releaseLock();
  }
}

/**
 * Step function that closes the workflow stream.
 */
async function closeStream() {
  "use step";

  await getWritable<string>().close();
}

/**
 * A child workflow that picks a random color, streams numbers 1-5,
 * sleeping a random 1-5s between each number after the first.
 */
export async function colorCounterWorkflow() {
  "use workflow";

  const color = pickRandomColor();

  // Immediately stream number 1
  await streamNumber(color, 1);

  // 4 sleep cycles, streaming numbers 2-5
  for (let i = 2; i <= 5; i++) {
    await sleep(randomSleepMs());
    await streamNumber(color, i);
  }

  await closeStream();

  return { color, finalNumber: 5 };
}
