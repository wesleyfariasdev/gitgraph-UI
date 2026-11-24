import { useEffect, useMemo, useState } from "react";
import { errorMessage, git } from "../api/git";
import { useKeydown } from "../hooks/useKeydown";
import type { DiffRequest } from "../types";
import { parseUnifiedDiff } from "../utils/diff";
import { KIND_LABEL, KIND_LETTER, shortHash } from "../utils/format";

/** Rendering tens of thousands of DOM rows freezes the window; huge diffs are truncated. */
const MAX_RENDERED_LINES = 4000;

interface Props {
  root: string;
  request: DiffRequest;
  onClose: () => void;
}

export function DiffViewer({ root, request, onClose }: Props) {
  const [raw, setRaw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRaw(null);
    setError(null);
    const load =
      request.source === "commit"
        ? git.loadCommitFileDiff(root, request.hash, request.file)
        : git.loadWorkingFileDiff(root, request.file, request.staged);
    load.then((text) => !cancelled && setRaw(text)).catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [root, request]);

  useKeydown((e) => e.key === "Escape" && onClose());

  const diff = useMemo(() => (raw === null ? null : parseUnifiedDiff(raw)), [raw]);
  const { file } = request;
  const origin =
    request.source === "commit" ? `commit ${shortHash(request.hash)}` : request.staged ? "staged" : "working tree";

  let rendered = 0;

  return (
    <div className="diff">
      <div className="diff__header">
        <span className={`kind kind--${file.kind}`}>{KIND_LETTER[file.kind]}</span>
        <div className="diff__title">
          <div className="diff__path mono">
            {file.oldPath && <span className="diff__old-path">{file.oldPath} → </span>}
            {file.path}
          </div>
          <div className="diff__subtitle">
            {KIND_LABEL[file.kind]} · {origin}
            {diff && (
              <span className="mono">
                {"  "}
                <span className="hl-green">+{diff.additions}</span> <span className="hl-red">−{diff.deletions}</span>
              </span>
            )}
          </div>
        </div>
        <button className="btn btn--ghost" onClick={onClose} title="Back to graph (Esc)">
          ✕ Close <kbd>Esc</kbd>
        </button>
      </div>

      <div className="diff__body">
        {error && <div className="panel-message panel-message--error">{error}</div>}
        {!error && !diff && <div className="panel-message">Loading diff…</div>}
        {diff?.isBinary && <div className="panel-message">Binary file — no text diff to show.</div>}
        {diff && !diff.isBinary && diff.hunks.length === 0 && (
          <div className="panel-message">No textual changes (mode change or empty file).</div>
        )}
        {diff && (
          <table className="diff__table mono">
            <tbody>
              {diff.hunks.map((hunk, h) => {
                if (rendered >= MAX_RENDERED_LINES) return null;
                const lines = hunk.lines.slice(0, MAX_RENDERED_LINES - rendered);
                rendered += lines.length;
                return [
                  <tr key={`h${h}`} className="diff__hunk">
                    <td colSpan={3}>{hunk.header}</td>
                  </tr>,
                  ...lines.map((line, i) => (
                    <tr key={`${h}-${i}`} className={`diff__line diff__line--${line.type}`}>
                      <td className="diff__num">{line.oldNumber ?? ""}</td>
                      <td className="diff__num">{line.newNumber ?? ""}</td>
                      <td className="diff__code">
                        <span className="diff__sign">
                          {line.type === "add" ? "+" : line.type === "del" ? "−" : " "}
                        </span>
                        {line.text}
                      </td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        )}
        {rendered >= MAX_RENDERED_LINES && (
          <div className="panel-message">Diff truncated at {MAX_RENDERED_LINES} lines.</div>
        )}
      </div>
    </div>
  );
}
