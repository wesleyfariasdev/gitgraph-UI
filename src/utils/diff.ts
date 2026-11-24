export type DiffLineType = "add" | "del" | "context" | "meta";

export interface DiffLine {
  type: DiffLineType;
  text: string;
  oldNumber: number | null;
  newNumber: number | null;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface ParsedDiff {
  hunks: DiffHunk[];
  isBinary: boolean;
  additions: number;
  deletions: number;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

/** Parses a single-file unified diff as produced by `git diff` / `git diff-tree -p`. */
export function parseUnifiedDiff(raw: string): ParsedDiff {
  const result: ParsedDiff = { hunks: [], isBinary: false, additions: 0, deletions: 0 };
  let hunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of raw.split(/\r?\n/)) {
    const header = HUNK_HEADER.exec(line);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      hunk = { header: line, lines: [] };
      result.hunks.push(hunk);
      continue;
    }

    if (!hunk) {
      if (line.startsWith("Binary files")) result.isBinary = true;
      continue;
    }

    if (line.startsWith("+")) {
      hunk.lines.push({ type: "add", text: line.slice(1), oldNumber: null, newNumber: newLine++ });
      result.additions++;
    } else if (line.startsWith("-")) {
      hunk.lines.push({ type: "del", text: line.slice(1), oldNumber: oldLine++, newNumber: null });
      result.deletions++;
    } else if (line.startsWith(" ")) {
      hunk.lines.push({ type: "context", text: line.slice(1), oldNumber: oldLine++, newNumber: newLine++ });
    } else if (line.startsWith("\\")) {
      hunk.lines.push({ type: "meta", text: line, oldNumber: null, newNumber: null });
    } else if (line.startsWith("diff --git")) {
      // A second file section (should not happen for single-file requests); stop attaching to the old hunk.
      hunk = null;
    }
  }

  return result;
}
