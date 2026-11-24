import type { GitRef, HeadState } from "../api/git";

export interface RefBadge {
  key: string;
  label: string;
  kind: "local" | "remote" | "tag" | "detached";
  ref: GitRef | null;
  isHead: boolean;
  /** Remotes whose branch of the same name sits on the same commit, shown as one badge. */
  syncedRemotes: string[];
}

/**
 * Groups refs by the commit they point to. A local branch and its remote
 * counterpart on the same commit collapse into a single badge, the way people think about them.
 */
export function buildRefBadges(refs: GitRef[], head: HeadState): Map<string, RefBadge[]> {
  const byCommit = new Map<string, RefBadge[]>();
  const add = (hash: string, badge: RefBadge) => {
    const list = byCommit.get(hash) ?? [];
    list.push(badge);
    byCommit.set(hash, list);
  };

  const locals = refs.filter((r) => r.kind === "localBranch");
  const localBadges = new Map<string, RefBadge>();

  for (const ref of locals) {
    const badge: RefBadge = {
      key: ref.fullName,
      label: ref.name,
      kind: "local",
      ref,
      isHead: ref.name === head.branch,
      syncedRemotes: [],
    };
    localBadges.set(`${ref.target}:${ref.name}`, badge);
    add(ref.target, badge);
  }

  for (const ref of refs) {
    if (ref.kind === "remoteBranch") {
      const slash = ref.name.indexOf("/");
      const remote = ref.name.slice(0, slash);
      const branch = ref.name.slice(slash + 1);
      const twin = localBadges.get(`${ref.target}:${branch}`);
      if (twin) {
        twin.syncedRemotes.push(remote);
        continue;
      }
      add(ref.target, { key: ref.fullName, label: ref.name, kind: "remote", ref, isHead: false, syncedRemotes: [] });
    } else if (ref.kind === "tag") {
      add(ref.target, { key: ref.fullName, label: ref.name, kind: "tag", ref, isHead: false, syncedRemotes: [] });
    }
  }

  if (!head.branch && head.commit) {
    add(head.commit, { key: "HEAD", label: "HEAD", kind: "detached", ref: null, isHead: true, syncedRemotes: [] });
  }

  // HEAD first, then local branches, remotes, tags.
  const order = { detached: 0, local: 1, remote: 2, tag: 3 };
  for (const list of byCommit.values()) {
    list.sort((a, b) => Number(b.isHead) - Number(a.isHead) || order[a.kind] - order[b.kind]);
  }
  return byCommit;
}
