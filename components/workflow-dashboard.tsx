"use client";

import { Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { WorkflowSquare } from "@/components/workflow-square";
import { useWorkflowDemo } from "@/hooks/use-workflow-stream";

function WorkflowGrid({
  workflows,
}: {
  workflows: Array<{
    runId: string;
    color: string | null;
    currentNumber: number | null;
    done: boolean;
  }>;
}) {
  const completedCount = workflows.filter((c) => c.done).length;
  const totalCount = workflows.length;
  const allDone = completedCount === totalCount;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm text-muted-foreground">
          {completedCount}/{totalCount} completed
        </p>
        {!allDone && (
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-xs text-muted-foreground">
              streaming
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {workflows.map((child, index) => (
          <WorkflowSquare
            key={child.runId}
            color={child.color}
            currentNumber={child.currentNumber}
            index={index}
            done={child.done}
          />
        ))}
      </div>
    </div>
  );
}

export function WorkflowDashboard() {
  const [count, setCount] = useState(12);
  const { children, isStarting, hasStarted, startDemo } = useWorkflowDemo();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-balance font-mono text-3xl font-bold tracking-tight text-foreground">
          Parallel Streaming Workflows
        </h1>
        <p className="max-w-lg text-pretty text-sm text-muted-foreground">
          Each square is an independent Vercel Workflow. They run in parallel,
          each picking a random color and streaming numbers 1 through 5 with
          random sleep intervals between steps.
        </p>
      </header>

      {!hasStarted ? (
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="workflow-count"
                className="font-mono text-sm text-muted-foreground"
              >
                Child workflows
              </label>
              <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
                {count}
              </span>
            </div>
            <Slider
              id="workflow-count"
              min={1}
              max={24}
              step={1}
              value={[count]}
              onValueChange={([value]) => setCount(value)}
            />
          </div>
          <Button
            size="lg"
            onClick={() => startDemo(count)}
            disabled={isStarting}
            className="w-full font-mono"
          >
            {isStarting ? (
              "Spawning workflows..."
            ) : (
              <>
                <Play className="mr-2 size-4" />
                Launch {count} workflows
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <WorkflowGrid workflows={children} />
          <Button
            variant="outline"
            onClick={() => startDemo(count)}
            disabled={isStarting}
            className="mx-auto w-fit font-mono"
          >
            {isStarting ? (
              "Restarting..."
            ) : (
              <>
                <RotateCcw className="mr-2 size-4" />
                Restart with {count} workflows
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
