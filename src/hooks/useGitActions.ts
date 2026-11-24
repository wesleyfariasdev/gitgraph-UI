import { useMemo } from "react";
import { git, type GitRef, type HeadState } from "../api/git";
import type { ToastKind } from "../components/Toasts";
import { shortHash } from "../utils/format";

type Run = (failureTitle: string, operation: () => Promise<unknown>) => Promise<boolean>;
type Notify = (kind: ToastKind, title: string, detail?: string) => void;

interface Dependencies {
  root: string;
  refs: GitRef[];
  head: HeadState;
  run: Run;
  notify: Notify;
}

/** Every mutating git operation the UI offers, with its user feedback. */
export function useGitActions({ root, refs, head, run, notify }: Dependencies) {
  return useMemo(() => {
    const succeed = async (
      failureTitle: string,
      operation: () => Promise<unknown>,
      success: string,
      detail?: string,
    ) => {
      const ok = await run(failureTitle, operation);
      if (ok) notify("success", success, detail);
      return ok;
    };

    const checkoutLocal = (name: string) => {
      if (name === head.branch) {
        notify("info", `Already on ${name}`);
        return Promise.resolve(false);
      }
      return succeed(`Could not check out ${name}`, () => git.checkoutBranch(root, name), `Switched to ${name}`);
    };

    /** A remote branch reuses the local branch of the same name, or gets a new tracking branch. */
    const checkoutRemote = (remoteName: string) => {
      const localName = remoteName.slice(remoteName.indexOf("/") + 1);
      const hasLocal = refs.some((r) => r.kind === "localBranch" && r.name === localName);
      if (hasLocal) return checkoutLocal(localName);
      return succeed(
        `Could not check out ${remoteName}`,
        () => git.checkoutRemoteBranch(root, remoteName),
        `Created ${localName} tracking ${remoteName}`,
      );
    };

    return {
      checkoutRef: (ref: GitRef) => (ref.kind === "remoteBranch" ? checkoutRemote(ref.name) : checkoutLocal(ref.name)),

      checkoutCommit: (hash: string) =>
        succeed(
          "Could not check out commit",
          () => git.checkoutCommit(root, hash),
          `HEAD detached at ${shortHash(hash)}`,
          "Create a branch here to keep new commits.",
        ),

      createBranch: (name: string, startPoint: string, checkout: boolean) =>
        succeed(
          `Could not create ${name}`,
          () => git.createBranch(root, name, startPoint, checkout),
          checkout ? `Created and switched to ${name}` : `Created ${name}`,
        ),

      stage: (paths: string[]) => run("Could not stage", () => git.stageFiles(root, paths)),

      unstage: (paths: string[]) => run("Could not unstage", () => git.unstageFiles(root, paths)),

      commit: async (message: string) => {
        let hash = "";
        const ok = await run("Commit failed", async () => {
          hash = await git.createCommit(root, message);
        });
        if (ok) notify("success", `Committed ${shortHash(hash)}`, message.split("\n")[0]);
        return ok;
      },
    };
  }, [root, refs, head.branch, run, notify]);
}

export type GitActions = ReturnType<typeof useGitActions>;
