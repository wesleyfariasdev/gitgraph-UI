import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, git, type Commit, type GitRef, type HeadState, type WorkingTreeStatus } from "../api/git";

export interface RepositoryData {
  commits: Commit[];
  refs: GitRef[];
  head: HeadState;
  status: WorkingTreeStatus;
}

const EMPTY: RepositoryData = {
  commits: [],
  refs: [],
  head: { branch: null, commit: null },
  status: { staged: [], unstaged: [], conflicted: [] },
};

/**
 * Loads everything the workspace shows for one repository and exposes `run`,
 * which executes a mutating git operation and then reloads.
 */
export function useRepository(root: string, onError: (title: string, detail: string) => void) {
  const [data, setData] = useState<RepositoryData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  // Discards responses from a refresh that was superseded by a newer one.
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const [commits, refsSnapshot, status] = await Promise.all([
        git.loadCommits(root),
        git.loadRefs(root),
        git.loadStatus(root),
      ]);
      if (current !== generation.current) return;
      setData({ commits, refs: refsSnapshot.refs, head: refsSnapshot.head, status });
      setLoaded(true);
    } catch (error) {
      if (current === generation.current) onError("Could not read repository", errorMessage(error));
    }
  }, [root, onError]);

  useEffect(() => {
    setData(EMPTY);
    setLoaded(false);
    void refresh();
  }, [refresh]);

  // Changes made in a terminal or editor show up as soon as the user comes back to the window.
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const run = useCallback(
    async (failureTitle: string, operation: () => Promise<unknown>): Promise<boolean> => {
      setBusy(true);
      try {
        await operation();
        return true;
      } catch (error) {
        onError(failureTitle, errorMessage(error));
        return false;
      } finally {
        await refresh();
        setBusy(false);
      }
    },
    [refresh, onError],
  );

  return { ...data, loaded, busy, refresh, run };
}
