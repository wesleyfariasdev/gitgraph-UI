import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Subscribes to window keydown for the lifetime of the component.
 * The latest handler is always used, so callers don't need to memoize it.
 */
export function useKeydown(handler: (event: KeyboardEvent) => void, enabled = true): void {
  const handlerRef = useRef(handler);
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => handlerRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [enabled]);
}

/** True while the user is typing in a text field, where single-key shortcuts must not fire. */
export function isTyping(event: KeyboardEvent): boolean {
  return (event.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]") != null;
}
