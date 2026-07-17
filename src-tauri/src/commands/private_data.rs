use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const DATA_DIR_NAME: &str = "time-butler-data";
const DB_FILE_NAME: &str = "Time-butler.db";
const LEGACY_DB_FILE_NAME: &str = concat!("Kai", "ros-Pom", "odoro.db");
const CLEANUP_STATE_FILE_NAME: &str = ".runtime-cleanup";
const CLEANUP_INTERVAL_SECS: u64 = 24 * 60 * 60;
const LOG_RETENTION_SECS: u64 = 14 * 24 * 60 * 60;
const BACKUP_RETENTION_SECS: u64 = 30 * 24 * 60 * 60;
const MIN_BACKUPS_TO_KEEP: usize = 5;
const PRIVATE_GITIGNORE_RULES: [&str; 7] = [
    ".DS_Store",
    ".runtime-cleanup",
    "*.db-shm",
    "*.db-wal",
    "logs/",
    "backups/",
    "data/openai-api-key",
];

#[tauri::command]
pub fn private_database_url() -> Result<String, String> {
    let root = private_data_root()?;
    fs::create_dir_all(root.join("data")).map_err(|e| e.to_string())?;
    fs::create_dir_all(root.join("backups")).map_err(|e| e.to_string())?;
    fs::create_dir_all(root.join("logs")).map_err(|e| e.to_string())?;
    migrate_legacy_database(&root)?;
    run_private_data_maintenance(&root);
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

fn migrate_legacy_database(root: &PathBuf) -> Result<(), String> {
    let target = root.join(DB_FILE_NAME);
    let legacy = root.join(LEGACY_DB_FILE_NAME);

    if target.exists() || !legacy.exists() {
        return Ok(());
    }

    fs::rename(&legacy, &target).map_err(|e| e.to_string())?;

    for suffix in ["-wal", "-shm"] {
        let legacy_sidecar = root.join(format!("{LEGACY_DB_FILE_NAME}{suffix}"));
        if legacy_sidecar.exists() {
            let target_sidecar = root.join(format!("{DB_FILE_NAME}{suffix}"));
            fs::rename(legacy_sidecar, target_sidecar).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn run_private_data_maintenance(root: &Path) {
    if let Err(error) = ensure_private_gitignore(root) {
        eprintln!("[private-data] Failed to update .gitignore: {error}");
    }

    if let Err(error) = cleanup_private_runtime_files(root) {
        eprintln!("[private-data] Failed to clean logs/backups: {error}");
    }
}

fn ensure_private_gitignore(root: &Path) -> Result<(), String> {
    let path = root.join(".gitignore");
    let current = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(error.to_string()),
    };

    let existing_rules = current
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();
    let missing_rules = PRIVATE_GITIGNORE_RULES
        .iter()
        .filter(|rule| !existing_rules.iter().any(|line| line == *rule))
        .copied()
        .collect::<Vec<_>>();

    if missing_rules.is_empty() {
        return Ok(());
    }

    let mut next = current;
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    for rule in missing_rules {
        next.push_str(rule);
        next.push('\n');
    }

    fs::write(path, next).map_err(|e| e.to_string())
}

fn cleanup_private_runtime_files(root: &Path) -> Result<(), String> {
    let marker = root.join(CLEANUP_STATE_FILE_NAME);
    if !is_cleanup_due(&marker)? {
        return Ok(());
    }

    cleanup_old_files(&root.join("logs"), LOG_RETENTION_SECS, 0)?;
    cleanup_old_files(
        &root.join("backups"),
        BACKUP_RETENTION_SECS,
        MIN_BACKUPS_TO_KEEP,
    )?;

    fs::write(marker, format!("{}\n", unix_timestamp()))
        .map_err(|e| format!("failed to write cleanup marker: {e}"))?;
    Ok(())
}

fn is_cleanup_due(marker: &Path) -> Result<bool, String> {
    let modified = match fs::metadata(marker).and_then(|metadata| metadata.modified()) {
        Ok(modified) => modified,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(true),
        Err(error) => return Err(error.to_string()),
    };

    let elapsed = SystemTime::now()
        .duration_since(modified)
        .unwrap_or_else(|_| Duration::from_secs(0));
    Ok(elapsed.as_secs() >= CLEANUP_INTERVAL_SECS)
}

struct CleanupFile {
    path: PathBuf,
    modified: SystemTime,
}

fn cleanup_old_files(dir: &Path, max_age_secs: u64, min_to_keep: usize) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }

    let mut files = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        if !metadata.is_file() {
            continue;
        }

        files.push(CleanupFile {
            path: entry.path(),
            modified: metadata.modified().unwrap_or(UNIX_EPOCH),
        });
    }

    files.sort_by(|a, b| b.modified.cmp(&a.modified));
    let now = SystemTime::now();

    for (index, file) in files.into_iter().enumerate() {
        if index < min_to_keep {
            continue;
        }

        let is_expired = now
            .duration_since(file.modified)
            .map(|age| age.as_secs() > max_age_secs)
            .unwrap_or(false);
        if is_expired {
            fs::remove_file(&file.path)
                .map_err(|e| format!("failed to remove {}: {e}", file.path.display()))?;
        }
    }

    Ok(())
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| Duration::from_secs(0))
        .as_secs()
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
