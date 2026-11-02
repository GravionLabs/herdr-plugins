// HERDR_PLUGIN_CONFIG_DIR/config.json: `{"systemNotification": false, "sound": false}`, both off by default. Pure.
// `system_notification` is the deprecated spelling of `systemNotification` and still works (removed in the next major).
import { parseJson } from './event.ts';

export type Config = { systemNotification: boolean; sound: boolean };

export const DEPRECATED_KEYS: Record<string, string> = { system_notification: 'systemNotification' };

export function parseConfig(json: string | undefined): Config {
  const data = parseJson(json) ?? {};
  const systemNotification =
    typeof data.systemNotification === 'boolean' ? data.systemNotification : data.system_notification === true;
  return { systemNotification, sound: data.sound === true };
}

// Deprecated keys present in the file, as warning lines.
export function deprecations(json: string | undefined): string[] {
  const data = parseJson(json) ?? {};
  return Object.entries(DEPRECATED_KEYS)
    .filter(([old]) => old in data)
    .map(([old, current]) => `config key "${old}" is deprecated, use "${current}"`);
}
