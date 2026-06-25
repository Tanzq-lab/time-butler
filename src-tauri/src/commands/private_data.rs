use std::fs;
use std::path::PathBuf;

const DATA_DIR_NAME: &str = "time-butler-data";
const DB_FILE_NAME: &str = "Kairos-Pomodoro.db";

#[tauri::command]
pub fn private_database_url() -> Result<String, String> {
    let root = private_data_root()?;
    fs::create_dir_all(root.join("data")).map_err(|e| e.to_string())?;
    fs::create_dir_all(root.join("backups")).map_err(|e| e.to_string())?;
    Ok(format!("sqlite:{}", root.join(DB_FILE_NAME).display()))
}

#[tauri::command]
pub fn private_data_root_path() -> Result<String, String> {
    Ok(private_data_root()?.display().to_string())
}

pub fn private_data_root() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("TIME_BUTLER_DATA_DIR") {
        if !dir.trim().is_empty() {
            return Ok(PathBuf::from(dir));
        }
    }

    let workspace = workspace_root();
    if let Some(parent) = workspace.parent() {
        let sibling = parent.join(DATA_DIR_NAME);
        if sibling.exists() || workspace.join("package.json").exists() {
            return Ok(sibling);
        }
    }

    let home = std::env::var("HOME")
        .map(PathBuf::from)
        .map_err(|_| "Cannot resolve HOME for private data root".to_string())?;
    Ok(home.join(DATA_DIR_NAME))
}

pub fn workspace_root() -> PathBuf {
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
