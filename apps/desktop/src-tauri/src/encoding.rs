//! Encoding and EOL detection/serialization (spec §22.4, §22.5).
//! MVP scope: UTF-8 with and without BOM; CRLF/LF preservation.

use serde::Serialize;

pub const UTF8_BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Encoding {
    #[serde(rename = "utf-8")]
    Utf8,
    #[serde(rename = "utf-8-bom")]
    Utf8Bom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Eol {
    #[serde(rename = "lf")]
    Lf,
    #[serde(rename = "crlf")]
    Crlf,
    #[serde(rename = "mixed")]
    Mixed,
}

#[derive(Debug, Clone)]
pub struct DecodedFile {
    /// Content normalized to `\n`.
    pub content: String,
    pub encoding: Encoding,
    pub eol: Eol,
    /// EOL used when writing back (predominant one for mixed files).
    pub write_eol: WriteEol,
    pub trailing_newline: bool,
    pub had_decode_errors: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WriteEol {
    Lf,
    Crlf,
}

pub fn decode(raw: &[u8]) -> DecodedFile {
    let (encoding, body) = if raw.starts_with(&UTF8_BOM) {
        (Encoding::Utf8Bom, &raw[3..])
    } else {
        (Encoding::Utf8, raw)
    };

    let (text, had_decode_errors) = match std::str::from_utf8(body) {
        Ok(s) => (s.to_string(), false),
        Err(_) => (String::from_utf8_lossy(body).into_owned(), true),
    };

    let crlf_count = text.matches("\r\n").count();
    let lf_total = text.matches('\n').count();
    let lone_lf = lf_total - crlf_count;

    let eol = match (crlf_count, lone_lf) {
        (0, _) => Eol::Lf,
        (_, 0) => Eol::Crlf,
        _ => Eol::Mixed,
    };
    let write_eol = if crlf_count >= lone_lf && crlf_count > 0 {
        WriteEol::Crlf
    } else {
        WriteEol::Lf
    };

    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    let trailing_newline = normalized.ends_with('\n');

    DecodedFile {
        content: normalized,
        encoding,
        eol,
        write_eol,
        trailing_newline,
        had_decode_errors,
    }
}

/// Serializes `\n`-normalized content back to bytes, restoring BOM and EOL.
pub fn encode(content: &str, encoding: Encoding, write_eol: WriteEol) -> Vec<u8> {
    let text = match write_eol {
        WriteEol::Lf => content.to_string(),
        WriteEol::Crlf => content.replace('\n', "\r\n"),
    };
    let mut bytes = Vec::with_capacity(text.len() + 3);
    if encoding == Encoding::Utf8Bom {
        bytes.extend_from_slice(&UTF8_BOM);
    }
    bytes.extend_from_slice(text.as_bytes());
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_plain_utf8_lf() {
        let d = decode(b"a\nb\n");
        assert_eq!(d.encoding, Encoding::Utf8);
        assert_eq!(d.eol, Eol::Lf);
        assert!(d.trailing_newline);
        assert!(!d.had_decode_errors);
        assert_eq!(d.content, "a\nb\n");
    }

    #[test]
    fn detects_bom_and_crlf() {
        let mut raw = UTF8_BOM.to_vec();
        raw.extend_from_slice(b"a\r\nb\r\n");
        let d = decode(&raw);
        assert_eq!(d.encoding, Encoding::Utf8Bom);
        assert_eq!(d.eol, Eol::Crlf);
        assert_eq!(d.write_eol, WriteEol::Crlf);
        assert_eq!(d.content, "a\nb\n");
    }

    #[test]
    fn detects_mixed_eol() {
        let d = decode(b"a\r\nb\nc\r\nd\r\n");
        assert_eq!(d.eol, Eol::Mixed);
        assert_eq!(d.write_eol, WriteEol::Crlf);
    }

    #[test]
    fn flags_invalid_utf8() {
        let d = decode(&[0x61, 0xFF, 0x62]);
        assert!(d.had_decode_errors);
    }

    #[test]
    fn no_trailing_newline_is_preserved_in_flags() {
        let d = decode(b"a\nb");
        assert!(!d.trailing_newline);
    }

    #[test]
    fn encode_round_trips_bom_and_crlf() {
        let mut raw = UTF8_BOM.to_vec();
        raw.extend_from_slice(b"x\r\ny\r\n");
        let d = decode(&raw);
        let out = encode(&d.content, d.encoding, d.write_eol);
        assert_eq!(out, raw);
    }

    #[test]
    fn encode_round_trips_plain_lf_without_trailing() {
        let raw = b"x\ny".to_vec();
        let d = decode(&raw);
        let out = encode(&d.content, d.encoding, d.write_eol);
        assert_eq!(out, raw);
    }
}
