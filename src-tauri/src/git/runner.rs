use std::path::Path;
use std::process::Command;

use super::error::GitError;

/// Runs the git CLI against one repository.
///
/// Every operation goes through the real `git` binary so that hooks, config,
/// credential helpers and signing behave exactly as they do in the terminal.
pub struct Git<'a> {
    repo: &'a Path,
}

impl<'a> Git<'a> {
    pub fn new(repo: &'a Path) -> Self {
        Self { repo }
    }

    pub fn run<S: AsRef<str>>(&self, args: &[S]) -> Result<String, GitError> {
        self.run_allowing(args, &[0])
    }

    /// Some git commands report a normal outcome through a non-zero exit code
    /// (e.g. `diff --no-index` exits 1 when the files differ).
    pub fn run_allowing<S: AsRef<str>>(&self, args: &[S], ok_codes: &[i32]) -> Result<String, GitError> {
        let args: Vec<&str> = args.iter().map(AsRef::as_ref).collect();
        let output = self.command(&args).output().map_err(|e| GitError::Spawn(e.to_string()))?;

        let code = output.status.code().unwrap_or(-1);
        if ok_codes.contains(&code) {
            return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let message =
            if stderr.is_empty() { String::from_utf8_lossy(&output.stdout).trim().to_string() } else { stderr };
        let command = format!("git {}", args.join(" "));
        // The UI only shows git's message; the full command line goes to the log for diagnosis.
        eprintln!("[gitgraph] `{command}` exited with {code}: {message}");
        Err(GitError::CommandFailed { command, message })
    }

    fn command(&self, args: &[&str]) -> Command {
        let mut cmd = Command::new("git");
        cmd.arg("-C")
            .arg(self.repo)
            .args(["-c", "core.quotepath=false", "-c", "color.ui=false"])
            .args(args)
            // Never block waiting for a password prompt that has no terminal.
            .env("GIT_TERMINAL_PROMPT", "0")
            // Read-only commands (status, log) must not take index.lock and race with the user's terminal.
            .env("GIT_OPTIONAL_LOCKS", "0");

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        cmd
    }
}
