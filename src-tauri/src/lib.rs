mod commands;
mod git;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_repository,
            commands::load_commits,
            commands::load_refs,
            commands::load_status,
            commands::load_commit_details,
            commands::load_commit_file_diff,
            commands::load_working_file_diff,
            commands::stage_files,
            commands::unstage_files,
            commands::create_commit,
            commands::checkout_branch,
            commands::checkout_remote_branch,
            commands::checkout_commit,
            commands::create_branch,
            commands::launch_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
