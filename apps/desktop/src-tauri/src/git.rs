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

    Some(GitContext {
        worktree_root,
        branch,
        operation: operation.to_string(),
        current_branch,
        incoming_branch,
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

        let _ = fs::remove_dir_all(&dir);
    }
}
