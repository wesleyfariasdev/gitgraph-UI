import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { Commit } from "../api/git";
import { laneColor } from "../graph/colors";
import { drawGraph, graphWidth, ROW_HEIGHT } from "../graph/drawGraph";
import type { GraphLayout } from "../graph/layout";
import type { RefBadge } from "../graph/refBadges";
import type { Selection } from "../types";
import { fullDate, shortHash, timeAgo } from "../utils/format";

const OVERSCAN = 8;
const MAX_GRAPH_LANES = 24;
const MAX_BADGES = 3;

export interface ScrollRequest {
  hash: string;
  nonce: number;
}

interface Props {
  commits: Commit[];
  layout: GraphLayout;
  badges: Map<string, RefBadge[]>;
  headCommit: string | null;
  wipCount: number;
  selection: Selection | null;
  scrollRequest: ScrollRequest | null;
  onSelect: (selection: Selection) => void;
  onCommitMenu: (event: MouseEvent, commit: Commit) => void;
  onBadgeMenu: (event: MouseEvent, badge: RefBadge) => void;
  onBadgeActivate: (badge: RefBadge) => void;
}

export function CommitGraph(props: Props) {
  const { commits, layout, badges, headCommit, wipCount, selection } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const showWip = wipCount > 0;
  const rowOffset = showWip ? 1 : 0;
  const totalRows = commits.length + rowOffset;
  const width = graphWidth(Math.min(layout.laneCount, MAX_GRAPH_LANES));

  const indexByHash = useMemo(() => new Map(commits.map((c, i) => [c.hash, i])), [commits]);
  const headIndex = headCommit ? (indexByHash.get(headCommit) ?? -1) : -1;
  const selectedIndex = selection?.kind === "commit" ? (indexByHash.get(selection.hash) ?? -1) : -1;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    observer.observe(el);
    setViewportHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(viewportHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGraph(ctx, { layout, rowOffset, scrollTop, width, height: viewportHeight, headIndex, selectedIndex, showWip });
  }, [layout, rowOffset, scrollTop, width, viewportHeight, headIndex, selectedIndex, showWip]);

  // Bring a commit into view when something outside (sidebar, parent link) asks for it.
  useEffect(() => {
    const request = props.scrollRequest;
    const el = scrollRef.current;
    if (!request || !el) return;
    const index = indexByHash.get(request.hash);
    if (index === undefined) return;
    const target = (index + rowOffset) * ROW_HEIGHT - el.clientHeight / 2 + ROW_HEIGHT / 2;
    el.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [props.scrollRequest, indexByHash, rowOffset]);

  const ensureVisible = (row: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const top = row * ROW_HEIGHT;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_HEIGHT - el.clientHeight;
  };

  const selectRow = (row: number) => {
    if (row < 0 || row >= totalRows) return;
    if (showWip && row === 0) props.onSelect({ kind: "wip" });
    else props.onSelect({ kind: "commit", hash: commits[row - rowOffset].hash });
    ensureVisible(row);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const current = selection?.kind === "wip" ? 0 : selectedIndex + rowOffset;
    const page = Math.floor(viewportHeight / ROW_HEIGHT) - 1;
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: page, PageUp: -page };
    if (e.key in moves) {
      e.preventDefault();
      selectRow(Math.min(Math.max(current + moves[e.key], 0), totalRows - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      selectRow(0);
    } else if (e.key === "End") {
      e.preventDefault();
      selectRow(totalRows - 1);
    }
  };

  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const lastRow = Math.min(totalRows - 1, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visible: number[] = [];
  for (let row = firstRow; row <= lastRow; row++) visible.push(row);

  return (
    <div className="graph">
      <div className="graph__header">
        <div style={{ width }} className="label">
          Graph
        </div>
        <div className="col-message label">Description</div>
        <div className="col-author label">Author</div>
        <div className="col-date label">Date</div>
        <div className="col-hash label">SHA</div>
      </div>

      <div
        ref={scrollRef}
        className="graph__scroll"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div className="graph__content" style={{ height: totalRows * ROW_HEIGHT }}>
          <canvas ref={canvasRef} className="graph__canvas" style={{ width, height: viewportHeight }} />
          {visible.map((row) => {
            if (showWip && row === 0) {
              return (
                <WipRow
                  key="wip"
                  width={width}
                  count={wipCount}
                  selected={selection?.kind === "wip"}
                  onClick={() => selectRow(0)}
                />
              );
            }
            const index = row - rowOffset;
            const commit = commits[index];
            return (
              <CommitRow
                key={commit.hash}
                row={row}
                width={width}
                commit={commit}
                color={laneColor(layout.rows[index].color)}
                badges={badges.get(commit.hash)}
                selected={index === selectedIndex}
                isHead={index === headIndex}
                onClick={() => selectRow(row)}
                onContextMenu={(e) => {
                  selectRow(row);
                  props.onCommitMenu(e, commit);
                }}
                onBadgeMenu={props.onBadgeMenu}
                onBadgeActivate={props.onBadgeActivate}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WipRow(props: { width: number; count: number; selected: boolean; onClick: () => void }) {
  return (
    <div
      className={`graph-row graph-row--wip${props.selected ? " is-selected" : ""}`}
      style={{ top: 0, height: ROW_HEIGHT }}
      onClick={props.onClick}
    >
      <div style={{ width: props.width, flexShrink: 0 }} />
      <div className="col-message">
        <span className="wip-tag">WIP</span>
        <span className="wip-text">
          {props.count} uncommitted change{props.count === 1 ? "" : "s"} — click to review and commit
        </span>
      </div>
    </div>
  );
}

interface CommitRowProps {
  row: number;
  width: number;
  commit: Commit;
  color: string;
  badges: RefBadge[] | undefined;
  selected: boolean;
  isHead: boolean;
  onClick: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onBadgeMenu: (e: MouseEvent, badge: RefBadge) => void;
  onBadgeActivate: (badge: RefBadge) => void;
}

function CommitRow(p: CommitRowProps) {
  const shown = p.badges?.slice(0, MAX_BADGES) ?? [];
  const hidden = p.badges?.slice(MAX_BADGES) ?? [];

  return (
    <div
      className={`graph-row${p.selected ? " is-selected" : ""}${p.isHead ? " is-head" : ""}`}
      style={{ top: p.row * ROW_HEIGHT, height: ROW_HEIGHT, ["--row-color" as string]: p.color }}
      onClick={p.onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        p.onContextMenu(e);
      }}
    >
      <div style={{ width: p.width, flexShrink: 0 }} />
      <div className="col-message">
        {shown.map((badge) => (
          <Badge key={badge.key} badge={badge} color={p.color} onMenu={p.onBadgeMenu} onActivate={p.onBadgeActivate} />
        ))}
        {hidden.length > 0 && (
          <span className="badge badge--more" title={hidden.map((b) => b.label).join("\n")}>
            +{hidden.length}
          </span>
        )}
        <span className="subject" title={p.commit.subject}>
          {p.commit.subject}
        </span>
      </div>
      <div className="col-author" title={p.commit.authorEmail}>
        {p.commit.authorName}
      </div>
      <div className="col-date" title={fullDate(p.commit.timestamp)}>
        {timeAgo(p.commit.timestamp)}
      </div>
      <div className="col-hash mono">{shortHash(p.commit.hash)}</div>
    </div>
  );
}

const BADGE_GLYPH: Record<RefBadge["kind"], string> = { local: "", remote: "☁ ", tag: "◈ ", detached: "⌖ " };

function Badge(props: {
  badge: RefBadge;
  color: string;
  onMenu: (e: MouseEvent, badge: RefBadge) => void;
  onActivate: (badge: RefBadge) => void;
}) {
  const { badge } = props;
  const canCheckout = badge.kind === "local" || badge.kind === "remote";
  const synced = badge.syncedRemotes.length > 0;
  const title = [
    badge.label,
    badge.isHead ? "(current branch)" : "",
    synced ? `in sync with ${badge.syncedRemotes.join(", ")}` : "",
    canCheckout && !badge.isHead ? "Double-click to check out" : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <span
      className={`badge badge--${badge.kind}${badge.isHead ? " badge--head" : ""}`}
      style={{ ["--badge-color" as string]: props.color }}
      title={title}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (canCheckout) props.onActivate(badge);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onMenu(e, badge);
      }}
    >
      {badge.isHead && badge.kind === "local" && <span className="badge__head">▶</span>}
      {BADGE_GLYPH[badge.kind]}
      {badge.label}
      {synced && <span className="badge__sync">☁</span>}
    </span>
  );
}
