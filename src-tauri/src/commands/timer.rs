use crate::commands::menubar::MenubarState;
use serde::Serialize;
use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

const TIMER_DEADLINE_REACHED_EVENT: &str = "timer:deadline-reached";

#[derive(Clone)]
pub struct NativeTimerState {
    current_token: Arc<AtomicU64>,
}

impl NativeTimerState {
    pub fn new() -> Self {
        Self {
            current_token: Arc::new(AtomicU64::new(0)),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TimerDeadlinePayload {
    token: u64,
    deadline_at_ms: u64,
}

fn now_ms() -> Result<u64, String> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?;
    Ok(duration.as_millis() as u64)
}

fn remaining_seconds(deadline_at_ms: u64, current_time_ms: u64) -> u64 {
    deadline_at_ms
        .saturating_sub(current_time_ms)
        .saturating_add(999)
        / 1_000
}

fn format_remaining(seconds: u64) -> String {
    format!("{:02}:{:02}", seconds / 60, seconds % 60)
}

fn milliseconds_until_next_second(deadline_at_ms: u64, current_time_ms: u64) -> u64 {
    let remaining_ms = deadline_at_ms.saturating_sub(current_time_ms);
    let remainder = remaining_ms % 1_000;

    if remainder == 0 { 1_000 } else { remainder }
}

fn update_menubar_title(
    app: AppHandle,
    token_source: Arc<AtomicU64>,
    token: u64,
    title: String,
) {
    let _ = app.clone().run_on_main_thread(move || {
        if token_source.load(Ordering::SeqCst) != token {
            return;
        }

        if let Some(menubar) = app.try_state::<MenubarState>() {
            let _ = menubar.set_title(&title);
        }
    });
}

fn spawn_menubar_countdown(
    app: AppHandle,
    token_source: Arc<AtomicU64>,
    token: u64,
    deadline_at_ms: u64,
) {
    thread::spawn(move || loop {
        if token_source.load(Ordering::SeqCst) != token {
            return;
        }

        let current_time_ms = match now_ms() {
            Ok(value) => value,
            Err(_) => return,
        };
        let seconds = remaining_seconds(deadline_at_ms, current_time_ms);
        update_menubar_title(
            app.clone(),
            token_source.clone(),
            token,
            format_remaining(seconds),
        );

        if seconds == 0 {
            return;
        }

        thread::sleep(Duration::from_millis(milliseconds_until_next_second(
            deadline_at_ms,
            current_time_ms,
        )));
    });
}

#[tauri::command]
pub fn timer_schedule_deadline(
    app: AppHandle,
    state: State<'_, NativeTimerState>,
    deadline_at_ms: u64,
) -> Result<u64, String> {
    let token_source = state.current_token.clone();
    let token = token_source.fetch_add(1, Ordering::SeqCst) + 1;
    let delay_ms = deadline_at_ms.saturating_sub(now_ms()?);
    spawn_menubar_countdown(
        app.clone(),
        token_source.clone(),
        token,
        deadline_at_ms,
    );

    thread::spawn(move || {
        if delay_ms > 0 {
            thread::sleep(Duration::from_millis(delay_ms));
        }

        if token_source.load(Ordering::SeqCst) == token {
            let _ = app.emit(
                TIMER_DEADLINE_REACHED_EVENT,
                TimerDeadlinePayload {
                    token,
                    deadline_at_ms,
                },
            );
        }
    });

    Ok(token)
}

#[tauri::command]
pub fn timer_cancel_deadline(state: State<'_, NativeTimerState>) -> Result<(), String> {
    state.current_token.fetch_add(1, Ordering::SeqCst);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{format_remaining, milliseconds_until_next_second, remaining_seconds};

    #[test]
    fn formats_menu_bar_countdown_like_the_frontend() {
        assert_eq!(format_remaining(0), "00:00");
        assert_eq!(format_remaining(12 * 60 + 20), "12:20");
        assert_eq!(format_remaining(100 * 60), "100:00");
    }

    #[test]
    fn derives_remaining_seconds_from_the_absolute_deadline() {
        assert_eq!(remaining_seconds(10_000, 8_001), 2);
        assert_eq!(remaining_seconds(10_000, 9_000), 1);
        assert_eq!(remaining_seconds(10_000, 10_000), 0);
        assert_eq!(remaining_seconds(10_000, 12_000), 0);
    }

    #[test]
    fn waits_until_the_next_display_second() {
        assert_eq!(milliseconds_until_next_second(10_000, 8_001), 999);
        assert_eq!(milliseconds_until_next_second(10_000, 9_000), 1_000);
    }
}
