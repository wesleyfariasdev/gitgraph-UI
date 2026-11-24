import type { FileChange } from "../api/git";
import { KIND_LABEL, KIND_LETTER, splitPath } from "../utils/format";

interface Props {
  files: FileChange[];
  activePath?: string | null;
  onOpen: (file: FileChange) => void;
  action?: { glyph: string; title: string; onClick: (file: FileChange) => void };
}

export function FileList({ files, activePath, onOpen, action }: Props) {
  return (
    <ul className="file-list">
      {files.map((file) => {
        const { dir, name } = splitPath(file.path);
        return (
          <li
            key={`${file.kind}:${file.path}`}
            className={`file-list__item${activePath === file.path ? " is-active" : ""}`}
            onClick={() => onOpen(file)}
            title={`${KIND_LABEL[file.kind]}: ${file.oldPath ? `${file.oldPath} → ` : ""}${file.path}`}
          >
            <span className={`kind kind--${file.kind}`}>{KIND_LETTER[file.kind]}</span>
            <span className="file-list__path">
              <span className="file-list__name">{name}</span>
              <span className="file-list__dir">{dir}</span>
            </span>
            {action && (
              <button
                className="icon-btn file-list__action"
                title={action.title}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick(file);
                }}
              >
                {action.glyph}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
