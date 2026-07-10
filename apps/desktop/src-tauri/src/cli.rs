//! CLI contract (spec §16): argument parsing with git-mergetool aliases.

use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd)]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

impl LogLevel {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "error" => Ok(Self::Error),
            "warn" => Ok(Self::Warn),
            "info" => Ok(Self::Info),
            "debug" => Ok(Self::Debug),
            "trace" => Ok(Self::Trace),
            other => Err(format!("invalid --log-level '{other}'")),
        }
    }
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Error => "error",
            Self::Warn => "warn",
            Self::Info => "info",
            Self::Debug => "debug",
            Self::Trace => "trace",
        }
    }
}

#[derive(Debug, Clone)]
pub struct CliArgs {
    pub base: Option<PathBuf>,
    pub current: PathBuf,
    pub incoming: PathBuf,
    pub result: PathBuf,
    pub repo: Option<PathBuf>,
    pub title: Option<String>,
    pub current_label: Option<String>,
    pub incoming_label: Option<String>,
    pub readonly: bool,
    /// Accepted for git-mergetool compatibility; the process always waits.
    #[allow(dead_code)]
    pub wait: bool,
    pub no_backup: bool,
    pub log_level: LogLevel,
}

#[derive(Debug)]
pub enum CliCommand {
    Merge(Box<CliArgs>),
    Doctor,
    Help,
    Version,
}

pub const USAGE: &str = "MergeScope — visual Git merge conflict resolution

USAGE:
  mergescope --current <path> --incoming <path> --result <path> [--base <path>] [options]
  mergescope doctor
  mergescope --help | --version

ARGUMENTS:
  --base <path>            Common ancestor file (optional)
  --current <path>         Current side file (alias: --local)
  --incoming <path>        Incoming side file (alias: --remote)
  --result <path>          Output file (alias: --merged)

OPTIONS:
  --repo <path>            Explicit repository/worktree path
  --title <text>           Window title
  --current-label <text>   Label for the current side
  --incoming-label <text>  Label for the incoming side
  --readonly               Open for inspection only
  --wait                   Keep the process alive until the window closes (default)
  --no-backup              Disable the internal backup
  --log-level <level>      error | warn | info | debug | trace

EXIT CODES:
  0  result saved successfully
  1  canceled or unresolved conflicts left
  2  invalid arguments
  3  read failure
  4  write failure
  5  internal merge engine failure
  6  file changed externally during the session";

pub fn parse(args: &[String]) -> Result<CliCommand, String> {
    if args.iter().any(|a| a == "--help" || a == "-h") {
        return Ok(CliCommand::Help);
    }
    if args.iter().any(|a| a == "--version" || a == "-V") {
        return Ok(CliCommand::Version);
    }
    if args.first().map(String::as_str) == Some("doctor") {
        return Ok(CliCommand::Doctor);
    }

    let mut base = None;
    let mut current = None;
    let mut incoming = None;
    let mut result = None;
    let mut repo = None;
    let mut title = None;
    let mut current_label = None;
    let mut incoming_label = None;
    let mut readonly = false;
    let mut wait = true;
    let mut no_backup = false;
    let mut log_level = LogLevel::Warn;

    let mut i = 0;
    while i < args.len() {
        let arg = args[i].as_str();
        let mut take_value = |name: &str| -> Result<String, String> {
            i += 1;
            args.get(i)
                .cloned()
                .ok_or_else(|| format!("missing value for {name}"))
        };

        match arg {
            "--base" => base = Some(PathBuf::from(take_value("--base")?)),
            "--current" | "--local" => current = Some(PathBuf::from(take_value(arg)?)),
            "--incoming" | "--remote" => incoming = Some(PathBuf::from(take_value(arg)?)),
            "--result" | "--merged" => result = Some(PathBuf::from(take_value(arg)?)),
            "--repo" => repo = Some(PathBuf::from(take_value("--repo")?)),
            "--title" => title = Some(take_value("--title")?),
            "--current-label" => current_label = Some(take_value("--current-label")?),
            "--incoming-label" => incoming_label = Some(take_value("--incoming-label")?),
            "--readonly" => readonly = true,
            "--wait" => wait = true,
            "--no-backup" => no_backup = true,
            "--log-level" => log_level = LogLevel::parse(&take_value("--log-level")?)?,
            other => return Err(format!("unknown argument '{other}'")),
        }
        i += 1;
    }

    let current = current.ok_or("missing required argument --current (or --local)")?;
    let incoming = incoming.ok_or("missing required argument --incoming (or --remote)")?;
    let result = result.ok_or("missing required argument --result (or --merged)")?;

    Ok(CliCommand::Merge(Box::new(CliArgs {
        base,
        current,
        incoming,
        result,
        repo,
        title,
        current_label,
        incoming_label,
        readonly,
        wait,
        no_backup,
        log_level,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(args: &[&str]) -> Vec<String> {
        args.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn parses_canonical_arguments() {
        let cmd = parse(&v(&[
            "--base", "b.txt", "--current", "c.txt", "--incoming", "i.txt", "--result", "r.txt",
        ]))
        .unwrap();
        match cmd {
            CliCommand::Merge(args) => {
                assert_eq!(args.base.unwrap().to_str().unwrap(), "b.txt");
                assert_eq!(args.current.to_str().unwrap(), "c.txt");
                assert_eq!(args.incoming.to_str().unwrap(), "i.txt");
                assert_eq!(args.result.to_str().unwrap(), "r.txt");
                assert!(args.wait);
                assert!(!args.readonly);
            }
            other => panic!("expected merge, got {other:?}"),
        }
    }

    #[test]
    fn accepts_git_mergetool_aliases() {
        let cmd = parse(&v(&[
            "--local", "c.txt", "--remote", "i.txt", "--merged", "r.txt",
        ]))
        .unwrap();
        match cmd {
            CliCommand::Merge(args) => {
                assert!(args.base.is_none());
                assert_eq!(args.current.to_str().unwrap(), "c.txt");
                assert_eq!(args.incoming.to_str().unwrap(), "i.txt");
                assert_eq!(args.result.to_str().unwrap(), "r.txt");
            }
            other => panic!("expected merge, got {other:?}"),
        }
    }

    #[test]
    fn rejects_unknown_arguments() {
        assert!(parse(&v(&["--nope"])).is_err());
    }

    #[test]
    fn rejects_missing_required() {
        assert!(parse(&v(&["--current", "c.txt"])).is_err());
    }

    #[test]
    fn rejects_missing_value() {
        assert!(parse(&v(&["--current"])).is_err());
    }

    #[test]
    fn parses_doctor_help_version() {
        assert!(matches!(parse(&v(&["doctor"])).unwrap(), CliCommand::Doctor));
        assert!(matches!(parse(&v(&["--help"])).unwrap(), CliCommand::Help));
        assert!(matches!(parse(&v(&["--version"])).unwrap(), CliCommand::Version));
    }

    #[test]
    fn parses_labels_and_flags() {
        let cmd = parse(&v(&[
            "--current", "c", "--incoming", "i", "--result", "r",
            "--current-label", "HEAD", "--incoming-label", "feature/x",
            "--readonly", "--no-backup", "--log-level", "debug",
        ]))
        .unwrap();
        match cmd {
            CliCommand::Merge(args) => {
                assert_eq!(args.current_label.as_deref(), Some("HEAD"));
                assert_eq!(args.incoming_label.as_deref(), Some("feature/x"));
                assert!(args.readonly);
                assert!(args.no_backup);
                assert_eq!(args.log_level, LogLevel::Debug);
            }
            other => panic!("expected merge, got {other:?}"),
        }
    }
}
