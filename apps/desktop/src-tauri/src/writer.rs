//! Atomic result writing (RF-017, spec §22.2): temp file on the same volume,
//! flush + sync, then rename over the destination.

use std::io::Write;
use std::path::{Path, PathBuf};

fn temp_path_for(target: &Path) -> PathBuf {
    let file_name = target
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "result".to_string());
    let tmp_name = format!(".{}.mergescope-{}.tmp", file_name, std::process::id());
    match target.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent.join(tmp_name),
        _ => PathBuf::from(tmp_name),
    }
}

pub fn backup_path_for(target: &Path) -> PathBuf {
    let mut os = target.as_os_str().to_owned();
    os.push(".mergescope-backup");
    PathBuf::from(os)
}

pub fn atomic_write(target: &Path, bytes: &[u8], create_backup: bool) -> Result<(), String> {
    if create_backup && target.is_file() {
        let backup = backup_path_for(target);
        std::fs::copy(target, &backup)
            .map_err(|e| format!("cannot create backup '{}': {e}", backup.display()))?;
    }

    let tmp = temp_path_for(target);
    let write_result = (|| -> std::io::Result<()> {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.flush()?;
        file.sync_all()?;
        Ok(())
    })();

    if let Err(e) = write_result {
        std::fs::remove_file(&tmp).ok();
        return Err(format!("cannot write temporary file '{}': {e}", tmp.display()));
    }

    // On Windows, std::fs::rename replaces the destination atomically
    // (MoveFileExW + MOVEFILE_REPLACE_EXISTING).
    if let Err(e) = std::fs::rename(&tmp, target) {
        std::fs::remove_file(&tmp).ok();
        return Err(format!("cannot replace '{}': {e}", target.display()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_target(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join("mergescope-tests");
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(format!("{}-{}", std::process::id(), name))
    }

    #[test]
    fn writes_and_replaces_atomically() {
        let target = temp_target("atomic.txt");
        std::fs::write(&target, b"old").unwrap();
        atomic_write(&target, b"new content", false).unwrap();
        assert_eq!(std::fs::read(&target).unwrap(), b"new content");
        // No temp leftovers.
        let leftovers: Vec<_> = std::fs::read_dir(target.parent().unwrap())
            .unwrap()
            .filter_map(Result::ok)
            .filter(|e| e.file_name().to_string_lossy().contains(".mergescope-"))
            .filter(|e| e.file_name().to_string_lossy().ends_with(".tmp"))
            .collect();
        assert!(leftovers.is_empty());
        std::fs::remove_file(target).ok();
    }

    #[test]
    fn creates_backup_when_requested() {
        let target = temp_target("backup.txt");
        std::fs::write(&target, b"original").unwrap();
        atomic_write(&target, b"changed", true).unwrap();
        let backup = backup_path_for(&target);
        assert_eq!(std::fs::read(&backup).unwrap(), b"original");
        assert_eq!(std::fs::read(&target).unwrap(), b"changed");
        std::fs::remove_file(target).ok();
        std::fs::remove_file(backup).ok();
    }

    #[test]
    fn works_when_target_is_in_current_dir_style_path() {
        let target = temp_target("nested dir with spaces");
        std::fs::create_dir_all(&target).unwrap();
        let file = target.join("result é ü.txt");
        std::fs::write(&file, b"a").unwrap();
        atomic_write(&file, "conteúdo".as_bytes(), false).unwrap();
        assert_eq!(std::fs::read(&file).unwrap(), "conteúdo".as_bytes());
        std::fs::remove_dir_all(target).ok();
    }
}
