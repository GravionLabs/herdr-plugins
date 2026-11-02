// HERDR_PLUGIN_CONFIG_DIR/config.json: `{"systemNotification": false, "sound": false}`, both off by default. Pure.
// `system_notification` is the deprecated spelling of `systemNotification` and still works (removed in the next major).
import configSchema from '../schema/config.schema.json' with { type: 'json' };
import { parseJson } from './event.ts';
import { configProblems, type Schema } from './schema.ts';

// Schema violations of config.json (`schema/config.schema.json`) as messages naming file and key; none for a missing file.
export function configIssues(json: string | undefined): string[] {
  return configProblems(json, configSchema as unknown as Schema);
}

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
