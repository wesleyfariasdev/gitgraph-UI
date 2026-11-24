use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum GitError {
    #[error("could not start git: {0}. Is git installed and on PATH?")]
    Spawn(String),

    #[error("{message}")]
    CommandFailed { command: String, message: String },

    #[error("{0}")]
    InvalidInput(String),

    #[error("internal error: {0}")]
    Internal(String),
}

impl GitError {
    pub fn invalid(message: impl Into<String>) -> Self {
        GitError::InvalidInput(message.into())
    }
}

// Tauri sends command errors to the frontend as JSON; a plain message string is all the UI needs.
impl Serialize for GitError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
