# Privacy Policy

**Effective Date:** July 16, 2026
**App:** Time-butler  
**Version:** 1.0.0

---

## Introduction

Time-butler is a **local-first desktop application** built with Tauri. We believe your productivity data belongs to you — and only you. This policy explains local storage and the optional OpenAI-powered task categorization feature.

---

## Data Collection

**Time-butler does not operate analytics, telemetry, account, or cloud-sync services.**

Time-butler operates entirely on your device. There is:

- ❌ No user accounts or sign-in
- ❌ No analytics or telemetry services
- ❌ No tracking cookies or identifiers
- ❌ No cloud synchronization
- ❌ No advertising or background data sharing

By default, task and focus data stays on the device. If you explicitly configure an OpenAI API key and enable AI automatic categorization, each new task that has no manually selected category sends only the task name, optional project name, and the names/IDs of available categories to OpenAI. Task history, focus sessions, notes, completion reviews, and the API key itself are not included in that request.

---

## Local Storage

All of your data is stored **locally on your device** using SQLite (`Time-butler.db`). This includes:

| Data Type | Description |
|---|---|
| **Tasks** | Task names, estimated/completed pomodoros, archive status |
| **Sessions** | Focus session records, duration, completion status, timestamps |
| **Categories** | Custom category names and color preferences |
| **Settings** | App preferences (timer durations, notifications, hotkeys, theme, AI categorization toggle) |
| **OpenAI API Key** | Optional credential stored separately at `data/openai-api-key` with owner-only file permissions on supported systems |

The SQLite database and optional API key file reside in Time-butler's local data directory. The API key is never returned to the settings UI after it is saved.

---

## Third-Party Services

### OpenAI API (Optional AI Categorization)

AI automatic categorization is disabled until you save an API key and enable the feature in **Settings → AI Categorization**. When enabled:

- Time-butler calls the OpenAI Responses API only while creating a task without a manually chosen category.
- The request contains the new task name, optional project name, and candidate category names/IDs.
- The request sets response storage to disabled (`store: false`).
- API usage is subject to the OpenAI account and project associated with your API key.
- If the request fails or has low confidence, Time-butler falls back to local rules and still creates the task.

You can disable the feature or delete the local key at any time in settings.

### GitHub Releases (App Updates)

Time-butler checks for updates via GitHub Releases (`github.com/Tanzq-lab/time-butler`). This process:

- Only retrieves **version metadata** to determine if an update is available.
- Does **not** transmit any user data, usage statistics, or identifiable information.
- Is optional — you can disable update checks in your system settings.

### Tauri Framework & Dependencies

The app is built on [Tauri](https://tauri.app), a Rust-based framework for building desktop applications. Tauri itself does not collect telemetry through our build. All bundled dependencies operate locally within the app sandbox.

### Open Source Libraries

Time-butler uses the following open-source libraries, all of which run locally:

- React, Zustand (UI & state management)
- Recharts (local analytics rendering)
- Framer Motion (animations)
- Lucide React (icons)
- Tailwind CSS (styling)

None of these libraries initiate external network requests for data collection purposes.

---

## Your Rights & Control

You have **full control** over your data at all times:

1. **View Your Data** — Your SQLite database file can be inspected with any SQLite browser tool.

2. **Export Your Data** — The `Time-butler.db` file can be copied and backed up manually from your system's app data directory.

3. **Delete Your Data** — Navigate to **Settings → Privacy & Data → Clear All Data** to permanently delete all tasks, sessions, categories, settings, and the locally stored OpenAI API key.

4. **Uninstall** — Removing the app will remove the application binary. You may also wish to manually delete the remaining data directory for complete removal.

---

## Security

- All data is stored using SQLite with file-system level permissions provided by your operating system.
- The app runs within Tauri's security sandbox, limiting access to only the resources it needs.
- AI categorization network requests are opt-in and run in the Tauri backend so the saved API key is not exposed back to the web UI.
- The optional key file is excluded from the local data repository by `.gitignore`.

---

## Children's Privacy

Time-butler does not knowingly collect personal information from anyone, including children. The optional AI categorization feature should only be enabled by the person who controls the associated OpenAI API key.

---

## Changes to This Policy

If we ever change how Time-butler handles data (for example, if optional cloud sync is added in a future version), we will:

1. Update this document clearly and prominently.
2. Make any new data collection **opt-in** and transparent before it is enabled.
3. Announce changes through our release notes.

---

## Contact

If you have questions about this Privacy Policy or how Time-butler handles your data, you can reach us through the [GitHub repository](https://github.com/Tanzq-lab/time-butler/issues).

---

*This privacy policy reflects the fact that Time-butler is designed from the ground up as a privacy-respecting, offline-first application. Your data stays on your device.*
