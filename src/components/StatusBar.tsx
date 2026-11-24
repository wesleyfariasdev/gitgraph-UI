interface Props {
  branch: string | null;
  commitCount: number;
  pendingCount: number;
}

export function StatusBar({ branch, commitCount, pendingCount }: Props) {
  return (
    <footer className="statusbar">
      <span className="statusbar__item">
        <span className="dot" /> {branch ?? "detached"}
      </span>
      <span className="statusbar__item">{commitCount.toLocaleString()} commits</span>
      <span className="statusbar__item">{pendingCount} pending</span>
      <span className="statusbar__hints">
        <kbd>↑</kbd>
        <kbd>↓</kbd> navigate · <kbd>B</kbd> branch · dbl-click branch to checkout · right-click for actions ·{" "}
        <kbd>F5</kbd> refresh
      </span>
    </footer>
  );
}
