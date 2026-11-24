import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, git, type RepoInfo } from "./api/git";
import { ToastProvider, useToast } from "./components/Toasts";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { useKeydown } from "./hooks/useKeydown";
import { Workspace } from "./components/Workspace";
import { forgetRepo, loadRecentRepos, rememberRepo } from "./utils/recentRepos";

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const notify = useToast();
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [recent, setRecent] = useState<RepoInfo[]>(loadRecentRepos);

  const openPath = useCallback(
    async (path: string) => {
      try {
        const info = await git.openRepository(path);
        setRecent(rememberRepo(info));
        setRepo(info);
      } catch (error) {
        notify("error", "Could not open repository", errorMessage(error));
      }
    },
    [notify],
  );

  const openDialog = useCallback(async () => {
    const picked = await open({ directory: true, multiple: false, title: "Open a git repository" });
    if (typeof picked === "string") await openPath(picked);
  }, [openPath]);

  // React StrictMode runs effects twice in development; the launch path must only be opened once.
  const launchHandled = useRef(false);
  useEffect(() => {
    if (launchHandled.current) return;
    launchHandled.current = true;
    git
      .launchPath()
      .then((path) => {
        if (path) void openPath(path);
      })
      .catch((error) => notify("error", "Could not read launch arguments", errorMessage(error)));
  }, [openPath, notify]);

  useKeydown((e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      void openDialog();
    }
  });

  // Dropping a folder on the window opens it — the fastest path from file explorer to graph.
  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "drop" && event.payload.paths.length > 0) void openPath(event.payload.paths[0]);
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [openPath]);

  if (!repo) {
    return (
      <WelcomeScreen
        recent={recent}
        onOpenDialog={() => void openDialog()}
        onOpenRecent={(r) => void openPath(r.root)}
        onForget={(r) => setRecent(forgetRepo(r.root))}
      />
    );
  }

  return (
    <Workspace key={repo.root} repo={repo} onOpenAnother={() => void openDialog()} onClose={() => setRepo(null)} />
  );
}
