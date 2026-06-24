use serde::Serialize;
use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, State};

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

#[tauri::command]
pub fn timer_schedule_deadline(
    app: AppHandle,
    state: State<'_, NativeTimerState>,
    deadline_at_ms: u64,
) -> Result<u64, String> {
    let token_source = state.current_token.clone();
    let token = token_source.fetch_add(1, Ordering::SeqCst) + 1;
    let delay_ms = deadline_at_ms.saturating_sub(now_ms()?);

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
