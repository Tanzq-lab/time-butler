use serde::Deserialize;
#[cfg(target_os = "macos")]
use std::process::Command;

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NeteaseMusicAction {
    Play,
    Stop,
}

#[tauri::command]
pub fn control_netease_music(action: NeteaseMusicAction) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        control_macos(action)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = action;
        Err("NetEase Cloud Music control is only supported on macOS.".to_string())
    }
}

#[cfg(target_os = "macos")]
fn control_macos(action: NeteaseMusicAction) -> Result<(), String> {
    let script = match action {
        NeteaseMusicAction::Play => PLAY_SCRIPT,
        NeteaseMusicAction::Stop => STOP_SCRIPT,
    };

    let result = run_osascript(script)?;
    if result == "not_installed" {
        return Err("NeteaseMusic.app was not found.".to_string());
    }

    Ok(())
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
set appNames to {"NeteaseMusic", "网易云音乐"}
set bundleId to "com.netease.163music"
set didLaunch to false

if my isAnyProcessRunning(processNames) is false then
  repeat with appName in appNames
    try
      do shell script "open -a " & quoted form of (appName as text)
      set didLaunch to true
      exit repeat
    end try
  end repeat

  if didLaunch is false then
    try
      do shell script "open -b " & quoted form of bundleId
      set didLaunch to true
    end try
  end if

  if didLaunch is false then return "not_installed"
  delay 1
end if

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
