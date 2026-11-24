import { useState, type KeyboardEvent } from "react";
import type { FileChange, WorkingTreeStatus } from "../api/git";
import { FileList } from "./FileList";

const SUMMARY_SOFT_LIMIT = 72;

interface Props {
  status: WorkingTreeStatus;
  branch: string | null;
  busy: boolean;
  activePath: string | null;
  onOpenFile: (file: FileChange, staged: boolean) => void;
  onStage: (paths: string[]) => void;
  onUnstage: (paths: string[]) => void;
  onCommit: (message: string) => Promise<boolean>;
}

export function WorkingTreePanel(p: Props) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const { staged, unstaged, conflicted } = p.status;

  const canCommit = staged.length > 0 && summary.trim().length > 0 && conflicted.length === 0 && !p.busy;

  const commit = async () => {
    if (!canCommit) return;
    const message = description.trim() ? `${summary.trim()}\n\n${description.trim()}` : summary.trim();
    if (await p.onCommit(message)) {
      setSummary("");
      setDescription("");
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void commit();
    }
  };

  const nothingToDo = staged.length + unstaged.length + conflicted.length === 0;

  return (
    <div className="inspector__content">
      <div className="inspector__header">
        <span className="label">// working tree</span>
        <span className="mono hl-cyan">{p.branch ?? "detached HEAD"}</span>
      </div>

      {nothingToDo && (
        <div className="panel-message">
          <div className="big-check">✔</div>
          Working tree clean. Nothing to commit.
        </div>
      )}

      {conflicted.length > 0 && (
        <>
          <div className="section-header section-header--danger">
            <span className="label">⚠ Conflicts · {conflicted.length}</span>
          </div>
          <p className="hint">Resolve these in your editor, then stage them.</p>
          <FileList
            files={conflicted}
            activePath={p.activePath}
            onOpen={(f) => p.onOpenFile(f, false)}
            action={{ glyph: "+", title: "Mark as resolved (stage)", onClick: (f) => p.onStage([f.path]) }}
          />
        </>
      )}

      {unstaged.length > 0 && (
        <>
          <div className="section-header">
            <span className="label">Unstaged · {unstaged.length}</span>
            <button
              className="btn btn--ghost btn--tiny"
              disabled={p.busy}
              onClick={() => p.onStage(unstaged.map((f) => f.path))}
            >
              Stage all ↓
            </button>
          </div>
          <div className="inspector__files inspector__files--half">
            <FileList
              files={unstaged}
              activePath={p.activePath}
              onOpen={(f) => p.onOpenFile(f, false)}
              action={{ glyph: "+", title: "Stage file", onClick: (f) => p.onStage([f.path]) }}
            />
          </div>
        </>
      )}

      {staged.length > 0 && (
        <>
          <div className="section-header section-header--staged">
            <span className="label">Staged · {staged.length}</span>
            <button
              className="btn btn--ghost btn--tiny"
              disabled={p.busy}
              onClick={() => p.onUnstage(staged.map((f) => (f.oldPath ? [f.oldPath, f.path] : [f.path])).flat())}
            >
              Unstage all ↑
            </button>
          </div>
          <div className="inspector__files inspector__files--half">
            <FileList
              files={staged}
              activePath={p.activePath}
              onOpen={(f) => p.onOpenFile(f, true)}
              action={{
                glyph: "−",
                title: "Unstage file",
                onClick: (f) => p.onUnstage(f.oldPath ? [f.oldPath, f.path] : [f.path]),
              }}
            />
          </div>
        </>
      )}

      {!nothingToDo && (
        <div className="commit-box" onKeyDown={onKeyDown}>
          <div className="commit-box__summary">
            <input
              className="input"
              placeholder="Commit summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              spellCheck={false}
            />
            <span className={`commit-box__counter${summary.length > SUMMARY_SOFT_LIMIT ? " is-over" : ""}`}>
              {SUMMARY_SOFT_LIMIT - summary.length}
            </span>
          </div>
          <textarea
            className="input commit-box__description"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <button className="btn btn--magenta commit-box__button" disabled={!canCommit} onClick={() => void commit()}>
            {staged.length === 0
              ? "Stage files to commit"
              : `Commit ${staged.length} file${staged.length === 1 ? "" : "s"}`}
          </button>
          <div className="hint hint--center">
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to commit
          </div>
        </div>
      )}
    </div>
  );
}
