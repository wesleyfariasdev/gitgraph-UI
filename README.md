# NeonGit

A fast, open source visual Git client with a cyberpunk look. See your history as a neon graph, branch, stage and commit without leaving the window.

Built with [Tauri 2](https://tauri.app) (Rust) and React + TypeScript.

## Features

- Commit graph for all branches, rendered on a virtualized canvas that only draws the rows on screen
- Branch, remote and tag badges; a local branch and its remote twin on the same commit collapse into one badge
- Commit inspector: message, author, parents, changed files and diffs
- Working tree: stage / unstage per file, commit with summary + description (`Ctrl+Enter`)
- Checkout branches (double-click), remote branches (creates a tracking branch) or a detached commit
- Create a branch from any commit (`B` or right-click)
- Open a repository from the dialog (`Ctrl+O`), by dropping its folder on the window, from the recent list, or from the command line: `neongit <folder>`
- Auto-refresh when the window regains focus (`F5` to refresh manually)

## Development

Requirements: Node 20+, Rust (stable), git, and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run tauri dev      # run the desktop app with hot reload
npm run tauri build    # build installers into src-tauri/target/release/bundle
```

Quality checks (the same ones CI runs):

```bash
npm run lint           # ESLint + Prettier
npm test               # frontend unit tests
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test             # parser, validation and git integration tests
```

> **Windows:** if the build fails with `msvcrt.lib` or `excpt.h` not found, your Visual Studio installation is
> missing the C++ toolset. Add the "Desktop development with C++" workload, or run the commands from the
> "Developer PowerShell" of a Visual Studio / Build Tools installation that has it.

## Architecture

```
src/                     React frontend
  api/git.ts             typed wrappers over the Rust commands
  graph/layout.ts        lane assignment algorithm for the commit graph
  graph/drawGraph.ts     canvas renderer (only draws visible rows)
  graph/refBadges.ts     groups refs into badges per commit
  hooks/                 repository data, git actions, keyboard shortcuts
  components/            UI
src-tauri/src/
  commands.rs            Tauri command layer (runs git off the UI thread)
  git/runner.rs          spawns the git CLI
  git/parse.rs           pure parsers for git's machine-readable output
  git/read.rs            queries (log, refs, status, diffs)
  git/write.rs           mutations (stage, commit, checkout, branch)
  git/validate.rs        checks frontend input before it reaches a command line
```

All git operations go through the real `git` binary, so hooks, config, credential helpers and signing behave exactly
as in your terminal.

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `refactor:`, `chore:`…).
Day-to-day work lands on `dev`; `homolog` and `main` only receive merges.

## License

[MIT](LICENSE)
