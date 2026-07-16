//! Tauri IPC commands (spec §25).

use crate::cli::CliArgs;
use crate::encoding;
use crate::files::{self, FileSnapshot, WriteMeta};
use crate::git::{self, GitContext};
use crate::logging;
use crate::writer;
use serde::Serialize;
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub struct AppState {
    /// None in settings-only mode (launched without a merge session).
    pub cli: Option<CliArgs>,
    /// Set when a `--file` launch pointed at a file without conflict markers;
    /// the UI then opens in settings mode and explains why.
    pub no_conflict_path: Option<String>,
    pub exit_code: AtomicI32,
    pub result_meta: Mutex<Option<WriteMeta>>,
    pub result_trailing_newline: Mutex<bool>,
}

impl AppState {
    pub fn new(cli: Option<CliArgs>, no_conflict_path: Option<String>) -> Self {
        // Until a successful save happens, closing a merge means "canceled".
        // Settings mode has nothing to cancel, so it exits cleanly.
        let initial_exit = if cli.is_some() { 1 } else { 0 };
        Self {
            cli,
            no_conflict_path,
            exit_code: AtomicI32::new(initial_exit),
            result_meta: Mutex::new(None),
            result_trailing_newline: Mutex::new(true),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendError {
    pub code: &'static str,
    pub message: String,
}

impl BackendError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliContextDto {
    base_path: Option<String>,
    current_path: String,
    incoming_path: String,
    result_path: String,
    repo_path: Option<String>,
    title: Option<String>,
    current_label: Option<String>,
    incoming_label: Option<String>,
    readonly: bool,
    no_backup: bool,
    single_file: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionFilesDto {
    base: Option<FileSnapshot>,
    current: FileSnapshot,
    incoming: FileSnapshot,
    result: FileSnapshot,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenSessionOutput {
    cli: CliContextDto,
    files: SessionFilesDto,
    git: Option<GitContext>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResultOutput {
    hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDiffOutput {
    before: String,
    after: String,
    file_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchContextDto {
    mode: &'static str,
    no_conflict_path: Option<String>,
}

/// Tells the frontend how MergeScope was launched, before any file is read.
#[tauri::command]
pub fn get_launch_context(state: State<AppState>) -> LaunchContextDto {
    match &state.cli {
        Some(_) => LaunchContextDto {
            mode: "merge",
            no_conflict_path: None,
        },
        None => LaunchContextDto {
            mode: "settings",
            no_conflict_path: state.no_conflict_path.clone(),
        },
    }
}

#[tauri::command]
pub fn open_merge_session(state: State<AppState>) -> Result<OpenSessionOutput, BackendError> {
    let cli = state.cli.as_ref().ok_or_else(|| {
        BackendError::new(
            "invalid-session",
            "MergeScope was started without a merge session",
        )
    })?;

    let base = match &cli.base {
        Some(path) => Some(
            files::read_snapshot(path)
                .map(|(snap, _, _)| snap)
                .map_err(|e| BackendError::new("read-error", e))?,
        ),
        None => None,
    };
    let (current, _, _) =
        files::read_snapshot(&cli.current).map_err(|e| BackendError::new("read-error", e))?;
    let (incoming, _, _) =
        files::read_snapshot(&cli.incoming).map_err(|e| BackendError::new("read-error", e))?;
    let (result, result_meta, decoded) =
        files::read_snapshot(&cli.result).map_err(|e| BackendError::new("read-error", e))?;

    *state.result_meta.lock().unwrap() = Some(result_meta);
    *state.result_trailing_newline.lock().unwrap() = decoded.trailing_newline;

    let git = git::read_context(cli.repo.as_deref(), &cli.result);
    logging::info(&format!(
        "session opened: {} bytes result, git={}",
        result.size_bytes,
        git.as_ref().map(|g| g.operation.as_str()).unwrap_or("none")
    ));

    // Single-file launches point current/incoming/result at the same
    // conflicted file. When that file is an unmerged path in a git repo, pull
    // the real three-way inputs (base/ours/theirs) from the index so a file
    // opened directly (Explorer / "Open with") analyzes identically to a
    // mergetool launch. Otherwise leave the three inputs equal and let the
    // frontend rebuild the sides from the conflict markers.
    let (base, current, incoming) = if cli.single_file {
        match git::read_index_stages(cli.repo.as_deref(), &cli.result) {
            Some(stages) if stages.current.is_some() || stages.incoming.is_some() => (
                stages
                    .base
                    .map(|b| files::snapshot_from_bytes(&cli.result, &b)),
                files::snapshot_from_bytes(&cli.result, stages.current.as_deref().unwrap_or(&[])),
                files::snapshot_from_bytes(&cli.result, stages.incoming.as_deref().unwrap_or(&[])),
            ),
            _ => (base, current, incoming),
        }
    } else {
        (base, current, incoming)
    };

    Ok(OpenSessionOutput {
        cli: CliContextDto {
            base_path: cli.base.as_ref().map(|p| p.display().to_string()),
            current_path: cli.current.display().to_string(),
            incoming_path: cli.incoming.display().to_string(),
            result_path: cli.result.display().to_string(),
            repo_path: cli.repo.as_ref().map(|p| p.display().to_string()),
            title: cli.title.clone(),
            current_label: cli.current_label.clone(),
            incoming_label: cli.incoming_label.clone(),
            readonly: cli.readonly,
            no_backup: cli.no_backup,
            single_file: cli.single_file,
        },
        files: SessionFilesDto {
            base,
            current,
            incoming,
            result,
        },
        git,
    })
}

#[tauri::command]
pub fn save_merge_result(
    state: State<AppState>,
    content: String,
    expected_hash: String,
    allow_overwrite: bool,
) -> Result<SaveResultOutput, BackendError> {
    let cli = state.cli.as_ref().ok_or_else(|| {
        BackendError::new(
            "invalid-session",
            "MergeScope was started without a merge session",
        )
    })?;
    if cli.readonly {
        return Err(BackendError::new(
            "write-error",
            "session was opened in readonly mode",
        ));
    }

    // RF-020/§22.3: detect external modification before replacing.
    let disk_hash =
        files::hash_file(&cli.result).map_err(|e| BackendError::new("read-error", e))?;
    if disk_hash != expected_hash && !allow_overwrite {
        logging::error("save blocked: result changed externally");
        return Err(BackendError::new(
            "external-change",
            "The result file changed outside MergeScope.",
        ));
    }

    let meta = state
        .result_meta
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| BackendError::new("invalid-session", "session not initialized"))?;

    // Preserve the original trailing-newline convention unless the user's
    // buffer already ends with one.
    let trailing = *state.result_trailing_newline.lock().unwrap();
    let mut normalized = content;
    if trailing && !normalized.ends_with('\n') {
        normalized.push('\n');
    }

    let bytes = encoding::encode(&normalized, meta.encoding, meta.write_eol);
    let create_backup = !cli.no_backup && backup_preference_enabled();
    writer::atomic_write(&cli.result, &bytes, create_backup)
        .map_err(|e| BackendError::new("write-error", e))?;

    let new_hash = files::hash_bytes(&bytes);
    logging::info(&format!("result saved: {} bytes", bytes.len()));
    Ok(SaveResultOutput { hash: new_hash })
}

/// Returns the diff of a single commit for the session's result file: the file
/// content at the commit's parent (`before`) and at the commit (`after`). Lets
/// the UI show a commit's own changes in-app instead of linking to a web host
/// (which 404s for commits that were never pushed).
#[tauri::command]
pub fn commit_file_diff(
    state: State<AppState>,
    sha: String,
) -> Result<CommitDiffOutput, BackendError> {
    let cli = state.cli.as_ref().ok_or_else(|| {
        BackendError::new(
            "invalid-session",
            "MergeScope was started without a merge session",
        )
    })?;
    // Args are passed to git as a fixed array (no shell), so injection is not a
    // concern; still reject anything that can't be a git object name.
    if sha.is_empty() || !sha.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(BackendError::new("read-error", "invalid commit id"));
    }

    let file_name = cli
        .result
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| BackendError::new("read-error", "result path has no file name"))?;
    // The result file is the real repository file (the mergetool's $MERGED),
    // so its directory sits inside the worktree even when current/incoming are
    // temp copies. Fall back to the explicit repo path if there's no parent.
    let dir = cli
        .result
        .parent()
        .map(std::path::Path::to_path_buf)
        .or_else(|| cli.repo.clone())
        .ok_or_else(|| BackendError::new("read-error", "cannot locate repository"))?;

    let after = git::show_file_at(&dir, &sha, &file_name).ok_or_else(|| {
        BackendError::new(
            "read-error",
            format!("commit {sha} does not contain {file_name}"),
        )
    })?;
    // No parent (root commit) or the file is new in this commit → empty before.
    let before = git::show_file_at(&dir, &format!("{sha}^"), &file_name).unwrap_or_default();

    Ok(CommitDiffOutput {
        before,
        after,
        file_name,
    })
}

#[tauri::command]
pub fn set_exit_code(state: State<AppState>, code: i32) {
    state.exit_code.store(code, Ordering::SeqCst);
}

#[tauri::command]
pub fn exit_app(app: AppHandle, state: State<AppState>, code: i32) {
    state.exit_code.store(code, Ordering::SeqCst);
    app.exit(code);
}

fn preferences_path() -> Option<std::path::PathBuf> {
    std::env::var_os("APPDATA")
        .map(|d| std::path::PathBuf::from(d).join("MergeScope").join("settings.json"))
}

fn backup_preference_enabled() -> bool {
    preferences_path()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| v.get("createBackup").and_then(|b| b.as_bool()))
        .unwrap_or(false)
}

#[tauri::command]
pub fn get_preferences() -> Result<Option<serde_json::Value>, BackendError> {
    let Some(path) = preferences_path() else {
        return Ok(None);
    };
    if !path.is_file() {
        return Ok(None);
    }
    let text = std::fs::read_to_string(&path)
        .map_err(|e| BackendError::new("read-error", format!("cannot read preferences: {e}")))?;
    Ok(serde_json::from_str(&text).ok())
}

#[tauri::command]
pub fn save_preferences(prefs: serde_json::Value) -> Result<(), BackendError> {
    let Some(path) = preferences_path() else {
        return Ok(());
    };
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)
            .map_err(|e| BackendError::new("write-error", format!("cannot create dir: {e}")))?;
    }
    let text = serde_json::to_string_pretty(&prefs)
        .map_err(|e| BackendError::new("write-error", e.to_string()))?;
    std::fs::write(&path, text)
        .map_err(|e| BackendError::new("write-error", format!("cannot save preferences: {e}")))?;
    Ok(())
}

/// Applies the window title from CLI args after the window is created.
pub fn apply_window_title(app: &AppHandle, cli: &CliArgs) {
    if let Some(window) = app.get_webview_window("main") {
        let file_name = cli
            .result
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let title = cli
            .title
            .clone()
            .unwrap_or_else(|| format!("{file_name} — MergeScope"));
        let _ = window.set_title(&title);
    }
}
