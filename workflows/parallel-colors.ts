import { getWritable } from "workflow";
import { start } from "workflow/api";
import { colorCounterWorkflow } from "./color-counter";

export type ParentChunk = {
  childRunIds: string[];
};

async function spawnChildren(count: number): Promise<string[]> {
  "use step";

  const runIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const run = await start(colorCounterWorkflow);
    runIds.push(run.runId);
  }
  return runIds;
}

async function streamRunIds(runIds: string[]): Promise<void> {
  "use step";

  const writer = getWritable<ParentChunk>().getWriter();
  await writer.write({ childRunIds: runIds });
  writer.releaseLock();
}

/**
 * Parent workflow that spawns N child color-counter workflows in parallel
 * and streams their run IDs so the UI can subscribe to each child's stream.
 */
export async function parallelColorsWorkflow(count: number) {
  "use workflow";

  const childRunIds = await spawnChildren(count);
  await streamRunIds(childRunIds);

  return { childRunIds };
}
