use super::error::GitError;
use super::model::{Commit, CommitDetails, FileChange, HeadState, RefsSnapshot, WorkingTreeStatus};
use super::parse;
use super::repository::Repository;
use super::validate::{validate_hash, validate_relative_path};

impl Repository {
    pub fn commits(&self, limit: usize) -> Result<Vec<Commit>, GitError> {
        let max_count = format!("--max-count={limit}");
        let raw = self.git().run(&[
            "log",
            "--topo-order",
            // Stash entries are internal merge commits; drawing them would only clutter the graph.
            "--exclude=refs/stash",
            "--all",
            &max_count,
            parse::LOG_FORMAT,
        ])?;
        Ok(parse::parse_log(&raw))
    }

    pub fn refs(&self) -> Result<RefsSnapshot, GitError> {
        let raw = self.git().run(&["for-each-ref", parse::REF_FORMAT, "refs/heads", "refs/remotes", "refs/tags"])?;
        Ok(RefsSnapshot { head: self.head()?, refs: parse::parse_refs(&raw) })
    }

    pub(super) fn head(&self) -> Result<HeadState, GitError> {
        // Both commands exit 1 for the normal cases of a detached HEAD and an unborn branch.
        let branch = self.git().run_allowing(&["symbolic-ref", "-q", "--short", "HEAD"], &[0, 1])?;
        let commit = self.git().run_allowing(&["rev-parse", "-q", "--verify", "HEAD"], &[0, 1])?;
        Ok(HeadState { branch: non_empty(&branch), commit: non_empty(&commit) })
    }

    pub fn status(&self) -> Result<WorkingTreeStatus, GitError> {
        let raw = self.git().run(&["status", "--porcelain=v1", "-z", "--untracked-files=all"])?;
        Ok(parse::parse_status(&raw))
    }

    pub fn commit_details(&self, hash: &str) -> Result<CommitDetails, GitError> {
        validate_hash(hash)?;
        let raw = self.git().run(&["show", "-s", parse::DETAILS_FORMAT, hash])?;
        let mut details = parse::parse_commit_details(&raw)
            .ok_or_else(|| GitError::Internal(format!("unexpected output for commit {hash}")))?;
        details.files = self.commit_files(&details.hash, details.parents.first().map(String::as_str))?;
        Ok(details)
    }

    /// Merges are compared against their first parent, which answers
    /// "what did this merge bring in" the way most people expect.
    fn commit_files(&self, hash: &str, first_parent: Option<&str>) -> Result<Vec<FileChange>, GitError> {
        let raw = match first_parent {
            Some(parent) => self.git().run(&["diff-tree", "-r", "-M", "--name-status", "-z", parent, hash])?,
            None => self.git().run(&["diff-tree", "-r", "--root", "--no-commit-id", "--name-status", "-z", hash])?,
        };
        Ok(parse::parse_name_status(&raw))
    }

    pub fn commit_file_diff(&self, hash: &str, path: &str, old_path: Option<&str>) -> Result<String, GitError> {
        validate_hash(hash)?;
        validate_relative_path(path)?;
        old_path.map(validate_relative_path).transpose()?;

        let mut args: Vec<String> = vec!["diff-tree".into(), "-p".into(), "-M".into()];
        match self.first_parent(hash)? {
            Some(parent) => args.extend([parent, hash.to_string()]),
            None => args.extend(["--root".into(), "--no-commit-id".into(), hash.to_string()]),
        }
        args.push("--".into());
        args.extend(old_path.map(String::from));
        args.push(path.to_string());
        self.git().run(&args)
    }

    fn first_parent(&self, hash: &str) -> Result<Option<String>, GitError> {
        let raw = self.git().run(&["rev-list", "--parents", "-n", "1", hash])?;
        Ok(raw.split_whitespace().nth(1).map(String::from))
    }

    pub fn working_file_diff(
        &self,
        path: &str,
        old_path: Option<&str>,
        staged: bool,
        untracked: bool,
    ) -> Result<String, GitError> {
        validate_relative_path(path)?;
        old_path.map(validate_relative_path).transpose()?;

        if untracked {
            // `diff --no-index` exits 1 when the files differ, which is always the case here.
            // `/dev/null` is understood by git on every platform, including Windows.
            return self.git().run_allowing(&["diff", "--no-index", "--", "/dev/null", path], &[0, 1]);
        }

        let mut args: Vec<&str> = vec!["diff", "-M"];
        if staged {
            args.push("--cached");
        }
        args.push("--");
        args.extend(old_path);
        args.push(path);
        self.git().run(&args)
    }
}

fn non_empty(s: &str) -> Option<String> {
    let s = s.trim();
    (!s.is_empty()).then(|| s.to_string())
}
