import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plugins = ['agent-notify', 'command-palette', 'deliver-log', 'deliver-starter', 'review-popup', 'worktree-cleanup'];
const source = (plugin: string): string => readFileSync(join(root, plugin, 'lib', 'errors.ts'), 'utf8').replaceAll('\r\n', '\n');

describe('lib/errors.ts copies', () => {
  const reference = source(plugins[0]!);

  it.each(plugins)('%s has the same errors.ts as %s', (plugin) => {
    expect(source(plugin)).toBe(reference);
  });
});
