import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import type { GitRef, HeadState } from "../api/git";
import { TrackingCounts } from "./TrackingCounts";

interface Props {
  refs: GitRef[];
  head: HeadState;
  onLocate: (ref: GitRef) => void;
  onCheckout: (ref: GitRef) => void;
  onMenu: (event: MouseEvent, ref: GitRef) => void;
}

export function Sidebar({ refs, head, onLocate, onCheckout, onMenu }: Props) {
  const [filter, setFilter] = useState("");

  const groups = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const matches = refs.filter((r) => !query || r.name.toLowerCase().includes(query));
    const remotes = new Map<string, GitRef[]>();
    for (const ref of matches.filter((r) => r.kind === "remoteBranch")) {
      const remote = ref.name.split("/")[0];
      remotes.set(remote, [...(remotes.get(remote) ?? []), ref]);
    }
    return {
      local: matches.filter((r) => r.kind === "localBranch"),
      remotes: [...remotes.entries()],
      tags: matches.filter((r) => r.kind === "tag").reverse(),
    };
  }, [refs, filter]);

  const item = (ref: GitRef, label: string, glyph: string) => {
    const isHead = ref.kind === "localBranch" && ref.name === head.branch;
    return (
      <li
        key={ref.fullName}
        className={`sidebar__item${isHead ? " is-head" : ""}`}
        title={`${ref.name}\nClick to locate · double-click to check out`}
        onClick={() => onLocate(ref)}
        onDoubleClick={() => onCheckout(ref)}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu(e, ref);
        }}
      >
        <span className="sidebar__glyph">{isHead ? "▶" : glyph}</span>
        <span className="sidebar__name">{label}</span>
        <TrackingCounts gitRef={ref} />
      </li>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__search">
        <input
          className="input"
          placeholder="Filter branches & tags…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          spellCheck={false}
        />
      </div>
      <div className="sidebar__scroll">
        <Section title="Local" count={groups.local.length} accent="cyan">
          {groups.local.map((r) => item(r, r.name, "◆"))}
        </Section>
        {groups.remotes.map(([remote, list]) => (
          <Section key={remote} title={`Remote · ${remote}`} count={list.length} accent="purple">
            {list.map((r) => item(r, r.name.slice(remote.length + 1), "☁"))}
          </Section>
        ))}
        <Section title="Tags" count={groups.tags.length} accent="yellow" collapsedByDefault>
          {groups.tags.map((r) => item(r, r.name, "◈"))}
        </Section>
      </div>
    </aside>
  );
}

function Section(props: {
  title: string;
  count: number;
  accent: string;
  collapsedByDefault?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!props.collapsedByDefault);
  return (
    <section className={`sidebar__section accent-${props.accent}`}>
      <button className="sidebar__section-header" onClick={() => setOpen(!open)}>
        <span className="sidebar__chevron">{open ? "▾" : "▸"}</span>
        <span className="label">{props.title}</span>
        <span className="sidebar__count">{props.count}</span>
      </button>
      {open &&
        (props.count > 0 ? (
          <ul className="sidebar__list">{props.children}</ul>
        ) : (
          <div className="sidebar__empty">none</div>
        ))}
    </section>
  );
}
