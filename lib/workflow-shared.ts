export const FINAL_NUMBER = 5;
export const MAX_CHILDREN = 24;

export type StreamEvent =
  | { type: "init"; runIds: string[] }
  | {
      type: "update";
      childIndex: number;
      color: string;
      currentNumber: number;
    };
