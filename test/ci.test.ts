import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

describe('ci workflow', () => {
  it('runs the tests on ubuntu, macos and windows', () => {
    expect(workflow).toMatch(/runs-on: \$\{\{ matrix\.os \}\}/);
    expect(workflow).toMatch(/os: \[ubuntu-latest, macos-latest, windows-latest\]/);
  });

  it('lets every OS finish when one fails', () => {
    expect(workflow).toMatch(/fail-fast: false/);
  });

  it('keeps a job named exactly Test for the required status check', () => {
    expect(workflow).toMatch(/\n    name: Test\n    needs: test\n    if: \$\{\{ always\(\) \}\}\n/);
    expect(workflow).toContain('test "${{ needs.test.result }}" = "success"');
  });

  it('checks out LF line endings on every OS', () => {
    expect(workflow).toContain('git config --global core.autocrlf false');
  });
});
