use serde::Deserialize;
use std::sync::atomic::{AtomicU64, Ordering};

#[cfg(target_os = "macos")]
use std::{
    fs::File,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
};

#[cfg(target_os = "macos")]
use rodio::{Decoder, DeviceSinkBuilder, MixerDeviceSink, Player};
#[cfg(target_os = "macos")]
use tauri::{path::BaseDirectory, AppHandle, Manager};

#[cfg(target_os = "macos")]
const SYSTEM_SOUND_PATH: &str = "/System/Library/Sounds/Glass.aiff";
#[cfg(target_os = "macos")]
const BREAK_OVER_SOUND_RESOURCE: &str = "sounds/simple-happy-beep.ogg";
#[cfg(target_os = "macos")]
const BREAK_OVER_VOLUME: f32 = 1.45;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeNotificationSound {
    Chime,
    BreakOver,
}

#[cfg(target_os = "macos")]
struct NativePlayback {
    _device_sink: MixerDeviceSink,
    player: Player,
}

pub struct NativeAudioState {
    current_token: AtomicU64,
    #[cfg(target_os = "macos")]
    playback: Mutex<Option<NativePlayback>>,
}

impl NativeAudioState {
    pub fn new() -> Self {
        Self {
            current_token: AtomicU64::new(0),
            #[cfg(target_os = "macos")]
            playback: Mutex::new(None),
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
    let token = state.current_token.fetch_add(1, Ordering::SeqCst) + 1;

    #[cfg(target_os = "macos")]
    {
        match kind {
            NativeNotificationSound::Chime => {
                stop_current_playback(&state)?;
                play_macos_system_chime()?;
            }
            NativeNotificationSound::BreakOver => {
                let sound_path = resolve_break_over_sound(&app)?;
                let playback = create_break_over_playback(&sound_path, repeat)?;
                start_playback_if_current(&state, playback, token)?;
            }
        }
        Ok(token)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let _ = state;
        let _ = kind;
        let _ = repeat;
        let _ = token;
        Err("Native notification audio is only supported on macOS.".to_string())
    }
}

#[tauri::command]
pub fn notification_audio_stop(state: tauri::State<'_, NativeAudioState>) -> Result<(), String> {
    state.current_token.fetch_add(1, Ordering::SeqCst);

    #[cfg(target_os = "macos")]
    stop_current_playback(&state)?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn resolve_break_over_sound(app: &AppHandle) -> Result<PathBuf, String> {
    let sound_path = app
        .path()
        .resolve(BREAK_OVER_SOUND_RESOURCE, BaseDirectory::Resource)
        .map_err(|error| format!("failed to resolve break-over sound: {error}"))?;

    if !sound_path.is_file() {
        return Err(format!(
            "notification sound not found: {}",
            sound_path.display()
        ));
    }

    Ok(sound_path)
}

#[cfg(target_os = "macos")]
fn play_macos_system_chime() -> Result<(), String> {
    if !Path::new(SYSTEM_SOUND_PATH).is_file() {
        return Err(format!("notification sound not found: {SYSTEM_SOUND_PATH}"));
    }

    Command::new("/usr/bin/afplay")
        .arg(SYSTEM_SOUND_PATH)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("failed to start native notification audio: {error}"))
}

#[cfg(target_os = "macos")]
fn create_break_over_playback(
    sound_path: &Path,
    repeat: bool,
) -> Result<NativePlayback, String> {
    let file = File::open(sound_path)
        .map_err(|error| format!("failed to open break-over sound: {error}"))?;
    let byte_len = file
        .metadata()
        .map_err(|error| format!("failed to inspect break-over sound: {error}"))?
        .len();
    let decoder = Decoder::builder()
        .with_data(file)
        .with_byte_len(byte_len)
        .with_seekable(true)
        .with_hint("ogg")
        .with_gapless(true);

    let mut device_sink = DeviceSinkBuilder::open_default_sink()
        .map_err(|error| format!("failed to open native audio output: {error}"))?;
    device_sink.log_on_drop(false);
    let player = Player::connect_new(device_sink.mixer());
    player.pause();
    player.set_volume(BREAK_OVER_VOLUME);

    if repeat {
        let source = decoder
            .build_looped()
            .map_err(|error| format!("failed to decode looping break-over sound: {error}"))?;
        player.append(source);
    } else {
        let source = decoder
            .build()
            .map_err(|error| format!("failed to decode break-over sound: {error}"))?;
        player.append(source);
    }

    Ok(NativePlayback {
        _device_sink: device_sink,
        player,
    })
}

#[cfg(target_os = "macos")]
fn start_playback_if_current(
    state: &NativeAudioState,
    playback: NativePlayback,
    token: u64,
) -> Result<(), String> {
    let mut active = state
        .playback
        .lock()
        .map_err(|_| "native audio state lock was poisoned".to_string())?;

    if state.current_token.load(Ordering::SeqCst) != token {
        playback.player.stop();
        return Err("native audio playback was cancelled before start".to_string());
    }

    if let Some(previous) = active.take() {
        previous.player.stop();
    }
    playback.player.play();
    *active = Some(playback);
    Ok(())
}

#[cfg(target_os = "macos")]
fn stop_current_playback(state: &NativeAudioState) -> Result<(), String> {
    let mut active = state
        .playback
        .lock()
        .map_err(|_| "native audio state lock was poisoned".to_string())?;
    if let Some(playback) = active.take() {
        playback.player.stop();
    }
    Ok(())
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn macos_system_chime_exists() {
        assert!(Path::new(SYSTEM_SOUND_PATH).is_file());
    }

    #[test]
    fn original_break_over_sound_decodes_as_gapless_loop() {
        let source_path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../src/assets/sounds/simple-happy-beep.ogg");
        let file = File::open(source_path).expect("break-over sound should exist");
        let byte_len = file.metadata().expect("sound metadata should load").len();
        Decoder::builder()
            .with_data(file)
            .with_byte_len(byte_len)
            .with_seekable(true)
            .with_hint("ogg")
            .with_gapless(true)
            .build_looped()
            .expect("break-over sound should decode as a gapless loop");
    }
}
