//! `mergescope doctor` — environment diagnostics (spec §30.3).

use std::io::Write;
use std::process::Command;

fn git_output(args: &[&str]) -> Option<String> {
    let output = Command::new("git").args(args).output().ok()?;
    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

fn webview2_available() -> bool {
    let candidates = [
        std::env::var_os("ProgramFiles(x86)")
            .map(|p| std::path::PathBuf::from(p).join("Microsoft").join("EdgeWebView")),
        std::env::var_os("ProgramFiles")
            .map(|p| std::path::PathBuf::from(p).join("Microsoft").join("EdgeWebView")),
    ];
    candidates.into_iter().flatten().any(|p| p.is_dir())
}

fn write_test() -> bool {
    let path = std::env::temp_dir().join(format!(".mergescope-doctor-{}.tmp", std::process::id()));
    let ok = std::fs::File::create(&path)
        .and_then(|mut f| f.write_all(b"ok"))
        .is_ok();
    std::fs::remove_file(&path).ok();
    ok
}

pub fn run() -> i32 {
    let version = env!("CARGO_PKG_VERSION");
    let git_version = git_output(&["--version"]);
    let merge_tool = git_output(&["config", "--global", "merge.tool"]);
    let exe_ok = std::env::current_exe().map(|p| p.is_file()).unwrap_or(false);
    let write_ok = write_test();
    let webview_ok = webview2_available();

    println!("MergeScope version: {version}");
    println!(
        "Git executable: {}",
        if git_version.is_some() { "found" } else { "NOT FOUND" }
    );
    if let Some(v) = &git_version {
        println!("Git version: {v}");
    }
    println!(
        "Global merge tool: {}",
        merge_tool.as_deref().unwrap_or("(not configured)")
    );
    println!("Executable path: {}", if exe_ok { "valid" } else { "invalid" });
    println!("Write test: {}", if write_ok { "passed" } else { "FAILED" });
    println!(
        "WebView2: {}",
        if webview_ok { "available" } else { "not detected" }
    );

    let ready = git_version.is_some() && exe_ok && write_ok;
    println!("Status: {}", if ready { "ready" } else { "attention required" });
    if ready {
        0
    } else {
        1
    }
}
