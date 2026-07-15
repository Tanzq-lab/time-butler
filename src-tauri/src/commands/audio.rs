use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

#[cfg(target_os = "macos")]
use std::{
    path::Path,
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};

const REPEAT_INTERVAL_MS: u64 = 2_000;

#[cfg(target_os = "macos")]
const SYSTEM_SOUND_PATH: &str = "/System/Library/Sounds/Glass.aiff";

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
    state: tauri::State<'_, NativeAudioState>,
    repeat: bool,
) -> Result<u64, String> {
    #[cfg(target_os = "macos")]
    {
        play_macos_notification_audio(state, repeat)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = state;
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
    state: tauri::State<'_, NativeAudioState>,
    repeat: bool,
) -> Result<u64, String> {
    if !Path::new(SYSTEM_SOUND_PATH).is_file() {
        return Err(format!("notification sound not found: {SYSTEM_SOUND_PATH}"));
    }

    let token_source = state.current_token.clone();
    let token = token_source.fetch_add(1, Ordering::SeqCst) + 1;
    let first_child = spawn_system_sound()?;

    thread::spawn(move || {
        run_audio_worker(first_child, token_source, token, repeat);
    });

    Ok(token)
}

#[cfg(target_os = "macos")]
fn spawn_system_sound() -> Result<Child, String> {
    Command::new("/usr/bin/afplay")
        .arg(SYSTEM_SOUND_PATH)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("failed to start native notification audio: {error}"))
}

#[cfg(target_os = "macos")]
fn run_audio_worker(
    mut child: Child,
    token_source: Arc<AtomicU64>,
    token: u64,
    repeat: bool,
) {
    loop {
        let cycle_started_at = Instant::now();
        if !wait_for_sound_or_cancel(&mut child, &token_source, token) || !repeat {
            return;
        }

        let repeat_interval = Duration::from_millis(REPEAT_INTERVAL_MS);
        while cycle_started_at.elapsed() < repeat_interval {
            if token_source.load(Ordering::SeqCst) != token {
                return;
            }
            thread::sleep(Duration::from_millis(25));
        }

        if token_source.load(Ordering::SeqCst) != token {
            return;
        }

        match spawn_system_sound() {
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
            Ok(None) => thread::sleep(Duration::from_millis(25)),
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
    fn bundled_macos_system_sound_exists() {
        assert!(Path::new(SYSTEM_SOUND_PATH).is_file());
    }
}
