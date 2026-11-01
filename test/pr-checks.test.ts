import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/pr-checks.yml', import.meta.url), 'utf8');

describe('pr-checks workflow', () => {
  it('runs on pull requests into main and release branches with every event the readiness check needs', () => {
    expect(workflow).toMatch(/pull_request:\n\s+branches: \[main, 'release\/\*\*'\]/);
    expect(workflow).toContain(
      'types: [opened, edited, synchronize, reopened, labeled, unlabeled, ready_for_review]',
    );
  });

  it('calls the bundled workflow of GravionLabs/ci from the job id the rulesets require', () => {
    expect(workflow).toMatch(/jobs:\n\s+pr-checks:\n/);
    expect(workflow).toContain('uses: GravionLabs/ci/.github/workflows/pr-checks.yml@main');
  });

  it('grants nothing at the top and only read access to the job', () => {
    expect(workflow).toMatch(/^permissions: \{\}$/m);
    const job = workflow.slice(workflow.indexOf('  pr-checks:\n'));
    expect(job).toMatch(/contents: read\n\s+issues: read\n\s+pull-requests: read/);
    expect(job).not.toMatch(/: write/);
  });
});
