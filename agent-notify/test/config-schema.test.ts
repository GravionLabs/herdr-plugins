import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configIssues } from '../lib/config.ts';

describe('configIssues', () => {
  it('accepts a valid config, the deprecated alias and a missing file', () => {
    expect(configIssues('{"systemNotification":true,"sound":false}')).toEqual([]);
    expect(configIssues('{"system_notification":true}')).toEqual([]);
    expect(configIssues('{}')).toEqual([]);
    expect(configIssues(undefined)).toEqual([]);
  });

  it('names file and key for a wrong type', () => {
    expect(configIssues('{"sound":"yes"}')).toEqual(['config.json: sound: expected boolean, got string']);
    expect(configIssues('{"system_notification":1}')).toEqual([
      'config.json: system_notification: expected boolean, got number',
    ]);
  });

  it('reports an unknown key, broken JSON and a non-object', () => {
    expect(configIssues('{"sund":true}')).toEqual(['config.json: sund: unknown key']);
    expect(configIssues('{bad')).toEqual(['config.json: invalid JSON']);
    expect(configIssues('[]')).toEqual(['config.json: expected object, got array']);
  });
});

describe('validator copies', () => {
  it('are identical in every plugin', () => {
    const copy = (plugin: string): string => readFileSync(new URL(`../../${plugin}/lib/schema.ts`, import.meta.url), 'utf8');
    for (const plugin of ['command-palette', 'deliver-starter', 'layout-bootstrap', 'repo-open']) {
      expect(copy(plugin)).toBe(copy('agent-notify'));
    }
  });
});
