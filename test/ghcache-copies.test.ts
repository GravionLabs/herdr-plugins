import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plugins = ['deliver-board', 'deliver-starter'];
const source = (plugin: string): string => readFileSync(join(root, plugin, 'lib', 'ghcache.ts'), 'utf8').replaceAll('\r\n', '\n');

describe('lib/ghcache.ts copies', () => {
  it.each(plugins)('%s has the same ghcache.ts as %s', (plugin) => {
    expect(source(plugin)).toBe(source(plugins[0]!));
  });
});
