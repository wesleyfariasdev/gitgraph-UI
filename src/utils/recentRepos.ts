import type { RepoInfo } from "../api/git";

const STORAGE_KEY = "gitgraph.recentRepos";
const MAX_RECENT = 8;

export function loadRecentRepos(): RepoInfo[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Ignoring corrupted recent repositories list", error);
    return [];
  }
}

export function rememberRepo(repo: RepoInfo): RepoInfo[] {
  const list = [repo, ...loadRecentRepos().filter((r) => r.root !== repo.root)].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function forgetRepo(root: string): RepoInfo[] {
  const list = loadRecentRepos().filter((r) => r.root !== root);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}
