import { describe, expect, it } from "vitest";
import type { GitRef } from "../api/git";
import { buildRefBadges } from "./refBadges";

const ref = (kind: GitRef["kind"], name: string, target: string): GitRef => ({
  name,
  fullName: `refs/${kind}/${name}`,
  kind,
  target,
  upstream: null,
  ahead: 0,
  behind: 0,
});

describe("buildRefBadges", () => {
  it("merges a local branch with its remote twin on the same commit", () => {
    // Arrange
    const refs = [ref("localBranch", "dev", "c1"), ref("remoteBranch", "origin/dev", "c1")];

    // Act
    const badges = buildRefBadges(refs, { branch: "dev", commit: "c1" }).get("c1")!;

    // Assert
    expect(badges).toHaveLength(1);
    expect(badges[0]).toMatchObject({ label: "dev", isHead: true, syncedRemotes: ["origin"] });
  });

  it("keeps the remote badge when the remote branch is on another commit", () => {
    const refs = [ref("localBranch", "dev", "c2"), ref("remoteBranch", "origin/dev", "c1")];

    const badges = buildRefBadges(refs, { branch: "dev", commit: "c2" });

    expect(badges.get("c1")![0]).toMatchObject({ kind: "remote", label: "origin/dev" });
    expect(badges.get("c2")![0].syncedRemotes).toEqual([]);
  });

  it("orders HEAD first, then local branches, remotes and tags", () => {
    const refs = [
      ref("tag", "v1", "c1"),
      ref("remoteBranch", "origin/x", "c1"),
      ref("localBranch", "a", "c1"),
      ref("localBranch", "main", "c1"),
    ];

    const labels = buildRefBadges(refs, { branch: "main", commit: "c1" })
      .get("c1")!
      .map((b) => b.label);

    expect(labels).toEqual(["main", "a", "origin/x", "v1"]);
  });

  it("adds a HEAD badge when detached", () => {
    const badges = buildRefBadges([], { branch: null, commit: "c9" });

    expect(badges.get("c9")![0]).toMatchObject({ kind: "detached", label: "HEAD" });
  });
});
