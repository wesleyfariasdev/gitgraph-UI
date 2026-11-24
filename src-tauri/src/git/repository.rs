use std::path::{Path, PathBuf};

use super::error::GitError;
use super::model::RepoInfo;
use super::runner::Git;

/// One git repository on disk.
///
/// Stateless by design: every query asks git for fresh data, so changes made
/// in a terminal or editor are never hidden behind a stale cache.
/// Queries live in `read.rs`, mutations in `write.rs`.
pub struct Repository {
    root: PathBuf,
}

impl Repository {
    /// Resolves any path inside a working tree to the repository root.
    pub fn open(path: &str) -> Result<Self, GitError> {
        let path = Path::new(path);
        if !path.is_dir() {
            return Err(GitError::invalid(format!("'{}' is not a folder", path.display())));
        }
        let root = Git::new(path)
            .run(&["rev-parse", "--show-toplevel"])
            .map_err(|_| GitError::invalid(format!("'{}' is not a git repository", path.display())))?;
        Ok(Self { root: PathBuf::from(root.trim()) })
    }

    pub(super) fn git(&self) -> Git<'_> {
        Git::new(&self.root)
    }

    pub fn info(&self) -> RepoInfo {
        let name = self
            .root
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| self.root.display().to_string());
        RepoInfo { root: self.root.display().to_string(), name }
    }
}
