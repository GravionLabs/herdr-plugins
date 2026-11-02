#!/usr/bin/env node
// herdr pane `form` (popup): asks for the `/deliver` arguments and the mode, checks the issues, starts the delivery.
// Input: DELIVER_STARTER_CWD (set by the `start` action) or HERDR_PLUGIN_CONTEXT_JSON. Empty input or Escape closes.
import { parseArgs } from '../lib/args.ts';
import { cwdFromContext } from '../lib/context.ts';
import { applyKey, initialForm, render, type Form } from '../lib/form.ts';
import { describe, noRepository, noticeFor } from '../lib/errors.ts';
import { gitToplevel, notify } from '../lib/host.ts';
import { configNotice, loadConfig, realDeps } from '../lib/runtime.ts';
import { start, validate } from '../lib/start.ts';
import { loadMilestones } from '../lib/milestones.ts';
import { loadIssues, stateCache } from '../lib/suggest.ts';

const out = process.stdout;

function exit(code = 0): never {
  out.write('\x1b[?25h\x1b[?1049l');
  process.exit(code);
}

async function main(): Promise<void> {
  out.write('\x1b[?1049h\x1b[?25l');
  const config = loadConfig();
  const deps = realDeps();
  const cwd = process.env.DELIVER_STARTER_CWD || cwdFromContext(process.env.HERDR_PLUGIN_CONTEXT_JSON) || process.cwd();
  const repo = await gitToplevel(cwd);

  let form: Form = { ...initialForm(config.mode), message: configNotice() ?? '' };
  let busy = false;
  const draw = (): void => {
    out.write(`\x1b[H\x1b[2J${render(form).join('\r\n')}`);
  };
  const say = (message: string): void => {
    form = { ...form, message };
    draw();
  };

  const submit = async (): Promise<void> => {
    const parsed = parseArgs(form.text);
    if (!parsed.ok) {
      if (parsed.reason === 'empty') exit(0);
      return say(parsed.reason);
    }
    if (!repo) return say(`${describe(noRepository())} (${cwd})`);
    busy = true;
    say('Checking…');
    const problem = await validate(deps, repo, parsed.target);
    if (problem) {
      busy = false;
      return say(problem);
    }
    const outcome = await start(deps, repo, config, form.mode, parsed.target);
    if (outcome.ok) exit(0);
    if (outcome.installHint) {
      await notify('deliver-starter: deliver skill not installed', outcome.reason);
      exit(1);
    }
    busy = false;
    say(outcome.reason);
  };

  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (data: string) => {
    if (busy) return;
    const step = applyKey(form, data);
    form = step.form;
    if (step.event === 'cancel') exit(0);
    if (step.event === 'submit') return void submit();
    draw();
  });
  process.stdin.resume();
  draw();

  // Suggestions: two cached REST calls per popup; a failure leaves the popup usable and is
  // shown next to the `#` or `@` list.
  if (!repo) return;
  const [loaded, milestones] = await Promise.all([
    loadIssues(deps.run, repo, config.suggestLimit, stateCache()),
    loadMilestones(deps.run, repo, stateCache()),
  ]);
  const limited = !loaded.ok && loaded.rateLimited ? loaded.reason : !milestones.ok && milestones.rateLimited ? milestones.reason : null;
  if (limited) await notify('deliver-starter: GitHub rate limit exceeded', limited).catch(() => undefined);
  form = loaded.ok ? { ...form, issues: loaded.issues } : { ...form, note: loaded.reason };
  form = milestones.ok ? { ...form, milestones: milestones.milestones } : { ...form, milestoneNote: milestones.reason };
  if (!busy) draw();
}

main().catch(async (error: unknown) => {
  const shown = noticeFor('deliver-starter', error instanceof Error ? error.message : String(error), 'deliver-starter failed');
  await notify(shown.title, shown.body).catch(() => undefined);
  out.write(`${shown.title}\r\n${shown.body}\r\n`);
  setTimeout(() => exit(1), 3000);
});
