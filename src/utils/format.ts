const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "5 min. ago", "3 days ago"… — easier to scan in a list than absolute dates. */
export function timeAgo(unixSeconds: number, now = Date.now()): string {
  const diff = unixSeconds - now / 1000;
  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diff) >= seconds) return relative.format(Math.round(diff / seconds), unit);
  }
  return "just now";
}

export function fullDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function shortHash(hash: string): string {
  return hash.slice(0, 7);
}

/** Splits "src/components/App.tsx" into its folder and file name for two-tone display. */
export function splitPath(path: string): { dir: string; name: string } {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? { dir: "", name: path } : { dir: path.slice(0, slash + 1), name: path.slice(slash + 1) };
}

export const KIND_LETTER: Record<string, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
  typeChanged: "T",
  untracked: "U",
  conflicted: "!",
};

export const KIND_LABEL: Record<string, string> = {
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
  copied: "Copied",
  typeChanged: "Type changed",
  untracked: "New file (untracked)",
  conflicted: "Conflict",
};
