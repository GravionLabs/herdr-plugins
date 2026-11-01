import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (name: string): string => readFileSync(new URL(name, root), 'utf8');

describe('repository setup', () => {
  it('pins the runtime to Node 26 in package.json and .nvmrc', () => {
    expect(JSON.parse(read('package.json')).engines.node).toBe('>=26');
    expect(read('.nvmrc').trim()).toBe('26');
  });

  it('sets coverage thresholds in vitest.config.ts', () => {
    const config = read('vitest.config.ts');

    expect(config).toMatch(/provider:\s*'v8'/);
    expect(config).toMatch(/thresholds:\s*\{[^}]*statements:\s*[1-9]\d*[^}]*branches:\s*[1-9]\d*[^}]*functions:\s*[1-9]\d*[^}]*lines:\s*[1-9]\d*/);
  });

  it('lists @vitest/coverage-v8 as a devDependency', () => {
    expect(JSON.parse(read('package.json')).devDependencies).toHaveProperty('@vitest/coverage-v8');
  });
});
