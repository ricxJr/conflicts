//! Minimal local file logging (spec §29). Never logs file contents, full
//! paths, repository names or branches — only operational metadata.

use crate::cli::LogLevel;
use std::io::Write;
use std::sync::{Mutex, OnceLock};

struct Logger {
    level: LogLevel,
    file: Mutex<Option<std::fs::File>>,
}

static LOGGER: OnceLock<Logger> = OnceLock::new();

pub fn log_dir() -> Option<std::path::PathBuf> {
    std::env::var_os("LOCALAPPDATA")
        .map(|d| std::path::PathBuf::from(d).join("MergeScope").join("logs"))
}

pub fn init(level: LogLevel) {
    let file = log_dir().and_then(|dir| {
        std::fs::create_dir_all(&dir).ok()?;
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(dir.join("mergescope.log"))
            .ok()
    });
    let _ = LOGGER.set(Logger {
        level,
        file: Mutex::new(file),
    });
}

pub fn log(level: LogLevel, message: &str) {
    let Some(logger) = LOGGER.get() else { return };
    if level > logger.level {
        return;
    }
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if let Ok(mut guard) = logger.file.lock() {
        if let Some(file) = guard.as_mut() {
            let _ = writeln!(file, "[{ts}] [{}] {message}", level.as_str());
        }
    }
}

pub fn error(message: &str) {
    log(LogLevel::Error, message);
}

pub fn info(message: &str) {
    log(LogLevel::Info, message);
}
