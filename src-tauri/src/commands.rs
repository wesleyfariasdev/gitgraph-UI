//! Tauri command layer: thin async wrappers that run git work off the UI thread.

use crate::git::error::GitError;
use crate::git::model::{Commit, CommitDetails, RefsSnapshot, RepoInfo, WorkingTreeStatus};
use crate::git::repository::Repository;

const DEFAULT_COMMIT_LIMIT: usize = 10_000;

/// Git calls are blocking process spawns; running them on the blocking pool keeps the window responsive.
async fn with_repo<T, F>(repo: String, work: F) -> Result<T, GitError>
where
    T: Send + 'static,
    F: FnOnce(Repository) -> Result<T, GitError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || work(Repository::open(&repo)?))
        .await
        .map_err(|e| GitError::Internal(e.to_string()))?
}

#[tauri::command]
pub async fn open_repository(path: String) -> Result<RepoInfo, GitError> {
    with_repo(path, |r| Ok(r.info())).await
}

#[tauri::command]
pub async fn load_commits(repo: String, limit: Option<usize>) -> Result<Vec<Commit>, GitError> {
    with_repo(repo, move |r| r.commits(limit.unwrap_or(DEFAULT_COMMIT_LIMIT))).await
}

#[tauri::command]
pub async fn load_refs(repo: String) -> Result<RefsSnapshot, GitError> {
    with_repo(repo, |r| r.refs()).await
}

#[tauri::command]
pub async fn load_status(repo: String) -> Result<WorkingTreeStatus, GitError> {
    with_repo(repo, |r| r.status()).await
}

#[tauri::command]
pub async fn load_commit_details(repo: String, hash: String) -> Result<CommitDetails, GitError> {
    with_repo(repo, move |r| r.commit_details(&hash)).await
}

#[tauri::command]
pub async fn load_commit_file_diff(
    repo: String,
    hash: String,
    path: String,
    old_path: Option<String>,
) -> Result<String, GitError> {
    with_repo(repo, move |r| r.commit_file_diff(&hash, &path, old_path.as_deref())).await
}

#[tauri::command]
pub async fn load_working_file_diff(
    repo: String,
    path: String,
    old_path: Option<String>,
    staged: bool,
    untracked: bool,
) -> Result<String, GitError> {
    with_repo(repo, move |r| r.working_file_diff(&path, old_path.as_deref(), staged, untracked)).await
}

#[tauri::command]
pub async fn stage_files(repo: String, paths: Vec<String>) -> Result<(), GitError> {
    with_repo(repo, move |r| r.stage(&paths)).await
}

#[tauri::command]
pub async fn unstage_files(repo: String, paths: Vec<String>) -> Result<(), GitError> {
    with_repo(repo, move |r| r.unstage(&paths)).await
}

#[tauri::command]
pub async fn create_commit(repo: String, message: String) -> Result<String, GitError> {
    with_repo(repo, move |r| r.commit(&message)).await
}

#[tauri::command]
pub async fn checkout_branch(repo: String, name: String) -> Result<(), GitError> {
    with_repo(repo, move |r| r.checkout_branch(&name)).await
}

#[tauri::command]
pub async fn checkout_remote_branch(repo: String, name: String) -> Result<(), GitError> {
    with_repo(repo, move |r| r.checkout_remote_branch(&name)).await
}

#[tauri::command]
pub async fn checkout_commit(repo: String, hash: String) -> Result<(), GitError> {
    with_repo(repo, move |r| r.checkout_commit(&hash)).await
}

#[tauri::command]
pub async fn create_branch(repo: String, name: String, start_point: String, checkout: bool) -> Result<(), GitError> {
    with_repo(repo, move |r| r.create_branch(&name, &start_point, checkout)).await
}

/// Path passed on the command line (`neongit <folder>`), so the app can be launched like `code .`.
#[tauri::command]
pub fn launch_path() -> Option<String> {
    std::env::args().nth(1).filter(|arg| !arg.starts_with('-'))
}
