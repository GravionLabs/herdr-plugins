// Plugin config from HERDR_PLUGIN_CONFIG_DIR/config.json: `{ "harness": "claude", "mode": "interactive", "suggestLimit": 100 }`.
// Pure parse; a missing, broken or mistyped file falls back to the defaults key by key.

export type Mode = 'interactive' | 'unattended';
export type Config = { harness: string; mode: Mode; suggestLimit: number };

export const DEFAULT_CONFIG: Config = { harness: 'claude', mode: 'interactive', suggestLimit: 100 };

export function parseConfig(json: string | null | undefined): Config {
  const config = { ...DEFAULT_CONFIG };
  if (!json) return config;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return config;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return config;
  const { harness, mode, suggestLimit } = data as Record<string, unknown>;
  if (typeof harness === 'string' && harness.trim() !== '') config.harness = harness.trim();
  if (mode === 'interactive' || mode === 'unattended') config.mode = mode;
  if (typeof suggestLimit === 'number' && Number.isInteger(suggestLimit) && suggestLimit >= 1) {
    config.suggestLimit = suggestLimit;
  }
  return config;
}
