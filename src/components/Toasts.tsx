import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

type Notify = (kind: ToastKind, title: string, detail?: string) => void;

const ToastContext = createContext<Notify>(() => {});

const DURATION_MS: Record<ToastKind, number> = { success: 3500, info: 4000, error: 9000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const notify = useCallback<Notify>(
    (kind, title, detail) => {
      const id = Date.now() + Math.random();
      setToasts((all) => [...all.slice(-4), { id, kind, title, detail }]);
      window.setTimeout(() => dismiss(id), DURATION_MS[kind]);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`} onClick={() => dismiss(t.id)}>
            <div className="toast__title">
              <span className="toast__glyph">{t.kind === "error" ? "✖" : t.kind === "success" ? "✔" : "ℹ"}</span>
              {t.title}
            </div>
            {t.detail && <pre className="toast__detail">{t.detail}</pre>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Notify {
  return useContext(ToastContext);
}
