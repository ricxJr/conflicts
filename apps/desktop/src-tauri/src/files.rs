//! Safe file reading and snapshotting (spec §22.1).

use crate::encoding::{self, DecodedFile, Encoding, Eol, WriteEol};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSnapshot {
    pub path: String,
    pub file_name: String,
    pub content: String,
    pub encoding: Encoding,
    pub eol: Eol,
    pub trailing_newline: bool,
    pub hash: String,
    pub size_bytes: u64,
    pub had_decode_errors: bool,
}

/// Write-back metadata retained by the session (never trusted from the UI).
#[derive(Debug, Clone)]
pub struct WriteMeta {
    pub encoding: Encoding,
    pub write_eol: WriteEol,
}

pub fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

pub fn hash_file(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path)
        .map_err(|e| format!("cannot read '{}': {e}", path.display()))?;
    Ok(hash_bytes(&bytes))
}

pub fn read_snapshot(path: &Path) -> Result<(FileSnapshot, WriteMeta, DecodedFile), String> {
    let bytes = std::fs::read(path)
        .map_err(|e| format!("cannot read '{}': {e}", path.display()))?;
    let decoded = encoding::decode(&bytes);
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string());

    let snapshot = FileSnapshot {
        path: path.display().to_string(),
        file_name,
        content: decoded.content.clone(),
        encoding: decoded.encoding,
        eol: decoded.eol,
        trailing_newline: decoded.trailing_newline,
        hash: hash_bytes(&bytes),
        size_bytes: bytes.len() as u64,
        had_decode_errors: decoded.had_decode_errors,
    };
    let meta = WriteMeta {
        encoding: decoded.encoding,
        write_eol: decoded.write_eol,
    };
    Ok((snapshot, meta, decoded))
}

/// RF-002: validates inputs before the UI starts. Returns a user-facing error.
pub fn validate_inputs(
    base: Option<&Path>,
    current: &Path,
    incoming: &Path,
    result: &Path,
) -> Result<(), String> {
    for (label, path) in [("--current", current), ("--incoming", incoming)] {
        if !path.is_file() {
            return Err(format!("{label} file not found: {}", path.display()));
        }
        std::fs::File::open(path)
            .map_err(|e| format!("{label} file is not readable ({}): {e}", path.display()))?;
    }
    if let Some(base) = base {
        if !base.is_file() {
            return Err(format!("--base file not found: {}", base.display()));
        }
    }
    if !result.is_file() {
        return Err(format!("--result file not found: {}", result.display()));
    }
    let writable = std::fs::OpenOptions::new()
        .write(true)
        .open(result)
        .is_ok();
    if !writable {
        return Err(format!(
            "--result file is not writable: {}",
            result.display()
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_file(name: &str, contents: &[u8]) -> std::path::PathBuf {
        let dir = std::env::temp_dir()
            .join("mergescope-tests")
            .join(format!("{}-{}", std::process::id(), name));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(name);
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(contents).unwrap();
        path
    }

    #[test]
    fn snapshot_reports_metadata() {
        let path = temp_file("snap.txt", b"hello\r\nworld\r\n");
        let (snap, meta, _) = read_snapshot(&path).unwrap();
        assert_eq!(snap.eol, Eol::Crlf);
        assert_eq!(meta.write_eol, WriteEol::Crlf);
        assert_eq!(snap.content, "hello\nworld\n");
        assert_eq!(snap.size_bytes, 14);
        assert_eq!(snap.hash.len(), 64);
        std::fs::remove_file(path).ok();
    }

    #[test]
    fn validate_rejects_missing_files() {
        let ok = temp_file("ok.txt", b"x");
        let missing = std::path::Path::new("Z:/definitely/missing.txt");
        assert!(validate_inputs(None, missing, &ok, &ok).is_err());
        assert!(validate_inputs(None, &ok, missing, &ok).is_err());
        assert!(validate_inputs(None, &ok, &ok, missing).is_err());
        assert!(validate_inputs(Some(missing), &ok, &ok, &ok).is_err());
        assert!(validate_inputs(None, &ok, &ok, &ok).is_ok());
        std::fs::remove_file(ok).ok();
    }
}
