use serde::Deserialize;
#[cfg(target_os = "macos")]
use std::process::{Command, Stdio};

#[cfg(target_os = "macos")]
const NETEASE_PROCESS_NAMES: [&str; 2] = ["NeteaseMusic", "网易云音乐"];

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NeteaseMusicAction {
    Play,
    Stop,
}

#[tauri::command]
pub async fn control_netease_music(action: NeteaseMusicAction) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        tauri::async_runtime::spawn_blocking(move || control_macos(action))
            .await
            .map_err(|err| format!("failed to join NetEase Music control task: {err}"))?
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = action;
        Err("NetEase Cloud Music control is only supported on macOS.".to_string())
    }
}

#[cfg(target_os = "macos")]
fn control_macos(action: NeteaseMusicAction) -> Result<(), String> {
    if !is_netease_music_running()? {
        return Ok(());
    }

    let script = match action {
        NeteaseMusicAction::Play => PLAY_SCRIPT,
        NeteaseMusicAction::Stop => STOP_SCRIPT,
    };

    run_osascript(script)?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn is_netease_music_running() -> Result<bool, String> {
    for process_name in NETEASE_PROCESS_NAMES {
        let status = Command::new("/usr/bin/pgrep")
            .arg("-x")
            .arg(process_name)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|err| format!("failed to check NetEase Music process: {err}"))?;

        if status.success() {
            return Ok(true);
        }

        if status.code() != Some(1) {
            return Err(format!(
                "NetEase Music process check failed with status {status}"
            ));
        }
    }

    Ok(false)
}

#[cfg(target_os = "macos")]
fn run_osascript(script: &str) -> Result<String, String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("failed to run osascript: {e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "osascript failed without stderr".to_string()
        } else {
            stderr
        })
    }
}

#[cfg(target_os = "macos")]
const PLAY_SCRIPT: &str = r#"
set processNames to {"NeteaseMusic", "网易云音乐"}

if my isAnyProcessRunning(processNames) is false then return "not_running"

my focusFirstRunningProcess(processNames)

if my clickFirstMenuItem(processNames, {"Play", "播放", "Resume", "继续", "继续播放"}) then
  return "played"
end if

return "already_playing_or_unavailable"

on isAnyProcessRunning(processNames)
  tell application "System Events"
    repeat with processName in processNames
      if exists process (processName as text) then return true
    end repeat
  end tell
  return false
end isAnyProcessRunning

on focusFirstRunningProcess(processNames)
  tell application "System Events"
    repeat with processName in processNames
      if exists process (processName as text) then
        tell process (processName as text)
          set frontmost to true
        end tell
        delay 0.2
        return true
      end if
    end repeat
  end tell
  return false
end focusFirstRunningProcess

on clickFirstMenuItem(processNames, itemNames)
  tell application "System Events"
    repeat with processName in processNames
      if exists process (processName as text) then
        tell process (processName as text)
          repeat with barItem in menu bar items of menu bar 1
            try
              repeat with menuItem in menu items of menu 1 of barItem
                try
                  set itemName to name of menuItem
                  if itemNames contains itemName then
                    click menuItem
                    return true
                  end if
                end try
              end repeat
            end try
          end repeat
        end tell
      end if
    end repeat
  end tell
  return false
end clickFirstMenuItem
"#;

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::PLAY_SCRIPT;

    #[test]
    fn play_only_controls_an_already_running_netease_music_process() {
        assert!(PLAY_SCRIPT.contains(
            "if my isAnyProcessRunning(processNames) is false then return \"not_running\""
        ));
        assert!(!PLAY_SCRIPT.contains("open -a"));
        assert!(!PLAY_SCRIPT.contains("open -b"));
    }
}

#[cfg(target_os = "macos")]
const STOP_SCRIPT: &str = r#"
set processNames to {"NeteaseMusic", "网易云音乐"}

if my isAnyProcessRunning(processNames) is false then return "not_running"

my focusFirstRunningProcess(processNames)

if my clickFirstMenuItem(processNames, {"Pause", "暂停", "暂停播放", "Stop", "停止", "停止播放"}) then
  return "stopped"
end if

return "already_stopped_or_unavailable"

on isAnyProcessRunning(processNames)
  tell application "System Events"
    repeat with processName in processNames
      if exists process (processName as text) then return true
    end repeat
  end tell
  return false
end isAnyProcessRunning

on focusFirstRunningProcess(processNames)
  tell application "System Events"
    repeat with processName in processNames
      if exists process (processName as text) then
        tell process (processName as text)
          set frontmost to true
        end tell
        delay 0.2
        return true
      end if
    end repeat
  end tell
  return false
end focusFirstRunningProcess

on clickFirstMenuItem(processNames, itemNames)
  tell application "System Events"
    repeat with processName in processNames
      if exists process (processName as text) then
        tell process (processName as text)
          repeat with barItem in menu bar items of menu bar 1
            try
              repeat with menuItem in menu items of menu 1 of barItem
                try
                  set itemName to name of menuItem
                  if itemNames contains itemName then
                    click menuItem
                    return true
                  end if
                end try
              end repeat
            end try
          end repeat
        end tell
      end if
    end repeat
  end tell
  return false
end clickFirstMenuItem
"#;
