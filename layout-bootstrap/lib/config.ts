// Schema check of HERDR_PLUGIN_CONFIG_DIR/config.json (`schema/config.schema.json`). Pure.
import configSchema from '../schema/config.schema.json' with { type: 'json' };
import { configProblems, type Schema } from './schema.ts';

// Violations as messages naming file and key; none for a missing file.
export function configIssues(json: string | null): string[] {
  return configProblems(json, configSchema as unknown as Schema);
}
