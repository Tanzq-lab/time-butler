use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

#[tauri::command]
pub fn read_pomodoro_estimation_memo() -> Result<String, String> {
    let path = workspace_root().join("docs").join("pomodoro-estimation-memo.md");
    fs::read_to_string(&path).map_err(|e| format!("{}: {}", path.display(), e))
}

#[tauri::command]
pub fn append_pomodoro_estimation_log(event: Value) -> Result<(), String> {
    let dir = workspace_root().join("data");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let path = dir.join("pomodoro-estimation-log.jsonl");
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("{}: {}", path.display(), e))?;

    serde_json::to_writer(&mut file, &event).map_err(|e| e.to_string())?;
    file.write_all(b"\n").map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn read_pomodoro_estimation_log() -> Result<String, String> {
    let path = workspace_root()
        .join("data")
        .join("pomodoro-estimation-log.jsonl");

    if !path.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(&path).map_err(|e| format!("{}: {}", path.display(), e))
}

fn workspace_root() -> PathBuf {
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("package.json").exists() {
            return cwd;
        }

        if let Some(parent) = cwd.parent() {
            if parent.join("package.json").exists() {
                return parent.to_path_buf();
            }
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .map(PathBuf::from)
        .unwrap_or(manifest_dir)
}
