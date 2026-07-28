use crate::commands::menubar::{MenubarState, MenubarTimerProgress};
use serde::Serialize;
use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

const TIMER_DEADLINE_REACHED_EVENT: &str = "timer:deadline-reached";
const MENUBAR_FOCUS_TITLE_WIDTH: usize = 12;
const MENUBAR_FOCUS_TITLE_GAP: &str = " · ";

#[derive(Clone)]
pub struct NativeTimerState {
    current_token: Arc<AtomicU64>,
    focus_title: Arc<Mutex<Option<String>>>,
}

impl NativeTimerState {
    pub fn new() -> Self {
        Self {
            current_token: Arc::new(AtomicU64::new(0)),
            focus_title: Arc::new(Mutex::new(None)),
        }
    }

    fn set_focus_title(&self, title: Option<String>) {
        if let Ok(mut focus_title) = self.focus_title.lock() {
            *focus_title = title.filter(|value| !value.trim().is_empty());
        }
    }

    fn focus_title(&self) -> Option<String> {
        self.focus_title
            .lock()
            .ok()
            .and_then(|title| title.clone())
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

fn format_focus_title(title: &str, offset: usize) -> String {
    let title = title.trim();
    if title.is_empty() {
        return "专注中".to_string();
    }

    let title_chars: Vec<char> = title.chars().collect();
    if title_chars.len() <= MENUBAR_FOCUS_TITLE_WIDTH {
        return title.to_string();
    }

    let mut marquee = title_chars;
    marquee.extend(MENUBAR_FOCUS_TITLE_GAP.chars());
    (0..MENUBAR_FOCUS_TITLE_WIDTH)
        .map(|index| marquee[(offset + index) % marquee.len()])
        .collect()
}

fn menubar_timer_progress(total_seconds: u64, remaining_seconds: u64) -> MenubarTimerProgress {
    if total_seconds == 0 {
        return MenubarTimerProgress::Full;
    }

    let elapsed_seconds = total_seconds.saturating_sub(remaining_seconds.min(total_seconds));
    match elapsed_seconds.saturating_mul(4) / total_seconds {
        0 => MenubarTimerProgress::Full,
        1 => MenubarTimerProgress::ThreeQuarters,
        2 => MenubarTimerProgress::Half,
        _ => MenubarTimerProgress::Empty,
    }
}

fn milliseconds_until_next_second(deadline_at_ms: u64, current_time_ms: u64) -> u64 {
    let remaining_ms = deadline_at_ms.saturating_sub(current_time_ms);
    let remainder = remaining_ms % 1_000;

    if remainder == 0 { 1_000 } else { remainder }
}

fn update_menubar_status(
    app: AppHandle,
    token_source: Arc<AtomicU64>,
    token: u64,
    title: String,
    progress: MenubarTimerProgress,
) {
    let _ = app.clone().run_on_main_thread(move || {
        if token_source.load(Ordering::SeqCst) != token {
            return;
        }

        if let Some(menubar) = app.try_state::<MenubarState>() {
            let _ = menubar.set_title(&title);
            let _ = menubar.set_timer_progress(progress);
        }
    });
}

fn spawn_menubar_status(
    app: AppHandle,
    token_source: Arc<AtomicU64>,
    focus_title_source: Arc<Mutex<Option<String>>>,
    token: u64,
    deadline_at_ms: u64,
    total_seconds: u64,
) {
    thread::spawn(move || {
        let mut marquee_offset = 0;
        loop {
            if token_source.load(Ordering::SeqCst) != token {
                return;
            }

            let current_time_ms = match now_ms() {
                Ok(value) => value,
                Err(_) => return,
            };
            let seconds = remaining_seconds(deadline_at_ms, current_time_ms);
            let title = focus_title_source
                .lock()
                .ok()
                .and_then(|focus_title| focus_title.clone())
                .map(|focus_title| {
                    let title = format_focus_title(&focus_title, marquee_offset);
                    marquee_offset = marquee_offset.wrapping_add(1);
                    title
                })
                .unwrap_or_else(|| format_remaining(seconds));
            update_menubar_status(
                app.clone(),
                token_source.clone(),
                token,
                title,
                menubar_timer_progress(total_seconds, seconds),
            );

            if seconds == 0 {
                return;
            }

            thread::sleep(Duration::from_millis(milliseconds_until_next_second(
                deadline_at_ms,
                current_time_ms,
            )));
        }
    });
}

#[tauri::command]
pub fn timer_schedule_deadline(
    app: AppHandle,
    state: State<'_, NativeTimerState>,
    deadline_at_ms: u64,
    focus_title: Option<String>,
    total_seconds: u64,
) -> Result<u64, String> {
    let token_source = state.current_token.clone();
    let token = token_source.fetch_add(1, Ordering::SeqCst) + 1;
    let delay_ms = deadline_at_ms.saturating_sub(now_ms()?);
    state.set_focus_title(focus_title);
    spawn_menubar_status(
        app.clone(),
        token_source.clone(),
        state.focus_title.clone(),
        token,
        deadline_at_ms,
        total_seconds,
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
pub fn timer_set_menubar_focus_title(
    app: AppHandle,
    state: State<'_, NativeTimerState>,
    title: Option<String>,
) -> Result<(), String> {
    state.set_focus_title(title);

    if let Some(focus_title) = state.focus_title() {
        if let Some(menubar) = app.try_state::<MenubarState>() {
            menubar.set_title(&format_focus_title(&focus_title, 0))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn timer_cancel_deadline(state: State<'_, NativeTimerState>) -> Result<(), String> {
    state.current_token.fetch_add(1, Ordering::SeqCst);
    state.set_focus_title(None);
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::commands::menubar::MenubarTimerProgress;

    use super::{
        format_focus_title,
        format_remaining,
        menubar_timer_progress,
        milliseconds_until_next_second,
        remaining_seconds,
    };

    #[test]
    fn formats_menu_bar_countdown_like_the_frontend() {
        assert_eq!(format_remaining(0), "00:00");
        assert_eq!(format_remaining(12 * 60 + 20), "12:20");
        assert_eq!(format_remaining(100 * 60), "100:00");
    }

    #[test]
    fn keeps_short_focus_titles_static_and_scrolls_long_titles() {
        assert_eq!(format_focus_title("写周报", 0), "写周报");

        let first_frame = format_focus_title("整理 AI 生成 2D 游戏需求原点", 0);
        let next_frame = format_focus_title("整理 AI 生成 2D 游戏需求原点", 1);
        assert_eq!(first_frame.chars().count(), 12);
        assert_eq!(next_frame.chars().count(), 12);
        assert_ne!(first_frame, next_frame);
    }

    #[test]
    fn maps_elapsed_time_to_four_hourglass_states() {
        assert_eq!(menubar_timer_progress(100, 100), MenubarTimerProgress::Full);
        assert_eq!(
            menubar_timer_progress(100, 74),
            MenubarTimerProgress::ThreeQuarters,
        );
        assert_eq!(menubar_timer_progress(100, 49), MenubarTimerProgress::Half);
        assert_eq!(menubar_timer_progress(100, 24), MenubarTimerProgress::Empty);
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
