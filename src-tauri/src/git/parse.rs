//! Pure parsers for git's machine-readable output. Kept free of I/O so they can be unit tested.

use super::model::{ChangeKind, Commit, CommitDetails, FileChange, GitRef, RefKind, WorkingTreeStatus};

pub const FIELD_SEP: char = '\u{1f}';
pub const RECORD_SEP: char = '\u{1e}';

/// Format string for `git log` matching [`parse_log`].
pub const LOG_FORMAT: &str = "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1e";

/// Format string for `git show -s` matching [`parse_commit_details`]. The free-form body goes last.
pub const DETAILS_FORMAT: &str = "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ct%x1f%B";

/// Format string for `git for-each-ref` matching [`parse_refs`].
pub const REF_FORMAT: &str =
    "--format=%(refname)%1f%(objectname)%1f%(*objectname)%1f%(upstream:short)%1f%(upstream:track,nobracket)";

pub fn parse_log(raw: &str) -> Vec<Commit> {
    raw.split(RECORD_SEP)
        .map(|record| record.trim_start_matches(['\r', '\n']))
        .filter(|record| !record.is_empty())
        .filter_map(parse_log_record)
        .collect()
}

fn parse_log_record(record: &str) -> Option<Commit> {
    let mut fields = record.splitn(6, FIELD_SEP);
    let hash = fields.next()?.to_string();
    let parents = fields.next()?.split_whitespace().map(String::from).collect();
    let author_name = fields.next()?.to_string();
    let author_email = fields.next()?.to_string();
    let timestamp = fields.next()?.trim().parse().unwrap_or(0);
    let subject = fields.next().unwrap_or_default().to_string();
    Some(Commit { hash, parents, author_name, author_email, timestamp, subject })
}

/// Parses [`DETAILS_FORMAT`] output. `files` is left empty: it comes from a separate diff query.
pub fn parse_commit_details(raw: &str) -> Option<CommitDetails> {
    let mut fields = raw.splitn(8, FIELD_SEP);
    let mut next = || fields.next();
    Some(CommitDetails {
        hash: next()?.to_string(),
        parents: next()?.split_whitespace().map(String::from).collect(),
        author_name: next()?.to_string(),
        author_email: next()?.to_string(),
        author_time: next()?.trim().parse().unwrap_or(0),
        committer_name: next()?.to_string(),
        committer_time: next()?.trim().parse().unwrap_or(0),
        message: next()?.trim_end().to_string(),
        files: Vec::new(),
    })
}

pub fn parse_refs(raw: &str) -> Vec<GitRef> {
    raw.lines().filter_map(parse_ref_line).collect()
}

fn parse_ref_line(line: &str) -> Option<GitRef> {
    let fields: Vec<&str> = line.split(FIELD_SEP).collect();
    if fields.len() < 5 {
        return None;
    }
    let full_name = fields[0];
    // refs/remotes/<remote>/HEAD is a symbolic pointer, not a branch the user works on.
    if full_name.ends_with("/HEAD") {
        return None;
    }

    let (kind, name) = if let Some(name) = full_name.strip_prefix("refs/heads/") {
        (RefKind::LocalBranch, name)
    } else if let Some(name) = full_name.strip_prefix("refs/remotes/") {
        (RefKind::RemoteBranch, name)
    } else {
        (RefKind::Tag, full_name.strip_prefix("refs/tags/")?)
    };

    // For annotated tags `*objectname` is the commit; for everything else it is empty.
    let target = if fields[2].is_empty() { fields[1] } else { fields[2] };
    let upstream = Some(fields[3]).filter(|u| !u.is_empty()).map(String::from);
    let (ahead, behind) = parse_tracking(fields[4]);

    Some(GitRef {
        name: name.to_string(),
        full_name: full_name.to_string(),
        kind,
        target: target.to_string(),
        upstream,
        ahead,
        behind,
    })
}

/// Parses `%(upstream:track,nobracket)`, e.g. `ahead 2, behind 1` or `gone`.
fn parse_tracking(track: &str) -> (u32, u32) {
    let mut ahead = 0;
    let mut behind = 0;
    for part in track.split(',') {
        let mut words = part.split_whitespace();
        match (words.next(), words.next().and_then(|n| n.parse().ok())) {
            (Some("ahead"), Some(n)) => ahead = n,
            (Some("behind"), Some(n)) => behind = n,
            _ => {}
        }
    }
    (ahead, behind)
}

/// Parses `git status --porcelain=v1 -z`.
pub fn parse_status(raw: &str) -> WorkingTreeStatus {
    let mut status = WorkingTreeStatus::default();
    let mut tokens = raw.split('\0').filter(|t| !t.is_empty());

    while let Some(entry) = tokens.next() {
        let mut chars = entry.chars();
        let (Some(x), Some(y)) = (chars.next(), chars.next()) else { continue };
        let Some(path) = entry.get(3..) else { continue };
        let path = path.to_string();

        // Renames and copies are followed by the original path as a separate token.
        let old_path =
            if matches!(x, 'R' | 'C') || matches!(y, 'R' | 'C') { tokens.next().map(String::from) } else { None };

        if x == '?' {
            status.unstaged.push(FileChange { path, old_path: None, kind: ChangeKind::Untracked });
            continue;
        }
        if is_conflict(x, y) {
            status.conflicted.push(FileChange { path, old_path: None, kind: ChangeKind::Conflicted });
            continue;
        }
        if let Some(kind) = ChangeKind::from_code(x) {
            let old_path = old_path.clone().filter(|_| matches!(x, 'R' | 'C'));
            status.staged.push(FileChange { path: path.clone(), old_path, kind });
        }
        if let Some(kind) = ChangeKind::from_code(y) {
            let old_path = old_path.filter(|_| matches!(y, 'R' | 'C'));
            status.unstaged.push(FileChange { path, old_path, kind });
        }
    }
    status
}

fn is_conflict(x: char, y: char) -> bool {
    x == 'U' || y == 'U' || (x == 'A' && y == 'A') || (x == 'D' && y == 'D')
}

/// Parses `git diff --name-status -z` / `git diff-tree --name-status -z`.
pub fn parse_name_status(raw: &str) -> Vec<FileChange> {
    let mut files = Vec::new();
    let mut tokens = raw.split('\0').filter(|t| !t.is_empty());

    while let Some(code) = tokens.next() {
        let Some(kind) = code.chars().next().and_then(ChangeKind::from_code) else { continue };
        let (old_path, path) = if matches!(kind, ChangeKind::Renamed | ChangeKind::Copied) {
            let old = tokens.next().map(String::from);
            (old, tokens.next())
        } else {
            (None, tokens.next())
        };
        if let Some(path) = path {
            files.push(FileChange { path: path.to_string(), old_path, kind });
        }
    }
    files
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_log_reads_commits_and_parents() {
        // Arrange
        let raw = "aaa\u{1f}bbb ccc\u{1f}Ana\u{1f}ana@x.io\u{1f}1700000000\u{1f}Merge branch 'x'\u{1e}\n\
                   bbb\u{1f}\u{1f}Bia\u{1f}bia@x.io\u{1f}1690000000\u{1f}root\u{1e}\n";

        // Act
        let commits = parse_log(raw);

        // Assert
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].parents, vec!["bbb", "ccc"]);
        assert_eq!(commits[0].subject, "Merge branch 'x'");
        assert!(commits[1].parents.is_empty());
        assert_eq!(commits[1].timestamp, 1_690_000_000);
    }

    #[test]
    fn parse_commit_details_keeps_multiline_body() {
        let raw = "abc\u{1f}p1 p2\u{1f}Ana\u{1f}ana@x.io\u{1f}10\u{1f}Bia\u{1f}20\u{1f}Subject\n\nBody line\n\n";

        let details = parse_commit_details(raw).expect("valid output");

        assert_eq!(details.parents, vec!["p1", "p2"]);
        assert_eq!(details.committer_name, "Bia");
        assert_eq!(details.committer_time, 20);
        assert_eq!(details.message, "Subject\n\nBody line");
    }

    #[test]
    fn parse_commit_details_rejects_truncated_output() {
        assert!(parse_commit_details("abc\u{1f}p1").is_none());
    }

    #[test]
    fn parse_refs_classifies_and_peels_annotated_tags() {
        let raw = "refs/heads/dev\u{1f}c1\u{1f}\u{1f}origin/dev\u{1f}ahead 2, behind 1\n\
                   refs/remotes/origin/HEAD\u{1f}c1\u{1f}\u{1f}\u{1f}\n\
                   refs/remotes/origin/dev\u{1f}c0\u{1f}\u{1f}\u{1f}\n\
                   refs/tags/v1.0\u{1f}tagobj\u{1f}c9\u{1f}\u{1f}\n";

        let refs = parse_refs(raw);

        assert_eq!(refs.len(), 3);
        assert_eq!(refs[0].kind, RefKind::LocalBranch);
        assert_eq!((refs[0].ahead, refs[0].behind), (2, 1));
        assert_eq!(refs[0].upstream.as_deref(), Some("origin/dev"));
        assert_eq!(refs[1].name, "origin/dev");
        assert_eq!(refs[2].target, "c9");
    }

    #[test]
    fn parse_status_splits_staged_unstaged_and_conflicts() {
        let raw = "M  staged.rs\0 M edited.rs\0MM both.rs\0R  new.rs\0old.rs\0?? fresh.txt\0UU clash.rs\0";

        let status = parse_status(raw);

        let staged: Vec<_> = status.staged.iter().map(|f| f.path.as_str()).collect();
        let unstaged: Vec<_> = status.unstaged.iter().map(|f| f.path.as_str()).collect();
        assert_eq!(staged, vec!["staged.rs", "both.rs", "new.rs"]);
        assert_eq!(unstaged, vec!["edited.rs", "both.rs", "fresh.txt"]);
        assert_eq!(status.staged[2].old_path.as_deref(), Some("old.rs"));
        assert_eq!(status.unstaged[2].kind, ChangeKind::Untracked);
        assert_eq!(status.conflicted[0].path, "clash.rs");
    }

    #[test]
    fn parse_name_status_handles_renames() {
        let raw = "M\0src/a.rs\0R087\0src/old.rs\0src/new.rs\0D\0gone.rs\0";

        let files = parse_name_status(raw);

        assert_eq!(files.len(), 3);
        assert_eq!(files[1].kind, ChangeKind::Renamed);
        assert_eq!(files[1].old_path.as_deref(), Some("src/old.rs"));
        assert_eq!(files[1].path, "src/new.rs");
        assert_eq!(files[2].kind, ChangeKind::Deleted);
    }
}
