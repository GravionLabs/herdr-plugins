import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type ListDir, load, worktreeOf } from '../lib/load.ts';
import {
  back,
  choose,
  editorCommand,
  isStale,
  keyAction,
  move,
  parseReview,
  SUPPORTED_SCHEMA_VERSIONS,
  pbiFromBranch,
  render,
  validateReview,
  type State,
} from '../lib/review.ts';
import type { Result, Run } from '../lib/run.ts';
import { findingPath, openFinding } from '../lib/split.ts';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8');
const schema = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../schema/${name}.schema.json`, import.meta.url), 'utf8'));

// The code builds paths with join(); join() turns a posix literal into the separators of the platform.
const p = (path: string): string => join(path);

const ok = (stdout: string): Result => ({ ok: true, stdout });
const fail = (stderr: string): Result => ({ ok: false, code: 1, stdout: '', stderr });

// Fake git: answers by arguments.
// `branchHead`: head of refs/heads/feat/4-show-review-result-popup (missing: the branch is gone);
// `worktrees`: output of `git worktree list --porcelain`.
function fakeRun(opts: {
  branch?: string;
  head?: string;
  common?: string;
  notRepo?: boolean;
  branchHead?: string;
  worktrees?: string;
}): Run {
  return async (_cmd, args) => {
    if (opts.notRepo) return fail('fatal: not a git repository');
    const joined = args.join(' ');
    if (joined === 'rev-parse --git-common-dir') return ok(`${opts.common ?? '/repo/.git'}\n`);
    if (joined === 'rev-parse --show-toplevel') return ok('/repo/wt\n');
    if (joined === 'rev-parse --abbrev-ref HEAD') return ok(`${opts.branch ?? 'feat/4-show-review-result-popup'}\n`);
    if (joined === 'rev-parse HEAD') return ok(`${opts.head ?? 'abc1234ffff'}\n`);
    if (joined === 'rev-parse --verify --quiet refs/heads/feat/4-show-review-result-popup') {
      return opts.branchHead ? ok(`${opts.branchHead}\n`) : fail('');
    }
    if (joined === 'worktree list --porcelain') return ok(opts.worktrees ?? '');
    return fail('unexpected');
  };
}

// Fake state directory: the review files with their modification times.
const listing = (entries: { name: string; mtimeMs: number }[]): ListDir => async (dir) =>
  dir.replaceAll('\\', '/').endsWith('/repo/.git/.agents/state') ? entries : [];

const PORCELAIN = [
  'worktree /repo',
  'HEAD 1111111111111111111111111111111111111111',
  'branch refs/heads/release/next',
  '',
  'worktree /tmp/wt/feat-4',
  'HEAD abc1234000000000000000000000000000000000',
  'branch refs/heads/feat/4-show-review-result-popup',
  '',
].join('\n');
const reading = (text: string | null) => async (path: string): Promise<string> => {
  if (text === null || !path.replaceAll('\\', '/').endsWith('/.agents/state/review-4.json')) throw new Error('ENOENT');
  return text;
};

describe('pbiFromBranch', () => {
  it('reads the number of <type>/<nr>-<slug>', () => {
    expect(pbiFromBranch('feat/4-show-review-result-popup')).toBe(4);
    expect(pbiFromBranch('fix/123-x')).toBe(123);
  });
  it('returns null without a number', () => {
    expect(pbiFromBranch('main')).toBeNull();
    expect(pbiFromBranch('release/next')).toBeNull();
    expect(pbiFromBranch('feat/no-number')).toBeNull();
    expect(pbiFromBranch('HEAD')).toBeNull();
  });
});

describe('parseReview', () => {
  it('accepts valid and empty reviews', () => {
    expect(parseReview(fixture('valid')).ok).toBe(true);
    expect(parseReview(fixture('empty')).ok).toBe(true);
  });
  it('reports the validation error of an invalid file', () => {
    expect(parseReview(fixture('invalid'))).toEqual({ ok: false, error: 'round must be an integer >= 1' });
  });
  it('reports broken JSON', () => {
    const parsed = parseReview('{nope');
    expect(parsed.ok).toBe(false);
  });
  it('rejects missing and unexpected properties and bad findings', () => {
    const base = JSON.parse(fixture('valid'));
    expect(validateReview({ ...base, extra: 1 })).toBe('review: unexpected property "extra"');
    const { unmet: _unmet, ...noUnmet } = base;
    expect(validateReview(noUnmet)).toBe('review: missing required property "unmet"');
    expect(validateReview({ ...base, sha: 'XYZ' })).toContain('sha');
    const line0 = { ...base, review: { blocking: [{ ...base.review.blocking[0], line: 0 }], notes: [] } };
    expect(validateReview(line0)).toBe('review.blocking[0].line must be an integer >= 1');
    expect(validateReview(null)).toBe('review must be an object');
  });
});

describe('schema copies', () => {
  it('match the properties the validator enforces', () => {
    const wrapper = schema('deliver-review');
    expect(wrapper.required).toEqual(['pbi', 'branch', 'sha', 'round', 'unmet', 'review']);
    const review = schema('review') as { required: string[]; properties: { blocking: { items: { required: string[] } } } };
    expect(review.required).toEqual(['blocking', 'notes']);
    expect(review.properties.blocking.items.required).toEqual(['file', 'line', 'title', 'why']);
  });
});

describe('isStale', () => {
  it('compares abbreviated and full shas by prefix', () => {
    expect(isStale('abc1234', 'abc1234ffff\n')).toBe(false);
    expect(isStale('abc1234ffff', 'abc1234')).toBe(false);
    expect(isStale('deadbee', 'abc1234ffff')).toBe(true);
  });
});

describe('load', () => {
  it('loads a valid review for the branch', async () => {
    const { state, toplevel } = await load(fakeRun({}), reading(fixture('valid')), '/repo/wt');
    expect(toplevel).toBe('/repo/wt');
    expect(state.kind === 'review' && state.stale).toBe(false);
  });
  it('marks a review of another commit as stale', async () => {
    const { state } = await load(fakeRun({}), reading(fixture('stale')), '/repo/wt');
    expect(state.kind === 'review' && state.stale).toBe(true);
  });
  it('loads an empty review', async () => {
    const { state } = await load(fakeRun({}), reading(fixture('empty')), '/repo/wt');
    expect(state.kind).toBe('review');
  });
  it('says so for an invalid file, with the error', async () => {
    const { state } = await load(fakeRun({}), reading(fixture('invalid')), '/repo/wt');
    expect(state).toEqual({
      kind: 'message',
      lines: [`Invalid review file ${p('/repo/.git/.agents/state/review-4.json')}:`, 'round must be an integer >= 1'],
    });
  });
  it('says so when the file is missing (path under the git common dir)', async () => {
    const { state } = await load(fakeRun({}), reading(null), '/repo/wt');
    expect(state.kind === 'message' && state.lines[0]).toBe(`No review file for #4: ${p('/repo/.git/.agents/state/review-4.json')}`);
  });
  it('resolves a relative common dir against the cwd', async () => {
    const { state } = await load(fakeRun({ common: '.git' }), reading(null), '/repo');
    expect(state.kind === 'message' && state.lines[0]).toContain(p('/repo/.git/.agents/state/review-4.json'));
  });
  describe('on a branch without PBI number (the deliver pane on release/next)', () => {
    const files = [
      { name: 'review-3.json', mtimeMs: 100 },
      { name: 'review-4.json', mtimeMs: 300 },
      { name: 'claims.json', mtimeMs: 900 },
    ];
    const three = fixture('valid').replace('"pbi":4', '"pbi":3').replace('feat/4-show-review-result-popup', 'fix/3-gone');
    const both = (four: string) => async (path: string): Promise<string> => {
      const name = path.replaceAll('\\', '/').split('/').pop();
      if (name === 'review-4.json') return four;
      if (name === 'review-3.json') return three;
      throw new Error('ENOENT');
    };
    const pick = async (opts: Parameters<typeof fakeRun>[0], four = fixture('valid')) =>
      (await load(fakeRun({ branch: 'release/next', ...opts }), both(four), '/repo', listing(files))).state;

    it('lists every review newest first, with its PBI number, and keeps the pane toplevel', async () => {
      const { state, toplevel } = await load(
        fakeRun({ branch: 'release/next', branchHead: 'abc1234ffff', worktrees: PORCELAIN }),
        both(fixture('valid')),
        '/repo',
        listing(files),
      );
      expect(toplevel).toBe('/repo/wt');
      expect(state.kind === 'pick' && state.entries.map((e) => [e.pbi, e.toplevel])).toEqual([
        [4, '/tmp/wt/feat-4'],
        [3, null],
      ]);
      expect(render(state)).toEqual([
        'deliver reviews in this repository (pane on release/next, no PBI number), newest first',
        '',
        '> #4  round 2  feat/4-show-review-result-popup',
        '  #3  round 2  fix/3-gone',
        '',
        'Up/Down: select, Enter: show, q: close.',
      ]);
    });
    it('is stale against the head of the review branch, not the pane head', async () => {
      const state = await pick({ head: 'abc1234ffff', branchHead: 'fff0000aaaa' });
      expect(state.kind === 'pick' && state.entries.map((e) => e.stale)).toEqual([true, false]);
      expect(render(state)[2]).toBe('> #4  round 2  feat/4-show-review-result-popup  STALE');
    });
    it('opens the chosen review with its worktree and goes back to the list', async () => {
      const list = move(await pick({ worktrees: PORCELAIN }), 'down');
      expect(choose(move(list, 'up'))).toMatchObject({ kind: 'review', review: { pbi: 4 }, toplevel: '/tmp/wt/feat-4' });
      const opened = choose(list);
      expect(opened).toMatchObject({ kind: 'review', review: { pbi: 3 }, toplevel: null });
      expect(render(opened).at(-1)).toBe('Up/Down: select, Enter: open in $EDITOR, b: back to the list, q: close.');
      expect(back(opened)).toBe(list);
    });
    it('lists an invalid file with its error and does not open it', async () => {
      const state = await pick({}, fixture('invalid'));
      expect(render(state)[2]).toBe('> #4  invalid: round must be an integer >= 1');
      expect(choose(state)).toBe(state);
    });
    it('says so when the repository has no review yet', async () => {
      const { state } = await load(fakeRun({ branch: 'release/next' }), reading(null), '/repo', listing([]));
      expect(state).toEqual({
        kind: 'message',
        lines: ['No deliver review in this repository yet (pane on release/next).', 'deliver writes it after a review round.'],
      });
    });
  });
  describe('worktreeOf', () => {
    it('finds the worktree of a branch, else null', () => {
      expect(worktreeOf(PORCELAIN, 'feat/4-show-review-result-popup')).toBe('/tmp/wt/feat-4');
      expect(worktreeOf(PORCELAIN, 'feat/4')).toBeNull();
    });
  });
  it('says so outside a repository', async () => {
    const { state, toplevel } = await load(fakeRun({ notRepo: true }), reading(null), '/tmp/x');
    expect(toplevel).toBeNull();
    expect(state.kind === 'message' && state.lines[0]).toBe('not a git repository: /tmp/x');
  });
});

describe('render', () => {
  const state = (name: string, stale = false): State => {
    const parsed = parseReview(fixture(name));
    if (!parsed.ok) throw new Error(parsed.error);
    return { kind: 'review', review: parsed.review, stale, selected: 0 };
  };
  it('shows header, unmet, blocking with why, then notes in this order', () => {
    expect(render(state('valid'))).toEqual([
      '#4 round 2',
      '',
      'Unmet criteria (1)',
      '  - Header shows the round',
      '',
      'Blocking findings (2)',
      '> lib/review.ts:12 — Missing check',
      '      The sha is not validated.',
      '  bin/open.ts:3 — Second',
      '      Because.',
      '',
      'Notes (1)',
      '  - Consider a shorter title',
      '',
      'Up/Down: select, Enter: open in $EDITOR, q: close.',
    ]);
  });
  it('turns control characters of the review text into ? (no escape sequence reaches the terminal)', () => {
    const base = state('valid');
    if (base.kind !== 'review') throw new Error();
    const finding = { file: 'a.ts', line: 1, title: 'x\x1b]52;c;cm0gLXJmIH4=\x07y', why: 'w\x1b[2Jz\r\nq' };
    const review = { ...base.review, review: { blocking: [finding], notes: ['\x9b31m'] }, unmet: ['\x1b[8m'] };
    const lines = render({ ...base, review });
    expect(lines.join('\n')).not.toMatch(/[\x00-\x09\x0b-\x1f\x7f-\x9f]/);
    expect(lines).toContain('> a.ts:1 — x?]52;c;cm0gLXJmIH4=?y');
    expect(lines).toContain('      w?[2Jz??q');
    expect(lines).toContain('  - ?31m');
    expect(lines).toContain('  - ?[8m');
  });
  it('says stale in the header', () => {
    expect(render(state('stale', true))[0]).toBe('#4 round 2  STALE: reviewed deadbee, branch has moved on');
  });
  it('shows none for an empty review', () => {
    const lines = render(state('empty'));
    expect(lines.filter((l) => l === '  none')).toHaveLength(3);
  });
  it('renders a message with a close hint', () => {
    expect(render({ kind: 'message', lines: ['x'] })).toEqual(['x', '', 'Press q or Esc to close.']);
  });
});

describe('keys and selection', () => {
  it('maps keys', () => {
    expect(keyAction('q')).toBe('quit');
    expect(keyAction('\x1b')).toBe('quit');
    expect(keyAction('\x1b[A')).toBe('up');
    expect(keyAction('j')).toBe('down');
    expect(keyAction('\r')).toBe('open');
    expect(keyAction('x')).toBeNull();
  });
  it('moves within the blocking findings and stays in bounds', () => {
    const parsed = parseReview(fixture('valid'));
    if (!parsed.ok) throw new Error();
    let s: State = { kind: 'review', review: parsed.review, stale: false, selected: 0 };
    s = move(s, 'up');
    expect(s.kind === 'review' && s.selected).toBe(0);
    s = move(s, 'down');
    s = move(s, 'down');
    expect(s.kind === 'review' && s.selected).toBe(1);
  });
});

describe('opening a finding', () => {
  const finding = { file: 'lib/a b.ts', line: 7, title: 't', why: 'w' };
  it('quotes the path and uses the line and the editor', () => {
    expect(editorCommand('nvim', '/repo/wt/lib/a b.ts', 7)).toBe("nvim +7 '/repo/wt/lib/a b.ts'");
    expect(editorCommand(undefined, "/r/it's.ts", 1)).toBe("vi +1 '/r/it'\\''s.ts'");
  });
  it('splits the pane and runs the editor in it', async () => {
    const calls: string[][] = [];
    const run: Run = async (_c, args) => {
      calls.push(args);
      return ok(args[1] === 'split' ? '{"result":{"pane":{"pane_id":"p9"}}}' : '');
    };
    expect(await openFinding(run, 'herdr', '/repo/wt', 'p1', 'nvim', finding)).toBeNull();
    expect(calls[0]).toEqual(['pane', 'split', 'p1', '--direction', 'right', '--cwd', '/repo/wt', '--focus']);
    expect(calls[1]).toEqual(['pane', 'run', 'p9', `nvim +7 '${p('/repo/wt/lib/a b.ts')}'`]);
  });
  it.each([
    ['lib/a;rm -rf ~.ts'],
    ['lib/a&calc&.ts'],
    ['lib/$(id)`id`.ts'],
    ['lib/"x".ts'],
    ['lib/..x.ts'],
    ['/etc/passwd'],
  ])('keeps %j inside the worktree and single-quoted', (file) => {
    expect(findingPath('/repo/wt', file)).toEqual({ path: join('/repo/wt', file) });
    expect(editorCommand('vi', join('/repo/wt', file), 1)).toBe(`vi +1 '${join('/repo/wt', file)}'`);
  });
  it.each(['../secret', '../../etc/passwd', 'lib/../../x', '..', '.', 'lib/..'])('refuses %j outside the worktree', (file) => {
    expect(findingPath('/repo/wt', file)).toEqual({ reason: `Not opened: ${JSON.stringify(file)} is outside /repo/wt` });
  });
  it.each([
    ["it's.ts", "'"],
    ['a\\b.ts', '\\'],
    ['a\u2019b.ts', '\u2019'],
    ['a\nrm -rf ~', '\n'],
    ['a\x1b[2J.ts', '\x1b'],
  ])('refuses %j that could break out of the shell quoting', (file, char) => {
    expect(findingPath('/repo/wt', file)).toEqual({ reason: `Not opened: ${JSON.stringify(file)} contains ${JSON.stringify(char)}` });
  });
  it('runs nothing for a finding outside the worktree', async () => {
    const calls: string[][] = [];
    const run: Run = async (_c, args) => {
      calls.push(args);
      return ok('{"result":{"pane":{"pane_id":"p9"}}}');
    };
    const reason = await openFinding(run, 'herdr', '/repo/wt', 'p1', 'vi', { file: '../../etc/passwd', line: 1, title: 't', why: 'w' });
    expect(reason).toBe(`Not opened: "../../etc/passwd" is outside /repo/wt`);
    expect(calls).toEqual([]);
  });
  it('reports a failing split and a missing pane id', async () => {
    expect(await openFinding(async () => fail('boom'), 'herdr', '/r', undefined, 'vi', finding)).toBe(
      'herdr pane split failed: boom',
    );
    expect(await openFinding(async () => ok('{}'), 'herdr', '/r', undefined, 'vi', finding)).toBe(
      'herdr pane split returned no pane',
    );
  });
});

describe('review schema version', () => {
  it('lists the supported versions in one place', () => {
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([1]);
  });

  it('accepts a file without schemaVersion as version 1', () => {
    expect(parseReview(fixture('valid')).ok).toBe(true);
  });

  it('accepts a supported version', () => {
    const parsed = parseReview(fixture('versioned'));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.review.pbi).toBe(4);
  });

  it('rejects an unsupported version naming the expected skills version', () => {
    const parsed = parseReview(fixture('unsupported-version'));
    expect(parsed).toEqual({
      ok: false,
      error: expect.stringContaining('Unsupported review schema version 99 (supported: 1)'),
    });
    if (!parsed.ok) expect(parsed.error).toContain('d6953b2');
  });

  it('rejects a non-numeric version', () => {
    expect(parseReview('{"schemaVersion":"x"}').ok).toBe(false);
  });
});
