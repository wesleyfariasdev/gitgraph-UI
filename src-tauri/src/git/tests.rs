//! Integration tests: run every repository operation against a real git binary in a temp folder.

use std::fs;
use std::path::Path;
use std::process::Command;

use tempfile::TempDir;

use super::model::{ChangeKind, RefKind};
use super::repository::Repository;

struct Sandbox {
    dir: TempDir,
}

impl Sandbox {
    fn new() -> Self {
        let sandbox = Self { dir: TempDir::new().expect("temp dir") };
        sandbox.git(&["init", "-q", "-b", "main"]);
        sandbox.git(&["config", "user.name", "Test"]);
        sandbox.git(&["config", "user.email", "test@example.com"]);
        sandbox.git(&["config", "commit.gpgsign", "false"]);
        sandbox
    }

    fn path(&self) -> &Path {
        self.dir.path()
    }

    fn git(&self, args: &[&str]) -> String {
        let output = Command::new("git").arg("-C").arg(self.path()).args(args).output().expect("git");
        assert!(output.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&output.stderr));
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    fn write(&self, file: &str, content: &str) {
        fs::write(self.path().join(file), content).expect("write file");
    }

    fn commit_file(&self, file: &str, content: &str, message: &str) -> String {
        self.write(file, content);
        self.git(&["add", file]);
        self.git(&["commit", "-q", "-m", message]);
        self.git(&["rev-parse", "HEAD"])
    }

    fn repo(&self) -> Repository {
        Repository::open(self.path().to_str().expect("utf-8 path")).expect("open repo")
    }
}

#[test]
fn open_rejects_a_folder_that_is_not_a_repository() {
    let dir = TempDir::new().expect("temp dir");

    let result = Repository::open(dir.path().to_str().unwrap());

    assert!(result.is_err());
}

#[test]
fn empty_repository_has_no_commits_and_an_unborn_head() {
    let sandbox = Sandbox::new();
    let repo = sandbox.repo();

    let commits = repo.commits(100).unwrap();
    let refs = repo.refs().unwrap();

    assert!(commits.is_empty());
    assert_eq!(refs.head.branch.as_deref(), Some("main"));
    assert!(refs.head.commit.is_none());
}

#[test]
fn commits_include_every_branch_in_topological_order() {
    let sandbox = Sandbox::new();
    let base = sandbox.commit_file("a.txt", "1", "base");
    sandbox.git(&["switch", "-q", "-c", "feature"]);
    sandbox.commit_file("b.txt", "1", "feature work");
    sandbox.git(&["switch", "-q", "main"]);
    sandbox.commit_file("a.txt", "2", "main work");

    let commits = sandbox.repo().commits(100).unwrap();

    assert_eq!(commits.len(), 3);
    assert_eq!(commits.last().unwrap().hash, base);
}

#[test]
fn stage_unstage_and_commit_round_trip() {
    let sandbox = Sandbox::new();
    sandbox.commit_file("a.txt", "1", "base");
    sandbox.write("a.txt", "2");
    sandbox.write("new.txt", "fresh");
    let repo = sandbox.repo();

    let before = repo.status().unwrap();
    repo.stage(&["a.txt".into(), "new.txt".into()]).unwrap();
    let staged = repo.status().unwrap();
    repo.unstage(&["new.txt".into()]).unwrap();
    let hash = repo.commit("update a").unwrap();
    let after = repo.status().unwrap();

    assert_eq!(before.unstaged.len(), 2);
    assert_eq!(staged.staged.len(), 2);
    assert_eq!(after.staged.len(), 0);
    assert_eq!(after.unstaged[0].kind, ChangeKind::Untracked);
    assert_eq!(repo.refs().unwrap().head.commit.as_deref(), Some(hash.as_str()));
}

#[test]
fn unstage_works_before_the_first_commit() {
    let sandbox = Sandbox::new();
    sandbox.write("a.txt", "1");
    let repo = sandbox.repo();
    repo.stage(&["a.txt".into()]).unwrap();

    repo.unstage(&["a.txt".into()]).unwrap();

    assert!(repo.status().unwrap().staged.is_empty());
}

#[test]
fn commit_rejects_an_empty_message() {
    let sandbox = Sandbox::new();

    assert!(sandbox.repo().commit("   ").is_err());
}

#[test]
fn commit_details_lists_files_and_diffs_against_first_parent() {
    let sandbox = Sandbox::new();
    sandbox.commit_file("a.txt", "one\n", "base");
    let hash = sandbox.commit_file("a.txt", "two\n", "change a\n\nwith a body");
    let repo = sandbox.repo();

    let details = repo.commit_details(&hash).unwrap();
    let diff = repo.commit_file_diff(&hash, "a.txt", None).unwrap();

    assert_eq!(details.message, "change a\n\nwith a body");
    assert_eq!(details.files.len(), 1);
    assert_eq!(details.files[0].kind, ChangeKind::Modified);
    assert!(diff.contains("-one") && diff.contains("+two"));
}

#[test]
fn root_commit_diff_shows_the_whole_file_as_added() {
    let sandbox = Sandbox::new();
    let root = sandbox.commit_file("a.txt", "hello\n", "root");

    let diff = sandbox.repo().commit_file_diff(&root, "a.txt", None).unwrap();

    assert!(diff.contains("+hello"));
}

#[test]
fn working_diff_covers_untracked_files() {
    let sandbox = Sandbox::new();
    sandbox.commit_file("a.txt", "1", "base");
    sandbox.write("new.txt", "brand new\n");

    let diff = sandbox.repo().working_file_diff("new.txt", None, false, true).unwrap();

    assert!(diff.contains("+brand new"));
}

#[test]
fn diffs_refuse_paths_outside_the_repository() {
    let sandbox = Sandbox::new();
    sandbox.commit_file("a.txt", "1", "base");

    let result = sandbox.repo().working_file_diff("../outside.txt", None, false, true);

    assert!(result.is_err());
}

#[test]
fn create_and_checkout_branches() {
    let sandbox = Sandbox::new();
    let first = sandbox.commit_file("a.txt", "1", "first");
    sandbox.commit_file("a.txt", "2", "second");
    let repo = sandbox.repo();

    repo.create_branch("feature/x", &first, false).unwrap();
    repo.checkout_branch("feature/x").unwrap();
    let on_feature = repo.refs().unwrap();
    repo.checkout_commit(&first).unwrap();
    let detached = repo.refs().unwrap();

    assert_eq!(on_feature.head.branch.as_deref(), Some("feature/x"));
    assert_eq!(on_feature.head.commit.as_deref(), Some(first.as_str()));
    assert!(on_feature.refs.iter().any(|r| r.kind == RefKind::LocalBranch && r.name == "feature/x"));
    assert!(detached.head.branch.is_none());
}

#[test]
fn branch_names_are_validated_by_git_rules() {
    let sandbox = Sandbox::new();
    let hash = sandbox.commit_file("a.txt", "1", "first");
    let repo = sandbox.repo();

    assert!(repo.create_branch("bad name", &hash, false).is_err());
    assert!(repo.create_branch("--force", &hash, false).is_err());
    assert!(repo.create_branch("ends.lock", &hash, false).is_err());
}

#[test]
fn checkout_remote_branch_creates_a_tracking_branch() {
    let remote = Sandbox::new();
    remote.commit_file("a.txt", "1", "base");
    remote.git(&["branch", "shared"]);
    let local = Sandbox::new();
    local.git(&["remote", "add", "origin", remote.path().to_str().unwrap()]);
    local.git(&["fetch", "-q", "origin"]);
    let repo = local.repo();

    repo.checkout_remote_branch("origin/shared").unwrap();
    let refs = repo.refs().unwrap();

    let shared = refs.refs.iter().find(|r| r.name == "shared").expect("local branch");
    assert_eq!(refs.head.branch.as_deref(), Some("shared"));
    assert_eq!(shared.upstream.as_deref(), Some("origin/shared"));
}
