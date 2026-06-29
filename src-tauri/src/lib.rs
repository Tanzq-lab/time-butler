mod commands;

use commands::menubar::{setup_menubar_tray, MenubarState};
use commands::timer::NativeTimerState;
use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::DECORATIONS
                        | StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::hotkey::register_hotkey,
            commands::hotkey::unregister_hotkey,
            commands::menubar::menubar_show,
            commands::menubar::menubar_hide,
            commands::menubar::menubar_set_title,
            commands::menubar::menubar_set_tooltip,
            commands::music::control_netease_music,
            commands::pomodoro_estimation::read_pomodoro_estimation_memo,
            commands::pomodoro_estimation::append_pomodoro_estimation_log,
            commands::pomodoro_estimation::read_pomodoro_estimation_log,
            commands::private_data::private_database_url,
            commands::private_data::private_data_root_path,
            commands::timer::timer_schedule_deadline,
            commands::timer::timer_cancel_deadline,
        ])
        .manage(MenubarState::new())
        .manage(NativeTimerState::new())
        .setup(|app| {
            setup_menubar_tray(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| {
        #[cfg(desktop)]
        if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
            if code.is_none() {
                api.prevent_exit();
            }
        }
    });
}
