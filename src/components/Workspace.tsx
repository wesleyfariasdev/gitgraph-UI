import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import type { Commit, GitRef, RepoInfo } from "../api/git";
import { layoutGraph } from "../graph/layout";
import { buildRefBadges, type RefBadge } from "../graph/refBadges";
import { useGitActions } from "../hooks/useGitActions";
import { isTyping, useKeydown } from "../hooks/useKeydown";
import { useRepository } from "../hooks/useRepository";
import type { DiffRequest, Selection } from "../types";
import { CommitDetailsPanel } from "./CommitDetailsPanel";
import { CommitGraph, type ScrollRequest } from "./CommitGraph";
import { ContextMenu, type MenuState } from "./ContextMenu";
import { CreateBranchDialog } from "./CreateBranchDialog";
import { DiffViewer } from "./DiffViewer";
import { buildCommitMenu, buildRefMenu, commitMenuTitle } from "./menus";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { useToast } from "./Toasts";
import { TopBar } from "./TopBar";
import { WorkingTreePanel } from "./WorkingTreePanel";

interface Props {
  repo: RepoInfo;
  onOpenAnother: () => void;
  onClose: () => void;
}

export function Workspace({ repo, onOpenAnother, onClose }: Props) {
  const notify = useToast();
  const onError = useCallback((title: string, detail: string) => notify("error", title, detail), [notify]);
  const { commits, refs, head, status, busy, loaded, run, refresh } = useRepository(repo.root, onError);
  const actions = useGitActions({ root: repo.root, refs, head, run, notify });

  const [selection, setSelection] = useState<Selection | null>(null);
  const [diff, setDiff] = useState<DiffRequest | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [branchDialog, setBranchDialog] = useState<Commit | null>(null);
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null);

  const layout = useMemo(() => layoutGraph(commits), [commits]);
  const badges = useMemo(() => buildRefBadges(refs, head), [refs, head]);
  const pendingCount = status.staged.length + status.unstaged.length + status.conflicted.length;
  const headRef = refs.find((r) => r.kind === "localBranch" && r.name === head.branch);

  useInitialSelection({ loaded, pendingCount, headCommit: head.commit, selection, setSelection });

  const select = useCallback((next: Selection) => {
    setSelection(next);
    setDiff(null);
  }, []);

  const locate = useCallback(
    (hash: string) => {
      select({ kind: "commit", hash });
      setScrollRequest({ hash, nonce: Date.now() });
    },
    [select],
  );

  const copy = useCallback(
    (text: string, what: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => notify("success", `${what} copied`, text.length > 60 ? undefined : text))
        .catch((error) => notify("error", "Clipboard unavailable", String(error)));
    },
    [notify],
  );

  const checkoutRef = (ref: GitRef) => (ref.kind === "tag" ? locate(ref.target) : void actions.checkoutRef(ref));

  const menuHandlers = { actions, head, copy, locate, openCreateBranch: setBranchDialog };

  const openCommitMenu = (event: MouseEvent, commit: Commit) =>
    setMenu({
      x: event.clientX,
      y: event.clientY,
      title: commitMenuTitle(commit),
      entries: buildCommitMenu(commit, badges.get(commit.hash) ?? [], menuHandlers),
    });

  const openRefMenu = (event: MouseEvent, ref: GitRef) =>
    setMenu({ x: event.clientX, y: event.clientY, title: ref.name, entries: buildRefMenu(ref, menuHandlers) });

  const openBadgeMenu = (event: MouseEvent, badge: RefBadge) => badge.ref && openRefMenu(event, badge.ref);

  const createBranch = (name: string, checkout: boolean) => {
    if (!branchDialog) return;
    setBranchDialog(null);
    void actions.createBranch(name, branchDialog.hash, checkout);
  };

  const commit = async (message: string) => {
    const ok = await actions.commit(message);
    if (ok) setDiff(null);
    return ok;
  };

  useKeydown((event) => {
    // F5 / Ctrl+R would reload the webview and lose all state; refresh git data instead.
    if (event.key === "F5" || (event.ctrlKey && event.key.toLowerCase() === "r")) {
      event.preventDefault();
      void refresh();
      return;
    }
    if (isTyping(event) || event.ctrlKey || event.metaKey || event.altKey || branchDialog) return;
    if (event.key.toLowerCase() === "b" && selection?.kind === "commit") {
      const target = commits.find((c) => c.hash === selection.hash);
      if (!target) return;
      // Without this, the same keystroke would land in the dialog's freshly focused input.
      event.preventDefault();
      setBranchDialog(target);
    }
  });

  const closeDiff = useCallback(() => setDiff(null), []);
  const activePath = diff?.file.path ?? null;
  const hasHistory = commits.length > 0 || pendingCount > 0;

  return (
    <div className="workspace">
      <TopBar
        repo={repo}
        head={head}
        headRef={headRef}
        busy={busy}
        onRefresh={() => void refresh()}
        onOpenAnother={onOpenAnother}
        onClose={onClose}
      />

      <Sidebar
        refs={refs}
        head={head}
        onLocate={(r) => locate(r.target)}
        onCheckout={checkoutRef}
        onMenu={openRefMenu}
      />

      <main className="main">
        {!loaded && <div className="panel-message">Reading repository…</div>}
        {loaded && !hasHistory && (
          <div className="panel-message">This repository has no commits yet. Create a file to get started.</div>
        )}
        {loaded && hasHistory && (
          <CommitGraph
            commits={commits}
            layout={layout}
            badges={badges}
            headCommit={head.commit}
            wipCount={pendingCount}
            selection={selection}
            scrollRequest={scrollRequest}
            onSelect={select}
            onCommitMenu={openCommitMenu}
            onBadgeMenu={openBadgeMenu}
            onBadgeActivate={(badge) => badge.ref && checkoutRef(badge.ref)}
          />
        )}
        {diff && (
          <div className="main__overlay">
            <DiffViewer root={repo.root} request={diff} onClose={closeDiff} />
          </div>
        )}
      </main>

      <aside className="inspector">
        {selection?.kind === "wip" && (
          <WorkingTreePanel
            status={status}
            branch={head.branch}
            busy={busy}
            activePath={activePath}
            onOpenFile={(file, staged) => setDiff({ source: "working", file, staged })}
            onStage={(paths) => void actions.stage(paths)}
            onUnstage={(paths) => void actions.unstage(paths)}
            onCommit={commit}
          />
        )}
        {selection?.kind === "commit" && (
          <CommitDetailsPanel
            root={repo.root}
            hash={selection.hash}
            badges={badges.get(selection.hash)}
            activePath={activePath}
            onOpenFile={(file) => setDiff({ source: "commit", hash: selection.hash, file })}
            onJumpTo={locate}
            onCopy={copy}
          />
        )}
        {!selection && <div className="panel-message">Select a commit to inspect it.</div>}
      </aside>

      <StatusBar branch={head.branch} commitCount={commits.length} pendingCount={pendingCount} />

      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {branchDialog && (
        <CreateBranchDialog startPoint={branchDialog} onSubmit={createBranch} onCancel={() => setBranchDialog(null)} />
      )}
    </div>
  );
}

interface InitialSelectionArgs {
  loaded: boolean;
  pendingCount: number;
  headCommit: string | null;
  selection: Selection | null;
  setSelection: (selection: Selection) => void;
}

/**
 * Starts where the user most likely wants to be — their pending changes, or else the current
 * commit — and moves to the new HEAD when committing empties the working tree.
 */
function useInitialSelection({ loaded, pendingCount, headCommit, selection, setSelection }: InitialSelectionArgs) {
  useEffect(() => {
    if (!loaded) return;
    const wipGone = selection?.kind === "wip" && pendingCount === 0;
    if (selection && !wipGone) return;
    if (pendingCount > 0) setSelection({ kind: "wip" });
    else if (headCommit) setSelection({ kind: "commit", hash: headCommit });
  }, [loaded, pendingCount, headCommit, selection, setSelection]);
}
