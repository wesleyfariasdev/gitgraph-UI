/**
 * Lane layout for the commit graph.
 *
 * Commits arrive newest-first in topological order. We sweep them top to bottom
 * keeping a list of "lanes": lane i holds the hash of the commit expected to
 * appear next in column i. Each row gets a node column plus the edge segments
 * that connect it to the row below — enough for a renderer to draw any window
 * of rows independently, which is what makes virtualized drawing possible.
 */

export interface GraphInput {
  hash: string;
  parents: string[];
}

/** A line drawn from the centre of row `r` (x = `fromLane`) to the centre of row `r + 1` (x = `toLane`). */
export interface Segment {
  fromLane: number;
  toLane: number;
  color: number;
}

export interface GraphRow {
  lane: number;
  color: number;
  isMerge: boolean;
  /** Segments that leave this row heading down to the next one. */
  segments: Segment[];
}

export interface GraphLayout {
  rows: GraphRow[];
  /** Widest number of lanes used by any row. */
  laneCount: number;
}

type Lane = { hash: string; color: number } | null;

export function layoutGraph(commits: GraphInput[]): GraphLayout {
  const lanes: Lane[] = [];
  const rows: GraphRow[] = [];
  let nextColor = 0;
  let laneCount = 0;

  for (let r = 0; r < commits.length; r++) {
    const commit = commits[r];
    const before = lanes.slice();

    // 1. Place the node: in the first lane waiting for it, or a free one for a new branch tip.
    let lane = lanes.findIndex((l) => l?.hash === commit.hash);
    const isNewTip = lane === -1;
    if (isNewTip) lane = claimFreeLane(lanes);
    const color = isNewTip ? nextColor++ : lanes[lane]!.color;

    // 2. Every other lane that was waiting for this commit merges into the node and ends here.
    for (let i = 0; i < lanes.length; i++) {
      if (i !== lane && lanes[i]?.hash === commit.hash) lanes[i] = null;
    }

    // 3. Route parents. A parent already owned by another lane joins it instead of opening a duplicate;
    //    for the first parent, the leftmost of the two lanes wins so the main line stays straight.
    const nodeFeeds = new Set<number>();
    lanes[lane] = null;
    commit.parents.forEach((parent, index) => {
      const existing = lanes.findIndex((l) => l?.hash === parent);
      if (existing !== -1 && !(index === 0 && lane < existing)) {
        nodeFeeds.add(existing);
        return;
      }
      if (existing !== -1) lanes[existing] = null;
      const target = index === 0 ? lane : claimFreeLane(lanes);
      lanes[target] = { hash: parent, color: index === 0 ? color : nextColor++ };
      nodeFeeds.add(target);
    });

    trimTrailingEmpty(lanes);
    laneCount = Math.max(laneCount, lanes.length, lane + 1);

    rows.push({
      lane,
      color,
      isMerge: commit.parents.length > 1,
      segments: buildSegments(before, lanes, commit.hash, lane, nodeFeeds, commits[r + 1]?.hash),
    });
  }

  return { rows, laneCount };
}

function buildSegments(
  before: Lane[],
  after: Lane[],
  hash: string,
  nodeLane: number,
  nodeFeeds: Set<number>,
  nextHash: string | undefined,
): Segment[] {
  const segments: Segment[] = [];
  const nextLane = nextHash === undefined ? -1 : after.findIndex((l) => l?.hash === nextHash);
  const destination = (laneIndex: number) => (after[laneIndex]!.hash === nextHash ? nextLane : laneIndex);

  // Lanes that were running above and did not end at this node continue down,
  // possibly shifting into the lane that now owns their commit.
  before.forEach((running, i) => {
    if (!running || running.hash === hash) return;
    const j = after[i]?.hash === running.hash ? i : after.findIndex((l) => l?.hash === running.hash);
    if (j === -1) return;
    segments.push({ fromLane: i, toLane: destination(j), color: after[j]!.color });
  });

  // Edges from the node to each of its parents' lanes.
  nodeFeeds.forEach((j) => {
    segments.push({ fromLane: nodeLane, toLane: destination(j), color: after[j]!.color });
  });

  return segments;
}

function claimFreeLane(lanes: Lane[]): number {
  const free = lanes.indexOf(null);
  if (free !== -1) return free;
  lanes.push(null);
  return lanes.length - 1;
}

function trimTrailingEmpty(lanes: Lane[]): void {
  while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
}
