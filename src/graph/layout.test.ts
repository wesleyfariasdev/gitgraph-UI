import { describe, expect, it } from "vitest";
import { layoutGraph } from "./layout";

const c = (hash: string, ...parents: string[]) => ({ hash, parents });

describe("layoutGraph", () => {
  it("keeps a linear history in a single lane", () => {
    // Arrange
    const commits = [c("c", "b"), c("b", "a"), c("a")];

    // Act
    const { rows, laneCount } = layoutGraph(commits);

    // Assert
    expect(laneCount).toBe(1);
    expect(rows.map((r) => r.lane)).toEqual([0, 0, 0]);
    expect(rows[0].segments).toEqual([{ fromLane: 0, toLane: 0, color: 0 }]);
    expect(rows[2].segments).toEqual([]);
  });

  it("opens a second lane for a merged branch and closes it at the fork point", () => {
    // m merges f into b; both b and f branch off a.
    const commits = [c("m", "b", "f"), c("f", "a"), c("b", "a"), c("a")];

    const { rows, laneCount } = layoutGraph(commits);

    expect(laneCount).toBe(2);
    expect(rows[0].isMerge).toBe(true);
    expect(rows.map((r) => r.lane)).toEqual([0, 1, 0, 0]);
    // From the merge: main line continues in lane 0, merged branch goes to lane 1 where f sits.
    expect(rows[0].segments).toEqual(
      expect.arrayContaining([
        { fromLane: 0, toLane: 0, color: 0 },
        { fromLane: 0, toLane: 1, color: 1 },
      ]),
    );
    // At b, lane 1 (waiting for `a`) and lane 0 (b -> a) must both converge into a.
    const intoA = rows[2].segments.filter((s) => s.toLane === 0);
    expect(intoA.length).toBe(2);
  });

  it("starts a new lane for a branch tip that nobody points to yet", () => {
    const commits = [c("x", "a"), c("y", "a"), c("a")];

    const { rows } = layoutGraph(commits);

    expect(rows[0].lane).toBe(0);
    expect(rows[1].lane).toBe(1);
    expect(rows[1].color).not.toBe(rows[0].color);
    // y's parent is already owned by lane 0, so y's lane ends and joins lane 0.
    expect(rows[1].segments).toEqual(expect.arrayContaining([{ fromLane: 1, toLane: 0, color: 0 }]));
  });
});
