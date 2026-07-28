use std::sync::Mutex;
use tauri::image::Image;
use tauri::{tray::TrayIcon, Emitter, Manager};

const MENUBAR_ICON_SIZE: u32 = 32;
const MENUBAR_RING_CENTER: f32 = MENUBAR_ICON_SIZE as f32 / 2.0;
const MENUBAR_RING_RADIUS: f32 = 9.5;
const MENUBAR_RING_HALF_STROKE: f32 = 2.0;
const MENUBAR_RING_TRACK_HALF_STROKE: f32 = 0.75;
const MENUBAR_RING_TRACK_ALPHA: u8 = 128;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MenubarTimerProgress {
    Full,
    ThreeQuarters,
    Half,
    Quarter,
}

fn set_pixel(rgba: &mut [u8], x: u32, y: u32) {
    set_pixel_with_alpha(rgba, x, y, u8::MAX);
}

fn set_pixel_with_alpha(rgba: &mut [u8], x: u32, y: u32, alpha: u8) {
    if x >= MENUBAR_ICON_SIZE || y >= MENUBAR_ICON_SIZE {
        return;
    }

    let index = ((y * MENUBAR_ICON_SIZE + x) * 4) as usize;
    rgba[index] = 0;
    rgba[index + 1] = 0;
    rgba[index + 2] = 0;
    rgba[index + 3] = rgba[index + 3].max(alpha);
}

fn draw_ring_track(rgba: &mut [u8]) {
    let inner_radius = MENUBAR_RING_RADIUS - MENUBAR_RING_TRACK_HALF_STROKE;
    let outer_radius = MENUBAR_RING_RADIUS + MENUBAR_RING_TRACK_HALF_STROKE;

    for y in 0..MENUBAR_ICON_SIZE {
        for x in 0..MENUBAR_ICON_SIZE {
            let dx = x as f32 + 0.5 - MENUBAR_RING_CENTER;
            let dy = y as f32 + 0.5 - MENUBAR_RING_CENTER;
            let radius_squared = dx * dx + dy * dy;
            if radius_squared >= inner_radius * inner_radius
                && radius_squared <= outer_radius * outer_radius
            {
                set_pixel_with_alpha(rgba, x, y, MENUBAR_RING_TRACK_ALPHA);
            }
        }
    }
}

fn draw_ring_cap(rgba: &mut [u8], center_x: f32, center_y: f32) {
    for y in 0..MENUBAR_ICON_SIZE {
        for x in 0..MENUBAR_ICON_SIZE {
            let dx = x as f32 + 0.5 - center_x;
            let dy = y as f32 + 0.5 - center_y;
            if dx * dx + dy * dy <= MENUBAR_RING_HALF_STROKE * MENUBAR_RING_HALF_STROKE {
                set_pixel(rgba, x, y);
            }
        }
    }
}

fn draw_remaining_ring(rgba: &mut [u8], progress: MenubarTimerProgress) {
    let remaining_quarters = match progress {
        MenubarTimerProgress::Full => 4,
        MenubarTimerProgress::ThreeQuarters => 3,
        MenubarTimerProgress::Half => 2,
        MenubarTimerProgress::Quarter => 1,
    };
    let arc_end = std::f32::consts::TAU * remaining_quarters as f32 / 4.0;
    let inner_radius = MENUBAR_RING_RADIUS - MENUBAR_RING_HALF_STROKE;
    let outer_radius = MENUBAR_RING_RADIUS + MENUBAR_RING_HALF_STROKE;

    for y in 0..MENUBAR_ICON_SIZE {
        for x in 0..MENUBAR_ICON_SIZE {
            let dx = x as f32 + 0.5 - MENUBAR_RING_CENTER;
            let dy = y as f32 + 0.5 - MENUBAR_RING_CENTER;
            let radius_squared = dx * dx + dy * dy;
            if radius_squared < inner_radius * inner_radius
                || radius_squared > outer_radius * outer_radius
            {
                continue;
            }

            let angle = dx.atan2(-dy).rem_euclid(std::f32::consts::TAU);
            if remaining_quarters == 4 || angle <= arc_end {
                set_pixel(rgba, x, y);
            }
        }
    }

    if remaining_quarters < 4 {
        let end_x = MENUBAR_RING_CENTER + MENUBAR_RING_RADIUS * arc_end.sin();
        let end_y = MENUBAR_RING_CENTER - MENUBAR_RING_RADIUS * arc_end.cos();
        draw_ring_cap(
            rgba,
            MENUBAR_RING_CENTER,
            MENUBAR_RING_CENTER - MENUBAR_RING_RADIUS,
        );
        draw_ring_cap(rgba, end_x, end_y);
    }
}

fn menubar_progress_icon(progress: MenubarTimerProgress) -> Image<'static> {
    let mut rgba = vec![0; (MENUBAR_ICON_SIZE * MENUBAR_ICON_SIZE * 4) as usize];
    draw_ring_track(&mut rgba);
    draw_remaining_ring(&mut rgba, progress);

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
    use super::{
        menubar_progress_icon, MenubarTimerProgress, MENUBAR_RING_TRACK_ALPHA,
    };

    fn alpha_at(progress: MenubarTimerProgress, x: u32, y: u32) -> u8 {
        let image = menubar_progress_icon(progress);
        let index = ((y * image.width() + x) * 4) as usize;
        image.rgba()[index + 3]
    }

    #[test]
    fn draws_four_distinct_remaining_time_rings() {
        assert_eq!(alpha_at(MenubarTimerProgress::Full, 15, 15), 0);
        assert_eq!(alpha_at(MenubarTimerProgress::Full, 11, 7), u8::MAX);
        assert_eq!(
            alpha_at(MenubarTimerProgress::ThreeQuarters, 11, 7),
            MENUBAR_RING_TRACK_ALPHA
        );

        assert_eq!(
            alpha_at(MenubarTimerProgress::ThreeQuarters, 7, 20),
            u8::MAX
        );
        assert_eq!(
            alpha_at(MenubarTimerProgress::Half, 7, 20),
            MENUBAR_RING_TRACK_ALPHA
        );

        assert_eq!(alpha_at(MenubarTimerProgress::Half, 24, 20), u8::MAX);
        assert_eq!(
            alpha_at(MenubarTimerProgress::Quarter, 24, 20),
            MENUBAR_RING_TRACK_ALPHA
        );
        assert_eq!(alpha_at(MenubarTimerProgress::Quarter, 20, 7), u8::MAX);
    }
}
