import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (name: string): string => readFileSync(new URL(name, root), 'utf8');

describe('repository setup', () => {
  it('pins the runtime to Node 24 in package.json and .nvmrc', () => {
    expect(JSON.parse(read('package.json')).engines.node).toBe('>=24');
    expect(read('.nvmrc').trim()).toBe('24');
  });
});
