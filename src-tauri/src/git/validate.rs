//! Input checks for values that arrive from the frontend before they reach a git command line.

use std::path::{Component, Path};

use super::error::GitError;

pub fn validate_hash(hash: &str) -> Result<(), GitError> {
    let valid = (4..=64).contains(&hash.len()) && hash.chars().all(|c| c.is_ascii_hexdigit());
    if valid { Ok(()) } else { Err(GitError::invalid(format!("'{hash}' is not a commit hash"))) }
}

/// File paths must stay inside the working tree: a relative path without `..`.
/// This keeps diff commands from being pointed at arbitrary files on disk.
pub fn validate_relative_path(path: &str) -> Result<(), GitError> {
    let escapes = Path::new(path).components().any(|c| !matches!(c, Component::Normal(_) | Component::CurDir));
    if path.is_empty() || escapes {
        Err(GitError::invalid(format!("'{path}' is not a path inside the repository")))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_short_and_full_hashes() {
        assert!(validate_hash("abc1").is_ok());
        assert!(validate_hash(&"f".repeat(40)).is_ok());
    }

    #[test]
    fn rejects_non_hex_or_option_like_hashes() {
        assert!(validate_hash("--all").is_err());
        assert!(validate_hash("HEAD").is_err());
        assert!(validate_hash("abc").is_err());
    }

    #[test]
    fn accepts_nested_relative_paths() {
        assert!(validate_relative_path("src/main.rs").is_ok());
        assert!(validate_relative_path("README.md").is_ok());
    }

    #[test]
    fn rejects_paths_that_leave_the_repository() {
        assert!(validate_relative_path("../secret.txt").is_err());
        assert!(validate_relative_path("src/../../x").is_err());
        assert!(validate_relative_path("/etc/passwd").is_err());
        assert!(validate_relative_path("").is_err());
    }

    #[cfg(windows)]
    #[test]
    fn rejects_windows_absolute_paths() {
        assert!(validate_relative_path("C:\\Windows\\win.ini").is_err());
        assert!(validate_relative_path("\\\\server\\share").is_err());
    }
}
