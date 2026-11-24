import type { GitRef, HeadState, RepoInfo } from "../api/git";
import { shortHash } from "../utils/format";
import { Logo } from "./Logo";
import { TrackingCounts } from "./TrackingCounts";

interface Props {
  repo: RepoInfo;
  head: HeadState;
  headRef: GitRef | undefined;
  busy: boolean;
  onRefresh: () => void;
  onOpenAnother: () => void;
  onClose: () => void;
}

export function TopBar({ repo, head, headRef, busy, onRefresh, onOpenAnother, onClose }: Props) {
  const detachedLabel = `detached @ ${head.commit ? shortHash(head.commit) : "—"}`;

  return (
    <header className="topbar">
      <Logo />
      <div className="topbar__repo">
        <span className="topbar__repo-name">{repo.name}</span>
        <span className="topbar__repo-path mono">{repo.root}</span>
      </div>
      <div className={`topbar__branch${head.branch ? "" : " is-detached"}`} title="Current branch (HEAD)">
        <span className="label">HEAD</span>
        <span className="mono">{head.branch ?? detachedLabel}</span>
        {headRef && <TrackingCounts gitRef={headRef} />}
      </div>
      <div className="topbar__actions">
        <button className="btn btn--ghost" onClick={onRefresh} title="Reload (F5)">
          ⟳ Refresh
        </button>
        <button className="btn btn--ghost" onClick={onOpenAnother} title="Open another repository (Ctrl+O)">
          ⌁ Open
        </button>
        <button className="btn btn--ghost" onClick={onClose} title="Close repository">
          ✕
        </button>
      </div>
      {busy && <div className="topbar__progress" />}
    </header>
  );
}
