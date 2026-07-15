use serde::Deserialize;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

#[cfg(target_os = "macos")]
use std::{
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    thread,
    time::Duration,
};

#[cfg(target_os = "macos")]
use tauri::{path::BaseDirectory, AppHandle, Manager};

#[cfg(target_os = "macos")]
const SYSTEM_SOUND_PATH: &str = "/System/Library/Sounds/Glass.aiff";
#[cfg(target_os = "macos")]
const BREAK_OVER_SOUND_RESOURCE: &str = "sounds/simple-happy-beep.ogg";
#[cfg(target_os = "macos")]
const DEFAULT_VOLUME: f32 = 1.0;
#[cfg(target_os = "macos")]
const BREAK_OVER_VOLUME: f32 = 1.45;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeNotificationSound {
    Chime,
    BreakOver,
}

#[derive(Clone)]
pub struct NativeAudioState {
    current_token: Arc<AtomicU64>,
}

impl NativeAudioState {
    pub fn new() -> Self {
        Self {
            current_token: Arc::new(AtomicU64::new(0)),
        }
    }
}

#[tauri::command]
pub fn notification_audio_play(
    app: tauri::AppHandle,
    state: tauri::State<'_, NativeAudioState>,
    kind: NativeNotificationSound,
    repeat: bool,
) -> Result<u64, String> {
    #[cfg(target_os = "macos")]
    {
        play_macos_notification_audio(&app, state, kind, repeat)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let _ = state;
        let _ = kind;
        let _ = repeat;
        Err("Native notification audio is only supported on macOS.".to_string())
    }
}

#[tauri::command]
pub fn notification_audio_stop(state: tauri::State<'_, NativeAudioState>) -> Result<(), String> {
    state.current_token.fetch_add(1, Ordering::SeqCst);
    Ok(())
}

#[cfg(target_os = "macos")]
fn play_macos_notification_audio(
    app: &AppHandle,
    state: tauri::State<'_, NativeAudioState>,
    kind: NativeNotificationSound,
    repeat: bool,
) -> Result<u64, String> {
    let (sound_path, volume) = resolve_sound(app, kind)?;
    if !sound_path.is_file() {
        return Err(format!(
            "notification sound not found: {}",
            sound_path.display()
        ));
    }

    let token_source = state.current_token.clone();
    let token = token_source.fetch_add(1, Ordering::SeqCst) + 1;
    let first_child = spawn_sound(&sound_path, volume)?;

    thread::spawn(move || {
        run_audio_worker(
            first_child,
            sound_path,
            volume,
            token_source,
            token,
            repeat,
        );
    });

    Ok(token)
}

#[cfg(target_os = "macos")]
fn resolve_sound(
    app: &AppHandle,
    kind: NativeNotificationSound,
) -> Result<(PathBuf, f32), String> {
    match kind {
        NativeNotificationSound::Chime => {
            Ok((PathBuf::from(SYSTEM_SOUND_PATH), DEFAULT_VOLUME))
        }
        NativeNotificationSound::BreakOver => app
            .path()
            .resolve(BREAK_OVER_SOUND_RESOURCE, BaseDirectory::Resource)
            .map(|path| (path, BREAK_OVER_VOLUME))
            .map_err(|error| format!("failed to resolve break-over sound: {error}")),
    }
}

#[cfg(target_os = "macos")]
fn spawn_sound(sound_path: &Path, volume: f32) -> Result<Child, String> {
    Command::new("/usr/bin/afplay")
        .arg("--volume")
        .arg(volume.to_string())
        .arg(sound_path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("failed to start native notification audio: {error}"))
}

#[cfg(target_os = "macos")]
fn run_audio_worker(
    mut child: Child,
    sound_path: PathBuf,
    volume: f32,
    token_source: Arc<AtomicU64>,
    token: u64,
    repeat: bool,
) {
    loop {
        if !wait_for_sound_or_cancel(&mut child, &token_source, token) || !repeat {
            return;
        }

        if token_source.load(Ordering::SeqCst) != token {
            return;
        }

        match spawn_sound(&sound_path, volume) {
            Ok(next_child) => child = next_child,
            Err(_) => return,
        }
    }
}

#[cfg(target_os = "macos")]
fn wait_for_sound_or_cancel(
    child: &mut Child,
    token_source: &AtomicU64,
    token: u64,
) -> bool {
    loop {
        if token_source.load(Ordering::SeqCst) != token {
            let _ = child.kill();
            let _ = child.wait();
            return false;
        }

        match child.try_wait() {
            Ok(Some(status)) => return status.success(),
            Ok(None) => thread::sleep(Duration::from_millis(10)),
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return false;
            }
        }
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn macos_system_chime_exists() {
        assert!(Path::new(SYSTEM_SOUND_PATH).is_file());
    }

    #[test]
    fn original_break_over_sound_source_exists() {
        let source_path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../src/assets/sounds/simple-happy-beep.ogg");
        assert!(source_path.is_file());
    }
}
