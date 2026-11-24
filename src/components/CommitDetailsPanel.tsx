import { useEffect, useState } from "react";
import { errorMessage, git, type CommitDetails, type FileChange } from "../api/git";
import type { RefBadge } from "../graph/refBadges";
import { fullDate, shortHash, timeAgo } from "../utils/format";
import { FileList } from "./FileList";

interface Props {
  root: string;
  hash: string;
  badges: RefBadge[] | undefined;
  activePath: string | null;
  onOpenFile: (file: FileChange) => void;
  onJumpTo: (hash: string) => void;
  onCopy: (text: string, what: string) => void;
}

export function CommitDetailsPanel({ root, hash, badges, activePath, onOpenFile, onJumpTo, onCopy }: Props) {
  const [details, setDetails] = useState<CommitDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    git
      .loadCommitDetails(root, hash)
      .then((d) => !cancelled && setDetails(d))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [root, hash]);

  if (error) return <div className="panel-message panel-message--error">{error}</div>;
  if (!details || details.hash !== hash) return <div className="panel-message">Loading commit…</div>;

  const [subject, ...bodyLines] = details.message.split("\n");
  const body = bodyLines.join("\n").trim();
  const counts = countKinds(details.files);

  return (
    <div className="inspector__content">
      <div className="inspector__header">
        <span className="label">// commit</span>
        <button className="sha-chip mono" title="Copy full SHA" onClick={() => onCopy(details.hash, "SHA")}>
          {shortHash(details.hash)} ⧉
        </button>
      </div>

      <div className="commit-card">
        <h2 className="commit-card__subject">{subject}</h2>
        {body && <pre className="commit-card__body">{body}</pre>}

        {badges && badges.length > 0 && (
          <div className="commit-card__refs">
            {badges.map((b) => (
              <span key={b.key} className={`badge badge--${b.kind}${b.isHead ? " badge--head" : ""}`}>
                {b.label}
              </span>
            ))}
          </div>
        )}

        <dl className="meta">
          <dt>Author</dt>
          <dd>
            <span className="avatar">{initials(details.authorName)}</span>
            <span>
              {details.authorName}
              <span className="meta__dim"> &lt;{details.authorEmail}&gt;</span>
            </span>
          </dd>
          <dt>Date</dt>
          <dd title={fullDate(details.authorTime)}>
            {fullDate(details.authorTime)} <span className="meta__dim">· {timeAgo(details.authorTime)}</span>
          </dd>
          {details.committerName !== details.authorName && (
            <>
              <dt>Committer</dt>
              <dd>{details.committerName}</dd>
            </>
          )}
          <dt>{details.parents.length > 1 ? "Parents" : "Parent"}</dt>
          <dd>
            {details.parents.length === 0 && <span className="meta__dim">root commit</span>}
            {details.parents.map((p) => (
              <button key={p} className="link mono" onClick={() => onJumpTo(p)} title="Jump to parent">
                {shortHash(p)}
              </button>
            ))}
          </dd>
        </dl>
      </div>

      <div className="section-header">
        <span className="label">
          Files changed · {details.files.length}
          {details.parents.length > 1 && " (vs first parent)"}
        </span>
        <span className="change-summary mono">
          {counts.added > 0 && <span className="hl-green">+{counts.added}</span>}
          {counts.modified > 0 && <span className="hl-yellow">~{counts.modified}</span>}
          {counts.deleted > 0 && <span className="hl-red">−{counts.deleted}</span>}
        </span>
      </div>
      <div className="inspector__files">
        {details.files.length === 0 ? (
          <div className="panel-message">No file changes</div>
        ) : (
          <FileList files={details.files} activePath={activePath} onOpen={onOpenFile} />
        )}
      </div>
    </div>
  );
}

function countKinds(files: FileChange[]) {
  return {
    added: files.filter((f) => f.kind === "added" || f.kind === "copied").length,
    deleted: files.filter((f) => f.kind === "deleted").length,
    modified: files.filter((f) => !["added", "copied", "deleted"].includes(f.kind)).length,
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
