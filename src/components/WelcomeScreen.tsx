import type { RepoInfo } from "../api/git";
import { Logo } from "./Logo";

interface Props {
  recent: RepoInfo[];
  onOpenDialog: () => void;
  onOpenRecent: (repo: RepoInfo) => void;
  onForget: (repo: RepoInfo) => void;
}

export function WelcomeScreen({ recent, onOpenDialog, onOpenRecent, onForget }: Props) {
  return (
    <div className="welcome">
      <div className="welcome__grid" />
      <div className="welcome__panel">
        <Logo size="large" />
        <p className="welcome__tagline">
          <span className="hl-cyan">see</span> your history · <span className="hl-magenta">shape</span> your branches ·{" "}
          <span className="hl-yellow">ship</span> your commits
        </p>

        <button className="btn btn--big" onClick={onOpenDialog}>
          ⌁ Open repository
        </button>
        <p className="hint hint--center">
          or drop a folder anywhere on this window · <kbd>Ctrl</kbd> + <kbd>O</kbd>
        </p>

        {recent.length > 0 && (
          <div className="recent">
            <div className="label">// recent</div>
            <ul>
              {recent.map((repo) => (
                <li key={repo.root} className="recent__item" onClick={() => onOpenRecent(repo)}>
                  <span className="recent__name">{repo.name}</span>
                  <span className="recent__path mono">{repo.root}</span>
                  <button
                    className="icon-btn"
                    title="Remove from list"
                    onClick={(e) => {
                      e.stopPropagation();
                      onForget(repo);
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
