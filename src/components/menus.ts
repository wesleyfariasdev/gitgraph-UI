import type { Commit, GitRef, HeadState } from "../api/git";
import type { RefBadge } from "../graph/refBadges";
import type { GitActions } from "../hooks/useGitActions";
import { shortHash } from "../utils/format";
import type { MenuEntry } from "./ContextMenu";

interface MenuHandlers {
  actions: GitActions;
  head: HeadState;
  copy: (text: string, what: string) => void;
  locate: (hash: string) => void;
  openCreateBranch: (commit: Commit) => void;
}

export function commitMenuTitle(commit: Commit): string {
  return `${shortHash(commit.hash)} · ${commit.subject}`;
}

export function buildCommitMenu(commit: Commit, badges: RefBadge[], h: MenuHandlers): MenuEntry[] {
  // Offer the branches sitting on this commit first: checking one out is the most common intent.
  const branchCheckouts: MenuEntry[] = badges
    .filter((b) => b.kind === "local" && !b.isHead && b.ref)
    .map((b) => ({ label: `Check out ${b.label}`, onSelect: () => void h.actions.checkoutRef(b.ref!) }));

  return [
    ...branchCheckouts,
    { label: "Create branch here…", hint: "B", onSelect: () => h.openCreateBranch(commit) },
    { label: "Check out this commit (detached)", onSelect: () => void h.actions.checkoutCommit(commit.hash) },
    "separator",
    { label: "Copy SHA", onSelect: () => h.copy(commit.hash, "SHA") },
    { label: "Copy message", onSelect: () => h.copy(commit.subject, "Message") },
  ];
}

export function buildRefMenu(ref: GitRef, h: MenuHandlers): MenuEntry[] {
  const isCurrent = ref.kind === "localBranch" && ref.name === h.head.branch;
  const checkout: MenuEntry[] =
    ref.kind === "tag"
      ? []
      : [
          {
            label: isCurrent ? "Current branch" : `Check out ${ref.name}`,
            disabled: isCurrent,
            onSelect: () => void h.actions.checkoutRef(ref),
          },
        ];

  return [
    ...checkout,
    { label: "Locate in graph", onSelect: () => h.locate(ref.target) },
    "separator",
    { label: "Copy name", onSelect: () => h.copy(ref.name, "Name") },
  ];
}
