//! Git/worktree context detection (spec §17.4, §18). Read-only, fixed
//! arguments, no shell interpretation, never executes repository scripts.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitContext {
    pub worktree_root: Option<String>,
    pub branch: Option<String>,
    pub operation: String,
    /// Human name of the side git calls "ours" (LOCAL/current).
    pub current_branch: Option<String>,
    /// Human name of the side git calls "theirs" (REMOTE/incoming).
    pub incoming_branch: Option<String>,
    /// Commit backing the "ours" side (HEAD/onto), when detectable.
    pub current_commit: Option<CommitInfo>,
    /// Commit backing the "theirs" side (MERGE_HEAD/etc.), when detectable.
    pub incoming_commit: Option<CommitInfo>,
    /// Raw `origin` remote URL, so the UI can build a web link to the commit.
    pub remote_url: Option<String>,
}

/// Minimal identity of a commit, enough to label a side and link to it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    /// Full 40-char object name.
    pub sha: String,
    /// Abbreviated hash git chose (unambiguous in this repo).
    pub short_sha: String,
    pub author: String,
    /// First line of the commit message.
    pub subject: String,
}

fn git_command(cwd: &Path) -> Command {
    let mut cmd = Command::new("git");
    cmd.current_dir(cwd);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn git_stdout(cwd: &Path, args: &[&str]) -> Option<String> {
    let output = git_command(cwd).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

/// Detects the in-progress operation by inspecting the git dir
/// (works with worktrees, where `.git` is a file pointing at the real gitdir).
fn detect_operation(git_dir: &Path) -> &'static str {
    if git_dir.join("rebase-merge").is_dir() || git_dir.join("rebase-apply").is_dir() {
        "rebase"
    } else if git_dir.join("CHERRY_PICK_HEAD").is_file() {
        "cherry-pick"
    } else if git_dir.join("MERGE_HEAD").is_file() {
        "merge"
    } else {
        "unknown"
    }
}

/// Best-effort human name for a revision: a branch tip pointing exactly at
/// it, then a clean `name-rev` name, then the short hash.
fn rev_name(cwd: &Path, rev: &str) -> Option<String> {
    if let Some(out) = git_stdout(
        cwd,
        &["branch", "--points-at", rev, "--format=%(refname:short)"],
    ) {
        if let Some(first) = out
            .lines()
            .map(str::trim)
            .find(|l| !l.is_empty() && !l.starts_with('('))
        {
            return Some(first.to_string());
        }
    }
    if let Some(name) = git_stdout(cwd, &["name-rev", "--name-only", "--no-undefined", rev]) {
        let name = name.strip_prefix("remotes/").unwrap_or(&name).to_string();
        // Names like `main~3` point elsewhere; a hash is less misleading.
        if !name.contains('~') && !name.contains('^') {
            return Some(name);
        }
    }
    git_stdout(cwd, &["rev-parse", "--short", rev])
}

fn read_git_file(git_dir: &Path, rel: &str) -> Option<String> {
    let text = std::fs::read_to_string(git_dir.join(rel)).ok()?;
    let text = text.trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn strip_heads(name: String) -> String {
    name.strip_prefix("refs/heads/")
        .map(str::to_string)
        .unwrap_or(name)
}

/// Names of the "ours"/"theirs" sides for the operation in progress.
/// During a rebase the sides invert: ours = the branch rebased onto,
/// theirs = the branch being rebased (kept in `rebase-merge/head-name`).
fn side_branches(
    cwd: &Path,
    git_dir: Option<&Path>,
    operation: &str,
    branch: Option<&String>,
) -> (Option<String>, Option<String>) {
    let head_name = || branch.cloned().or_else(|| rev_name(cwd, "HEAD"));
    match operation {
        "merge" => (head_name(), rev_name(cwd, "MERGE_HEAD")),
        "cherry-pick" => (head_name(), rev_name(cwd, "CHERRY_PICK_HEAD")),
        "rebase" => {
            let incoming = git_dir
                .and_then(|d| {
                    read_git_file(d, "rebase-merge/head-name")
                        .or_else(|| read_git_file(d, "rebase-apply/head-name"))
                })
                .map(strip_heads);
            let current = git_dir
                .and_then(|d| {
                    read_git_file(d, "rebase-merge/onto")
                        .or_else(|| read_git_file(d, "rebase-apply/onto"))
                })
                .and_then(|sha| rev_name(cwd, &sha))
                .or_else(head_name);
            (current, incoming)
        }
        _ => (branch.cloned(), None),
    }
}

/// Identity of the commit `rev` resolves to. One `git show -s` call whose
/// format packs SHA, short SHA, author and subject into four lines.
fn commit_info(cwd: &Path, rev: &str) -> Option<CommitInfo> {
    let out = git_stdout(cwd, &["show", "-s", "--format=%H%n%h%n%an%n%s", rev])?;
    let mut lines = out.lines();
    let sha = lines.next()?.trim().to_string();
    let short_sha = lines.next()?.trim().to_string();
    let author = lines.next().unwrap_or("").trim().to_string();
    // Subject is the 4th line; %s never contains a newline, so take it whole.
    let subject = lines.next().unwrap_or("").to_string();
    if sha.is_empty() {
        return None;
    }
    Some(CommitInfo {
        sha,
        short_sha,
        author,
        subject,
    })
}

/// Commits backing the "ours"/"theirs" sides, matching the rev choices in
/// `side_branches` (rebase inverts sides just the same). For rebase the
/// incoming commit is the one being applied (`stopped-sha`) when available.
fn side_commits(
    cwd: &Path,
    git_dir: Option<&Path>,
    operation: &str,
) -> (Option<CommitInfo>, Option<CommitInfo>) {
    match operation {
        "merge" => (commit_info(cwd, "HEAD"), commit_info(cwd, "MERGE_HEAD")),
        "cherry-pick" => (
            commit_info(cwd, "HEAD"),
            commit_info(cwd, "CHERRY_PICK_HEAD"),
        ),
        "rebase" => {
            let incoming = git_dir
                .and_then(|d| {
                    read_git_file(d, "rebase-merge/stopped-sha")
                        .or_else(|| read_git_file(d, "rebase-apply/original-commit"))
                        .or_else(|| read_git_file(d, "rebase-merge/head-name"))
                        .or_else(|| read_git_file(d, "rebase-apply/head-name"))
                })
                .and_then(|rev| commit_info(cwd, &rev));
            let current = git_dir
                .and_then(|d| {
                    read_git_file(d, "rebase-merge/onto").or_else(|| read_git_file(d, "rebase-apply/onto"))
                })
                .and_then(|rev| commit_info(cwd, &rev))
                .or_else(|| commit_info(cwd, "HEAD"));
            (current, incoming)
        }
        _ => (commit_info(cwd, "HEAD"), None),
    }
}

pub fn read_context(repo_hint: Option<&Path>, result_path: &Path) -> Option<GitContext> {
    let cwd: PathBuf = repo_hint
        .map(Path::to_path_buf)
        .or_else(|| result_path.parent().map(Path::to_path_buf))?;
    if !cwd.is_dir() {
        return None;
    }

    let worktree_root = git_stdout(&cwd, &["rev-parse", "--show-toplevel"]);
    worktree_root.as_ref()?;

    let branch = git_stdout(&cwd, &["branch", "--show-current"]);
    let git_dir = git_stdout(&cwd, &["rev-parse", "--absolute-git-dir"]);
    let operation = git_dir
        .as_deref()
        .map(|d| detect_operation(Path::new(d)))
        .unwrap_or("unknown");
    let (current_branch, incoming_branch) = side_branches(
        &cwd,
        git_dir.as_deref().map(Path::new),
        operation,
        branch.as_ref(),
    );
    let (current_commit, incoming_commit) =
        side_commits(&cwd, git_dir.as_deref().map(Path::new), operation);

    // `remote get-url` is the porcelain form; fall back to the raw config key
    // (older git, or a URL set without a fetch refspec).
    let remote_url = git_stdout(&cwd, &["remote", "get-url", "origin"])
        .or_else(|| git_stdout(&cwd, &["config", "--get", "remote.origin.url"]));

    Some(GitContext {
        worktree_root,
        branch,
        operation: operation.to_string(),
        current_branch,
        incoming_branch,
        current_commit,
        incoming_commit,
        remote_url,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;

    fn git_ok(dir: &Path, args: &[&str]) -> bool {
        Command::new("git")
            .current_dir(dir)
            .args(args)
            .env("GIT_AUTHOR_NAME", "t")
            .env("GIT_AUTHOR_EMAIL", "t@t")
            .env("GIT_COMMITTER_NAME", "t")
            .env("GIT_COMMITTER_EMAIL", "t@t")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    #[test]
    fn detects_side_branches_during_merge() {
        if Command::new("git").arg("--version").output().is_err() {
            return; // git not installed; nothing to test
        }
        let dir = std::env::temp_dir().join(format!("mergescope-git-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        assert!(git_ok(&dir, &["init", "-b", "main"]));
        fs::write(dir.join("f.txt"), "base\n").unwrap();
        assert!(git_ok(&dir, &["add", "."]));
        assert!(git_ok(&dir, &["commit", "-m", "base"]));
        assert!(git_ok(&dir, &["checkout", "-b", "feature/x"]));
        fs::write(dir.join("f.txt"), "feature\n").unwrap();
        assert!(git_ok(&dir, &["commit", "-am", "feature"]));
        assert!(git_ok(&dir, &["checkout", "main"]));
        fs::write(dir.join("f.txt"), "main\n").unwrap();
        assert!(git_ok(&dir, &["commit", "-am", "main"]));
        // Conflicting merge: leaves MERGE_HEAD behind.
        let _ = Command::new("git")
            .current_dir(&dir)
            .args(["merge", "feature/x"])
            .output();

        let ctx = read_context(Some(&dir), &dir.join("f.txt")).expect("git context");
        assert_eq!(ctx.operation, "merge");
        assert_eq!(ctx.current_branch.as_deref(), Some("main"));
        assert_eq!(ctx.incoming_branch.as_deref(), Some("feature/x"));

        // Both sides resolve to a concrete commit authored by the test identity.
        let current = ctx.current_commit.expect("current commit");
        let incoming = ctx.incoming_commit.expect("incoming commit");
        assert_eq!(current.author, "t");
        assert_eq!(incoming.author, "t");
        assert_eq!(incoming.subject, "feature");
        assert_eq!(current.sha.len(), 40);
        assert!(current.sha.starts_with(&current.short_sha));
        assert_ne!(current.sha, incoming.sha);
        // Local test repo has no remote, so no web link can be built.
        assert!(ctx.remote_url.is_none());

        let _ = fs::remove_dir_all(&dir);
    }
}
