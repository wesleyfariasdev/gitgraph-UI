import type { GitRef } from "../api/git";

/** Commits ahead of / behind the upstream branch, e.g. ↑2 ↓1. */
export function TrackingCounts({ gitRef }: { gitRef: GitRef }) {
  return (
    <>
      {gitRef.ahead > 0 && (
        <span className="track track--ahead" title={`${gitRef.ahead} commit(s) to push`}>
          ↑{gitRef.ahead}
        </span>
      )}
      {gitRef.behind > 0 && (
        <span className="track track--behind" title={`${gitRef.behind} commit(s) to pull`}>
          ↓{gitRef.behind}
        </span>
      )}
    </>
  );
}
