use super::error::GitError;
use super::repository::Repository;
use super::validate::{validate_hash, validate_relative_path};

impl Repository {
    pub fn stage(&self, paths: &[String]) -> Result<(), GitError> {
        if paths.is_empty() {
            return Ok(());
        }
        paths.iter().try_for_each(|p| validate_relative_path(p))?;
        // `-A` so that deleted files are staged as deletions too.
        let mut args = vec!["add", "-A", "--"];
        args.extend(paths.iter().map(String::as_str));
        self.git().run(&args).map(drop)
    }

    pub fn unstage(&self, paths: &[String]) -> Result<(), GitError> {
        if paths.is_empty() {
            return Ok(());
        }
        paths.iter().try_for_each(|p| validate_relative_path(p))?;
        // Before the first commit there is no HEAD to restore from; removing from the index is the equivalent.
        let mut args = if self.head()?.commit.is_some() {
            vec!["restore", "--staged", "--"]
        } else {
            vec!["rm", "--cached", "-r", "-q", "--"]
        };
        args.extend(paths.iter().map(String::as_str));
        self.git().run(&args).map(drop)
    }

    /// Returns the hash of the new commit.
    pub fn commit(&self, message: &str) -> Result<String, GitError> {
        if message.trim().is_empty() {
            return Err(GitError::invalid("commit message cannot be empty"));
        }
        self.git().run(&["commit", "-m", message])?;
        let hash = self.git().run(&["rev-parse", "HEAD"])?;
        Ok(hash.trim().to_string())
    }

    pub fn checkout_branch(&self, name: &str) -> Result<(), GitError> {
        self.validate_branch_name(name)?;
        self.git().run(&["switch", "--end-of-options", name]).map(drop)
    }

    /// Creates a local branch tracking `remote_branch` (e.g. `origin/feature`) and switches to it.
    pub fn checkout_remote_branch(&self, remote_branch: &str) -> Result<(), GitError> {
        self.validate_branch_name(remote_branch)?;
        self.git().run(&["switch", "--track", "--end-of-options", remote_branch]).map(drop)
    }

    pub fn checkout_commit(&self, hash: &str) -> Result<(), GitError> {
        validate_hash(hash)?;
        self.git().run(&["switch", "--detach", hash]).map(drop)
    }

    pub fn create_branch(&self, name: &str, start_point: &str, checkout: bool) -> Result<(), GitError> {
        self.validate_branch_name(name)?;
        validate_hash(start_point)?;
        let args = if checkout { ["switch", "-c", name, start_point] } else { ["branch", "--", name, start_point] };
        self.git().run(&args).map(drop)
    }

    /// Delegates to `git check-ref-format`, the single source of truth for what a ref name may contain.
    fn validate_branch_name(&self, name: &str) -> Result<(), GitError> {
        let full = format!("refs/heads/{name}");
        let valid = !name.starts_with('-') && self.git().run(&["check-ref-format", &full]).is_ok();
        if valid { Ok(()) } else { Err(GitError::invalid(format!("'{name}' is not a valid branch name"))) }
    }
}
