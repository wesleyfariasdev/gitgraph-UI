import type { FileChange } from "./api/git";

export type Selection = { kind: "wip" } | { kind: "commit"; hash: string };

export type DiffRequest =
  { source: "commit"; hash: string; file: FileChange } | { source: "working"; file: FileChange; staged: boolean };
