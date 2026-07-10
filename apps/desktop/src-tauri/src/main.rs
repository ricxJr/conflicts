// Hide the console window in release builds (GUI app), but keep stderr/stdout
// working when launched from a terminal by attaching to the parent console.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli;
mod commands;
mod doctor;
mod encoding;
mod files;
mod git;
mod logging;
mod writer;

use cli::CliCommand;
use commands::AppState;
use std::sync::atomic::Ordering;
use tauri::{Manager, RunEvent};

/// Exit codes (spec §16.3).
mod exit_codes {
    pub const CANCELED: i32 = 1;
    pub const INVALID_ARGS: i32 = 2;
    pub const READ_FAILURE: i32 = 3;
}

#[cfg(windows)]
fn attach_parent_console() {
    use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    unsafe {
        AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

fn main() {
    #[cfg(windows)]
    attach_parent_console();

    let raw_args: Vec<String> = std::env::args().skip(1).collect();
    let command = match cli::parse(&raw_args) {
        Ok(cmd) => cmd,
        Err(message) => {
            eprintln!("mergescope: {message}");
            eprintln!("Run 'mergescope --help' for usage.");
            std::process::exit(exit_codes::INVALID_ARGS);
        }
    };

    let args = match command {
        CliCommand::Help => {
            println!("{}", cli::USAGE);
            std::process::exit(0);
        }
        CliCommand::Version => {
            println!("mergescope {}", env!("CARGO_PKG_VERSION"));
            std::process::exit(0);
        }
        CliCommand::Doctor => {
            std::process::exit(doctor::run());
        }
        CliCommand::Merge(args) => *args,
    };

    logging::init(args.log_level);

    // RF-002: fail fast, never touch the result file on startup errors.
    if let Err(message) = files::validate_inputs(
        args.base.as_deref(),
        &args.current,
        &args.incoming,
        &args.result,
    ) {
        eprintln!("mergescope: {message}");
        logging::error("startup validation failed");
        std::process::exit(exit_codes::READ_FAILURE);
    }

    let state = AppState::new(args.clone());

    let app = tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::open_merge_session,
            commands::save_merge_result,
            commands::set_exit_code,
            commands::exit_app,
            commands::get_preferences,
            commands::save_preferences,
        ])
        .setup(move |app| {
            commands::apply_window_title(&app.handle().clone(), &args);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build the MergeScope application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            // RF-017/RF-018: 0 only after a clean save; closing the window
            // without saving keeps the conflict pending in Git (code 1).
            let code = app_handle
                .try_state::<AppState>()
                .map(|s| s.exit_code.load(Ordering::SeqCst))
                .unwrap_or(exit_codes::CANCELED);
            logging::info(&format!("exiting with code {code}"));
            std::process::exit(code);
        }
    });
}
