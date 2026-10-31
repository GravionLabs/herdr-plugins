// HERDR_PLUGIN_CONFIG_DIR/config.json: `{"system_notification": false, "sound": false}`, both off by default. Pure.
import { parseJson } from './event.ts';

export type Config = { systemNotification: boolean; sound: boolean };

export function parseConfig(json: string | undefined): Config {
  const data = parseJson(json) ?? {};
  return { systemNotification: data.system_notification === true, sound: data.sound === true };
}
