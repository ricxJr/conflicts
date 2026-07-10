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
        .map(|d| detect_operation(Path::new(&d)))
        .unwrap_or("unknown");

    Some(GitContext {
        worktree_root,
        branch,
        operation: operation.to_string(),
    })
}
