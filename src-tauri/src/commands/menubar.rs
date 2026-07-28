use std::sync::Mutex;
use tauri::image::Image;
use tauri::{tray::TrayIcon, Emitter, Manager};

const MENUBAR_ICON_SIZE: u32 = 32;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MenubarTimerProgress {
    Full,
    ThreeQuarters,
    Half,
    Empty,
}

fn set_pixel(rgba: &mut [u8], x: u32, y: u32) {
    if x >= MENUBAR_ICON_SIZE || y >= MENUBAR_ICON_SIZE {
        return;
    }

    let index = ((y * MENUBAR_ICON_SIZE + x) * 4) as usize;
    rgba[index] = 0;
    rgba[index + 1] = 0;
    rgba[index + 2] = 0;
    rgba[index + 3] = u8::MAX;
}

fn fill_row(rgba: &mut [u8], y: u32, left: u32, right: u32) {
    for x in left..=right {
        set_pixel(rgba, x, y);
    }
}

fn fill_upper_sand(rgba: &mut [u8], rows: u32) {
    for step in 0..rows.min(6) {
        fill_row(rgba, 8 + step, 10 + step, 21 - step);
    }
}

fn fill_lower_sand(rgba: &mut [u8], rows: u32) {
    for step in 0..rows.min(6) {
        fill_row(rgba, 23 - step, 10 + step, 21 - step);
    }
}

fn menubar_progress_icon(progress: MenubarTimerProgress) -> Image<'static> {
    let mut rgba = vec![0; (MENUBAR_ICON_SIZE * MENUBAR_ICON_SIZE * 4) as usize];

    for y in 5..=7 {
        fill_row(&mut rgba, y, 7, 24);
    }
    for y in 24..=26 {
        fill_row(&mut rgba, y, 7, 24);
    }

    for step in 0..=7 {
        let upper_y = 8 + step;
        set_pixel(&mut rgba, 9 + step, upper_y);
        set_pixel(&mut rgba, 22 - step, upper_y);

        let lower_y = 16 + step;
        set_pixel(&mut rgba, 16 - step, lower_y);
        set_pixel(&mut rgba, 15 + step, lower_y);
    }

    let (upper_sand_rows, lower_sand_rows) = match progress {
        MenubarTimerProgress::Full => (6, 0),
        MenubarTimerProgress::ThreeQuarters => (4, 2),
        MenubarTimerProgress::Half => (2, 4),
        MenubarTimerProgress::Empty => (0, 6),
    };
    fill_upper_sand(&mut rgba, upper_sand_rows);
    fill_lower_sand(&mut rgba, lower_sand_rows);

    Image::new_owned(rgba, MENUBAR_ICON_SIZE, MENUBAR_ICON_SIZE)
}

pub struct MenubarState {
    pub tray: Mutex<Option<TrayIcon>>,
}

impl MenubarState {
    pub fn new() -> Self {
        Self {
            tray: Mutex::new(None),
        }
    }

    pub fn set_title(&self, title: &str) -> Result<(), String> {
        let tray = self
            .tray
            .lock()
            .map_err(|_| "菜单栏状态不可用".to_string())?;

        if let Some(tray) = tray.as_ref() {
            tray.set_title(Some(title)).map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    pub fn set_timer_progress(&self, progress: MenubarTimerProgress) -> Result<(), String> {
        let tray = self
            .tray
            .lock()
            .map_err(|_| "菜单栏状态不可用".to_string())?;

        if let Some(tray) = tray.as_ref() {
            tray.set_icon_with_as_template(Some(menubar_progress_icon(progress)), true)
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    }
}

#[tauri::command]
pub fn menubar_show(state: tauri::State<'_, MenubarState>) -> Result<(), String> {
    if let Ok(tray) = state.tray.lock() {
        if let Some(tray) = tray.as_ref() {
            let _ = tray.set_visible(true);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn menubar_hide(state: tauri::State<'_, MenubarState>) -> Result<(), String> {
    if let Ok(tray) = state.tray.lock() {
        if let Some(tray) = tray.as_ref() {
            let _ = tray.set_visible(false);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn menubar_set_title(
    state: tauri::State<'_, MenubarState>,
    title: String,
) -> Result<(), String> {
    state.set_title(&title)
}

#[tauri::command]
pub fn menubar_set_tooltip(
    state: tauri::State<'_, MenubarState>,
    tooltip: String,
) -> Result<(), String> {
    if let Ok(tray) = state.tray.lock() {
        if let Some(tray) = tray.as_ref() {
            tray.set_tooltip(Some(tooltip)).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn setup_menubar_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::TrayIconBuilder,
    };

    let show_item = MenuItem::with_id(
        app,
        "menubar-show",
        "显示 Time-butler",
        true,
        None::<&str>,
    )?;
    let toggle_item =
        MenuItem::with_id(app, "menubar-toggle", "暂停 / 继续", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(
        app,
        "menubar-quit",
        "退出 Time-butler",
        true,
        None::<&str>,
    )?;

    let menu = Menu::with_items(app, &[&show_item, &toggle_item, &separator, &quit_item])?;

    let tray = TrayIconBuilder::with_id("menubar-tray")
        .icon(menubar_progress_icon(MenubarTimerProgress::Full))
        .icon_as_template(true)
        .menu(&menu)
        .tooltip("Time-butler")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "menubar-show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "menubar-toggle" => {
                let _ = app.emit("hotkey:toggle-timer", ());
            }
            "menubar-quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    if let Some(state) = app.try_state::<MenubarState>() {
        if let Ok(mut handle) = state.tray.lock() {
            *handle = Some(tray);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{menubar_progress_icon, MenubarTimerProgress};

    fn is_opaque(progress: MenubarTimerProgress, x: u32, y: u32) -> bool {
        let image = menubar_progress_icon(progress);
        let index = ((y * image.width() + x) * 4) as usize;
        image.rgba()[index + 3] > 0
    }

    #[test]
    fn draws_four_distinct_hourglass_fill_levels() {
        assert!(is_opaque(MenubarTimerProgress::Full, 15, 11));
        assert!(is_opaque(MenubarTimerProgress::ThreeQuarters, 15, 11));
        assert!(!is_opaque(MenubarTimerProgress::Half, 15, 11));
        assert!(!is_opaque(MenubarTimerProgress::Empty, 15, 11));

        assert!(!is_opaque(MenubarTimerProgress::ThreeQuarters, 15, 21));
        assert!(is_opaque(MenubarTimerProgress::Half, 15, 21));
        assert!(is_opaque(MenubarTimerProgress::Empty, 15, 21));

        assert!(!is_opaque(MenubarTimerProgress::Half, 15, 18));
        assert!(is_opaque(MenubarTimerProgress::Empty, 15, 18));
    }
}
