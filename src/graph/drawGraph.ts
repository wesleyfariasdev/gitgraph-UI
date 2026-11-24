import { laneColor } from "./colors";
import type { GraphLayout } from "./layout";

export const ROW_HEIGHT = 28;
export const LANE_WIDTH = 16;
export const GRAPH_PADDING = 14;
const NODE_RADIUS = 5;

export interface DrawOptions {
  layout: GraphLayout;
  /** Rows shifted down by this many slots (1 when the working-tree row is shown on top). */
  rowOffset: number;
  scrollTop: number;
  width: number;
  height: number;
  headIndex: number;
  selectedIndex: number;
  showWip: boolean;
}

export function laneX(lane: number): number {
  return GRAPH_PADDING + lane * LANE_WIDTH;
}

export function graphWidth(laneCount: number): number {
  return GRAPH_PADDING * 2 + Math.max(laneCount - 1, 0) * LANE_WIDTH + 4;
}

/** Draws only the rows inside the viewport, so cost is independent of history size. */
export function drawGraph(ctx: CanvasRenderingContext2D, o: DrawOptions): void {
  ctx.clearRect(0, 0, o.width, o.height);

  const rowY = (row: number) => (row + o.rowOffset) * ROW_HEIGHT + ROW_HEIGHT / 2 - o.scrollTop;
  const first = Math.max(0, Math.floor(o.scrollTop / ROW_HEIGHT) - o.rowOffset - 1);
  const last = Math.min(o.layout.rows.length - 1, Math.ceil((o.scrollTop + o.height) / ROW_HEIGHT));

  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  if (o.showWip) drawWip(ctx, o, rowY);

  // Edges first so nodes sit on top of them.
  for (let r = first; r <= last; r++) {
    const y1 = rowY(r);
    const y2 = rowY(r + 1);
    for (const s of o.layout.rows[r].segments) {
      const color = laneColor(s.color);
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      const x1 = laneX(s.fromLane);
      const x2 = laneX(s.toLane);
      ctx.moveTo(x1, y1);
      if (x1 === x2) {
        ctx.lineTo(x2, y2);
      } else {
        const mid = (y1 + y2) / 2;
        ctx.bezierCurveTo(x1, mid, x2, mid, x2, y2);
      }
      ctx.stroke();
    }
  }

  for (let r = Math.max(first, 0); r <= last; r++) {
    drawNode(ctx, o, r, rowY(r));
  }
  ctx.shadowBlur = 0;
}

function drawNode(ctx: CanvasRenderingContext2D, o: DrawOptions, r: number, y: number): void {
  const row = o.layout.rows[r];
  const x = laneX(row.lane);
  const color = laneColor(row.color);
  const isHead = r === o.headIndex;

  ctx.shadowColor = color;
  ctx.shadowBlur = isHead ? 16 : 10;

  if (row.isMerge) {
    // Merges are drawn smaller and solid: they join history rather than add work.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, NODE_RADIUS - 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#06060c";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isHead) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, NODE_RADIUS + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (r === o.selectedIndex) {
    ctx.shadowColor = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, NODE_RADIUS + (isHead ? 7 : 4), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
}

/** The pending-changes node: dashed, hovering above HEAD and linked to it. */
function drawWip(ctx: CanvasRenderingContext2D, o: DrawOptions, rowY: (r: number) => number): void {
  const headRow = o.headIndex >= 0 ? o.layout.rows[o.headIndex] : null;
  const x = laneX(headRow?.lane ?? 0);
  const y = ROW_HEIGHT / 2 - o.scrollTop;
  const color = headRow ? laneColor(headRow.color) : "#00f0ff";

  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  if (headRow) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, rowY(o.headIndex));
    ctx.stroke();
  }
  ctx.fillStyle = "#06060c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, NODE_RADIUS + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
