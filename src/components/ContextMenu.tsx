import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type MenuEntry =
  { label: string; hint?: string; danger?: boolean; disabled?: boolean; onSelect: () => void } | "separator";

export interface MenuState {
  x: number;
  y: number;
  title?: string;
  entries: MenuEntry[];
}

interface Props {
  menu: MenuState;
  onClose: () => void;
}

export function ContextMenu({ menu, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: menu.x, top: menu.y });

  // Keep the menu inside the window when opened near an edge.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPosition({
      left: Math.min(menu.x, window.innerWidth - width - 8),
      top: Math.min(menu.y, window.innerHeight - height - 8),
    });
  }, [menu]);

  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "mousedown" && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("blur", close);
    window.addEventListener("wheel", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("wheel", close);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="context-menu" style={position} role="menu">
      {menu.title && <div className="context-menu__title">{menu.title}</div>}
      {menu.entries.map((entry, i) =>
        entry === "separator" ? (
          <div key={i} className="context-menu__separator" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`context-menu__item${entry.danger ? " context-menu__item--danger" : ""}`}
            disabled={entry.disabled}
            onClick={() => {
              onClose();
              entry.onSelect();
            }}
          >
            <span>{entry.label}</span>
            {entry.hint && <span className="context-menu__hint">{entry.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}
