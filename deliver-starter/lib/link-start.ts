// The link handler's start: validate the clicked issue, then the interactive start. No popup.
import type { Target } from './args.ts';
import type { Config } from './config.ts';
import { describe, noRepository } from './errors.ts';
import type { IssueLink } from './link.ts';
import { startInteractive, validate, type Deps, type Outcome } from './start.ts';

// `repo` is the git toplevel of the focused pane (null outside a repository), `link` the parsed clicked URL.
export async function startFromLink(
  deps: Deps,
  repo: string | null,
  config: Config,
  link: IssueLink | null,
): Promise<Outcome> {
  if (!link) return { ok: false, reason: 'not a GitHub issue URL' };
  if (!repo) return { ok: false, reason: describe(noRepository()) };
  const target: Target = { numbers: [link.number], milestone: null };
  const problem = await validate(deps, repo, target, link.repo);
  if (problem) return { ok: false, reason: problem };
  return startInteractive(deps, repo, config, target);
}
