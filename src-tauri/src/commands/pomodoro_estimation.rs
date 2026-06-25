use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::io::Write;

use super::private_data::{private_data_root, workspace_root};

#[tauri::command]
pub fn read_pomodoro_estimation_memo() -> Result<String, String> {
    let path = workspace_root().join("docs").join("pomodoro-estimation-memo.md");
    fs::read_to_string(&path).map_err(|e| format!("{}: {}", path.display(), e))
}

#[tauri::command]
pub fn append_pomodoro_estimation_log(event: Value) -> Result<(), String> {
    let dir = private_data_root()?.join("data");
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
    let path = private_data_root()?
        .join("data")
        .join("pomodoro-estimation-log.jsonl");

    if !path.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(&path).map_err(|e| format!("{}: {}", path.display(), e))
}
