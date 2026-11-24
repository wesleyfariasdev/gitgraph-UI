import { invoke } from "@tauri-apps/api/core";

export interface RepoInfo {
  root: string;
  name: string;
}

export interface Commit {
  hash: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  timestamp: number;
  subject: string;
}

export type RefKind = "localBranch" | "remoteBranch" | "tag";

export interface GitRef {
  name: string;
  fullName: string;
  kind: RefKind;
  target: string;
  upstream: string | null;
  ahead: number;
  behind: number;
}

export interface HeadState {
  branch: string | null;
  commit: string | null;
}

export interface RefsSnapshot {
  head: HeadState;
  refs: GitRef[];
}

export type ChangeKind =
  "added" | "modified" | "deleted" | "renamed" | "copied" | "typeChanged" | "untracked" | "conflicted";

export interface FileChange {
  path: string;
  oldPath: string | null;
  kind: ChangeKind;
}

export interface WorkingTreeStatus {
  staged: FileChange[];
  unstaged: FileChange[];
  conflicted: FileChange[];
}

export interface CommitDetails {
  hash: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  authorTime: number;
  committerName: string;
  committerTime: number;
  message: string;
  files: FileChange[];
}

/** Thin typed wrappers over the Rust commands in `src-tauri/src/commands.rs`. */
export const git = {
  launchPath: () => invoke<string | null>("launch_path"),
  openRepository: (path: string) => invoke<RepoInfo>("open_repository", { path }),
  loadCommits: (repo: string, limit?: number) => invoke<Commit[]>("load_commits", { repo, limit }),
  loadRefs: (repo: string) => invoke<RefsSnapshot>("load_refs", { repo }),
  loadStatus: (repo: string) => invoke<WorkingTreeStatus>("load_status", { repo }),
  loadCommitDetails: (repo: string, hash: string) => invoke<CommitDetails>("load_commit_details", { repo, hash }),
  loadCommitFileDiff: (repo: string, hash: string, file: FileChange) =>
    invoke<string>("load_commit_file_diff", { repo, hash, path: file.path, oldPath: file.oldPath }),
  loadWorkingFileDiff: (repo: string, file: FileChange, staged: boolean) =>
    invoke<string>("load_working_file_diff", {
      repo,
      path: file.path,
      oldPath: file.oldPath,
      staged,
      untracked: file.kind === "untracked",
    }),
  stageFiles: (repo: string, paths: string[]) => invoke<void>("stage_files", { repo, paths }),
  unstageFiles: (repo: string, paths: string[]) => invoke<void>("unstage_files", { repo, paths }),
  createCommit: (repo: string, message: string) => invoke<string>("create_commit", { repo, message }),
  checkoutBranch: (repo: string, name: string) => invoke<void>("checkout_branch", { repo, name }),
  checkoutRemoteBranch: (repo: string, name: string) => invoke<void>("checkout_remote_branch", { repo, name }),
  checkoutCommit: (repo: string, hash: string) => invoke<void>("checkout_commit", { repo, hash }),
  createBranch: (repo: string, name: string, startPoint: string, checkout: boolean) =>
    invoke<void>("create_branch", { repo, name, startPoint, checkout }),
};

/** Tauri rejects with the serialized `GitError`, which is a plain string. */
export function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}
