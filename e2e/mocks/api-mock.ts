// Mock for @tauri-apps/api/core — all exports are no-ops in browser tests
export async function invoke(_cmd: string, _args?: Record<string, unknown>) {
  if (_cmd === "private_database_url") return "sqlite:Time-butler.db";
  if (_cmd === "private_data_root_path") return "/tmp/time-butler-data";
  if (_cmd === "ai_api_key_status") return { configured: false };
  if (_cmd === "ai_api_key_save") return { configured: true };
  if (_cmd === "ai_api_key_clear") return { configured: false };
  return null;
}

export async function addPluginListener(
  _plugin: string,
  _event: string,
  _handler: (data: unknown) => void,
) {
  return () => {};
}

export async function convertFileSrc(_filePath: string) {
  return "";
}

export class Resource {
  rid = 0;
  async close() {}
}

export class Channel {
  onmessage: ((message: unknown) => void) | null = null;
  constructor() {}
}
